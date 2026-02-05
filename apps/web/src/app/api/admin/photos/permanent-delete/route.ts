import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { purgePhotoCache } from '@/lib/cloudflare-purge'
import { getInternalApiUrl } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { permanentDeleteSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 永久删除照片（从回收站删除）
 * POST /api/admin/photos/permanent-delete
 * 
 * 功能：
 * 1. 删除 MinIO 中的所有文件（原图、缩略图、预览图）
 * 2. 删除数据库记录
 * 3. 清除 CDN 缓存
 * 4. 更新相册照片计数
 */
export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON', 400)
    }

    // 验证输入
    const validation = safeValidate(permanentDeleteSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { photoIds } = validation.data

    const adminClient = await createAdminClient()

    // 查询照片记录（获取文件路径和相册信息）
    const photosResult = await adminClient
      .from('photos')
      .select('id, album_id, original_key, thumb_key, preview_key')
      .in('id', photoIds)
      .not('deleted_at', 'is', null) // 只允许删除已在回收站的照片

    if (photosResult.error) {
      return handleError(photosResult.error, '查询照片记录失败')
    }

    const validPhotos = photosResult.data as Array<{
      id: string
      album_id: string
      original_key: string
      thumb_key: string | null
      preview_key: string | null
    }> | null

    if (!validPhotos || validPhotos.length === 0) {
      return ApiError.notFound('未找到有效的照片（照片可能不在回收站中）')
    }

    const validPhotoIds = validPhotos.map((p) => p.id)
    const albumIds = [...new Set(validPhotos.map((p) => p.album_id))]

    // 获取相册信息（用于缓存清除）
    const albumsResult = await adminClient
      .from('albums')
      .select('id, slug, cover_photo_id')
      .in('id', albumIds)

    interface AlbumInfo {
      id: string
      slug: string | null
      cover_photo_id: string | null
    }
    const albumsMap = new Map<string, AlbumInfo>(
      ((albumsResult.data || []) as AlbumInfo[]).map((album) => [album.id, album])
    )

    // 1. 删除 MinIO 文件（通过 Worker API）
    const proxyUrl = getInternalApiUrl('/api/worker/cleanup-file')

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }

    const filesToDelete: string[] = []
    for (const photo of validPhotos) {
      if (photo.original_key) filesToDelete.push(photo.original_key)
      if (photo.thumb_key) filesToDelete.push(photo.thumb_key)
      if (photo.preview_key) filesToDelete.push(photo.preview_key)
    }

    // 批量删除文件（调用 Worker 批量接口）
    if (filesToDelete.length > 0) {
      // 分批处理，防止请求体过大
      const BATCH_SIZE = 50;
      const batches = [];
      for (let i = 0; i < filesToDelete.length; i += BATCH_SIZE) {
        batches.push(filesToDelete.slice(i, i + BATCH_SIZE));
      }

      // 异步执行，不等待结果
      Promise.all(batches.map(batch => 
        fetch(proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ keys: batch }),
        }).catch((error) => {
          console.warn(`[Permanent Delete] Failed to delete file batch (${batch.length} files):`, error)
        })
      )).catch(error => {
        console.warn('[Permanent Delete] Error dispatching delete requests:', error)
      })
    }

    // 2. 清除 Cloudflare CDN 缓存（如果配置了）
    // 注意：即使清除失败也不阻止删除操作，但会等待清除完成以确保执行
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
    const zoneId = process.env.CLOUDFLARE_ZONE_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    
    if (mediaUrl && zoneId && apiToken) {
      try {
        const purgeResults = await Promise.allSettled(
          validPhotos.map((photo) =>
            purgePhotoCache(mediaUrl, {
              original_key: photo.original_key,
              thumb_key: photo.thumb_key,
              preview_key: photo.preview_key,
            }, zoneId, apiToken)
          )
        )
        
        // 统计清除结果
        const successCount = purgeResults.filter(r => r.status === 'fulfilled' && r.value.success).length
        const failCount = purgeResults.length - successCount
        
        if (failCount > 0) {
          console.warn(`[Permanent Delete] CDN cache purge: ${successCount} succeeded, ${failCount} failed`)
          // 记录失败的详情
          purgeResults.forEach((result, index) => {
            if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
              console.warn(`[Permanent Delete] Failed to purge cache for photo ${validPhotos[index]?.id}:`, 
                result.status === 'rejected' ? result.reason : result.value.error)
            }
          })
        } else {
          console.log(`[Permanent Delete] Successfully purged CDN cache for ${successCount} photos`)
        }
      } catch (error) {
        console.warn('[Permanent Delete] Error purging CDN cache:', error)
      }
    } else if (mediaUrl) {
      console.warn('[Permanent Delete] Cloudflare API not configured (missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN), skipping cache purge')
    }

    // 3. 删除数据库记录
    // 批量删除：一次性删除所有照片记录
    const deleteResult = await adminClient.delete('photos', { 'id[]': validPhotoIds })

    if (deleteResult.error) {
      return handleError(deleteResult.error, '删除照片记录失败')
    }

    // 4. 更新相册封面（如果封面照片被删除）
    const albumsToUpdateCover = Array.from(albumsMap.values())
      .filter(album => album.cover_photo_id && validPhotoIds.includes(album.cover_photo_id))
      .map(album => album.id)

    if (albumsToUpdateCover.length > 0) {
      await adminClient.update('albums', { cover_photo_id: null }, { 'id[]': albumsToUpdateCover })
    }

    // 5. 更新相册照片计数
    // 使用 Promise.all 并行处理多个相册的计数更新
    await Promise.all(albumIds.map(async (albumId) => {
      const countResult = await adminClient
        .from('photos')
        .select('id', { count: 'exact', head: true }) // 优化：只获取数量，不获取数据
        .eq('album_id', albumId)
        .eq('status', 'completed')
        .is('deleted_at', null)

      const actualPhotoCount = countResult.count || 0

      await adminClient.update('albums', { photo_count: actualPhotoCount }, { id: albumId })
    }))

    // 6. 清除 Next.js/Vercel 路由缓存
    for (const album of albumsMap.values()) {
      if (album.slug) {
        try {
          revalidatePath(`/api/public/albums/${album.slug}/photos`)
          revalidatePath(`/api/public/albums/${album.slug}/groups`)
          revalidatePath(`/api/public/albums/${album.slug}`)
          revalidatePath(`/album/${album.slug}`)
        } catch (revalidateError) {
          console.warn(
            `[Permanent Delete] Failed to revalidate cache for album ${album.slug}:`,
            revalidateError
          )
        }
      }
    }

    return createSuccessResponse({
      success: true,
      deletedCount: validPhotoIds.length,
      message: `已永久删除 ${validPhotoIds.length} 张照片`,
    })
  } catch (error) {
    return handleError(error, '永久删除照片失败')
  }
}
