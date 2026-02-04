import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { restoreSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 恢复已删除的照片
 * POST /api/admin/photos/restore
 * 
 * 请求体：
 * {
 *   photoIds: string[]  // 要恢复的照片ID数组
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = await createAdminClient()

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
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(restoreSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { photoIds } = validation.data

    // 验证照片存在且已删除
    const deletedPhotosResult = await adminClient
      .from<{ id: string; album_id: string; deleted_at: string | null }>('photos')
      .select('id, album_id, deleted_at')
      .in('id', photoIds)
      .not('deleted_at', 'is', null)

    if (deletedPhotosResult.error) {
      return handleError(deletedPhotosResult.error, '查询照片记录失败')
    }

    const deletedPhotos = deletedPhotosResult.data

    if (!deletedPhotos || deletedPhotos.length === 0) {
      return ApiError.notFound('未找到已删除的照片')
    }

    const validPhotoIds = deletedPhotos.map(p => p.id)

    // 恢复照片：清除 deleted_at
    // 批量更新：一次性恢复所有照片
    const restoreResult = await adminClient.update('photos', { deleted_at: null }, { 'id[]': validPhotoIds })

    if (restoreResult.error) {
      return ApiError.internal(`数据库更新失败: ${restoreResult.error.message}`)
    }

    // 更新相册照片计数（重新统计 completed 状态且未删除的照片）
    interface PhotoWithAlbumId {
      album_id: string
    }
    interface AlbumWithSlug {
      id: string
      slug: string | null
    }
    const albumIds = [...new Set((deletedPhotos as PhotoWithAlbumId[]).map((p) => p.album_id))]
    const albumSlugs = new Map<string, string>()
    
    // 批量获取相册slug
    const albumsResult = await adminClient
      .from('albums')
      .select('id, slug')
      .in('id', albumIds)
    
    if (albumsResult.data) {
      (albumsResult.data as AlbumWithSlug[]).forEach((album) => {
        if (album.slug) {
          albumSlugs.set(album.id, album.slug)
        }
      })
    }
    
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

    // 清除 Next.js/Vercel 路由缓存，确保前端立即看到更新
    for (const [, slug] of albumSlugs.entries()) {
      if (slug) {
        try {
          // 清除照片列表API缓存
          revalidatePath(`/api/public/albums/${slug}/photos`)
          // 清除分组列表API缓存（人物相册）
          revalidatePath(`/api/public/albums/${slug}/groups`)
          // 清除相册信息API缓存
          revalidatePath(`/api/public/albums/${slug}`)
          // 清除相册页面缓存
          revalidatePath(`/album/${slug}`)
          console.log(`[Restore Photos] Cache revalidated for album: ${slug}`)
        } catch (revalidateError) {
          // 记录错误但不阻止恢复操作
          console.warn(`[Restore Photos] Failed to revalidate cache for album ${slug}:`, revalidateError)
        }
      }
    }

    return createSuccessResponse({
      success: true,
      restoredCount: validPhotoIds.length,
      message: `已恢复 ${validPhotoIds.length} 张照片`,
    })
  } catch (error) {
    return handleError(error, '恢复照片失败')
  }
}
