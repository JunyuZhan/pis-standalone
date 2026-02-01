import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { purgePhotoCache } from '@/lib/cloudflare-purge'
import { albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface PhotoRow {
  id: string
  album_id: string
  original_key: string
  preview_key: string | null
  thumb_key: string | null
  filename: string
  file_size: number | null
  width: number | null
  height: number | null
  mime_type: string | null
  blur_data: string | null
  exif: Record<string, unknown> | null
  captured_at: string | null
  status: string
  is_selected: boolean
  sort_order: number
  rotation: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * 管理员照片列表 API
 * - GET: 获取相册中的照片（含选中状态统计）
 */

// GET /api/admin/albums/[id]/photos - 获取照片列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const { id } = idValidation.data
    const { searchParams } = new URL(request.url)
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 分页参数
    const pageRaw = searchParams.get('page') || '1'
    const limitRaw = searchParams.get('limit') || '50'
    const page = Math.max(1, parseInt(pageRaw) || 1) // 确保页码至少为1
    const limit = Math.max(1, Math.min(100, parseInt(limitRaw) || 50)) // 限制在1-100之间
    const offset = (page - 1) * limit

    // 筛选参数
    const status = searchParams.get('status') // pending, processing, completed, failed
    const selected = searchParams.get('selected') // true, false
    const showDeleted = searchParams.get('showDeleted') === 'true' // 是否显示已删除的照片

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id, title')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    const album = albumResult.data as { id: string; title: string }

    // 构建照片查询
    let query = db
      .from('photos')
      .select('*')
      .eq('album_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit)
      .offset(offset)
    
    // 根据 showDeleted 参数决定是否过滤已删除的照片
    if (showDeleted) {
      // 显示已删除的照片
      query = query.neq('deleted_at', null)
      // 按删除时间倒序排列
      query = query.order('deleted_at', { ascending: false })
    } else {
      // 默认：只查询未删除的照片
      query = query.is('deleted_at', null)
    }

    // 可选：按状态筛选
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      query = query.eq('status', status)
    }

    // 可选：按选中状态筛选
    if (selected === 'true') {
      query = query.eq('is_selected', true)
    } else if (selected === 'false') {
      query = query.eq('is_selected', false)
    }

    const result = await query.execute()

    if (result.error) {
      return handleError(result.error, '查询照片列表失败')
    }

    const photos = result.data as PhotoRow[] | null
    const count = result.count || result.data?.length || 0

    // 获取选中统计（排除已删除的照片）
    const selectedCountResult = await db
      .from('photos')
      .select('*')
      .eq('album_id', id)
      .eq('is_selected', true)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .execute()
    
    const selectedCount = selectedCountResult.count || selectedCountResult.data?.length || 0

    // 构造响应（添加 URL）
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL

    return createSuccessResponse({
      album: {
        id: album.id,
        title: album.title,
      },
      photos: photos?.map((photo) => ({
        id: photo.id,
        album_id: photo.album_id,
        original_key: photo.original_key,
        preview_key: photo.preview_key,
        thumb_key: photo.thumb_key,
        filename: photo.filename,
        file_size: photo.file_size,
        width: photo.width,
        height: photo.height,
        mime_type: photo.mime_type,
        blur_data: photo.blur_data,
        exif: photo.exif,
        captured_at: photo.captured_at,
        status: photo.status,
        is_selected: photo.is_selected,
        sort_order: photo.sort_order,
        rotation: photo.rotation,
        created_at: photo.created_at,
        updated_at: photo.updated_at,
        deleted_at: photo.deleted_at,
        thumbUrl: photo.thumb_key ? `${mediaUrl}/${photo.thumb_key}` : null,
        previewUrl: photo.preview_key ? `${mediaUrl}/${photo.preview_key}` : null,
      })),
      stats: {
        selectedCount: selectedCount || 0,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return handleError(error, '获取照片列表失败')
  }
}

// DELETE /api/admin/albums/[id]/photos - 批量删除照片
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 解析请求体
    interface DeletePhotosRequestBody {
      photoIds: string[]
    }
    let body: DeletePhotosRequestBody
    try {
      body = await request.json()
    } catch {
      console.error('Failed to parse request body:')
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: '请求体格式错误，请提供有效的JSON' } },
        { status: 400 }
      )
    }
    
    const { photoIds } = body

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '请选择要删除的照片' } },
        { status: 400 }
      )
    }

    // 限制批量删除数量
    if (photoIds.length > 100) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '单次最多删除100张照片' } },
        { status: 400 }
      )
    }

    const albumResult = await db
      .from('albums')
      .select('id, slug, cover_photo_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '相册不存在' } },
        { status: 404 }
      )
    }

    const albumData = albumResult.data as { id: string; slug: string; cover_photo_id: string | null }

    // 验证照片属于该相册，并获取文件路径信息（只查询未删除的照片）
    const photosResult = await db
      .from('photos')
      .select('id, original_key, thumb_key, preview_key')
      .eq('album_id', id)
      .is('deleted_at', null) // 只查询未删除的照片
      .in('id', photoIds)

    if (photosResult.error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: photosResult.error.message } },
        { status: 500 }
      )
    }

    const validPhotos = photosResult.data as Array<{ id: string; original_key: string; thumb_key: string | null; preview_key: string | null }> | null
    const validPhotoIds = validPhotos?.map((p) => p.id) || []

    if (validPhotoIds.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '未找到有效的照片' } },
        { status: 404 }
      )
    }

    // 1. 软删除：设置 deleted_at 时间戳（回收站机制）
    // MinIO 文件保留 30 天，由 Worker 定时任务自动清理
    // 同时更新 updated_at，使图片 URL 的查询参数变化（作为 CDN 缓存清除的备用方案）
    const now = new Date().toISOString()
    
    // 批量更新：为每张照片设置 deleted_at
    const updatePromises = validPhotoIds.map(photoId =>
      db.update('photos', { 
        deleted_at: now,
        updated_at: now, // 更新 updated_at，使图片 URL 变化
      }, { id: photoId })
    )
    
    const updateResults = await Promise.all(updatePromises)
    const deleteError = updateResults.find(r => r.error)?.error

    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    // 2. 清除 Cloudflare CDN 缓存（如果配置了）
    // 注意：即使清除失败也不阻止删除操作，但会等待清除完成以确保执行
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
    const zoneId = process.env.CLOUDFLARE_ZONE_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    
    if (mediaUrl && validPhotos && zoneId && apiToken) {
      // 批量清除缓存（等待完成，但不阻塞删除操作）
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
          console.warn(`[Delete Photos] CDN cache purge: ${successCount} succeeded, ${failCount} failed`)
          // 记录失败的详情
          purgeResults.forEach((result, index) => {
            if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
              console.warn(`[Delete Photos] Failed to purge cache for photo ${validPhotos[index]?.id}:`, 
                result.status === 'rejected' ? result.reason : result.value.error)
            }
          })
        }
      } catch (error) {
        console.warn('[Delete Photos] Error purging CDN cache:', error)
      }
    } else if (mediaUrl && validPhotos) {
      console.warn('[Delete Photos] Cloudflare API not configured (missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN), skipping cache purge')
    }

    if (albumData.cover_photo_id && validPhotoIds.includes(albumData.cover_photo_id)) {
      await db.update('albums', { cover_photo_id: null }, { id })
    }

    // 更新相册的照片计数（重新统计 completed 状态且未删除的照片）
    const deletedCount = validPhotoIds.length
    const photoCountResult = await db
      .from('photos')
      .select('*')
      .eq('album_id', id)
      .eq('status', 'completed')
      .is('deleted_at', null) // 只统计未删除的照片
      .execute()
    
    const actualPhotoCount = photoCountResult.count || photoCountResult.data?.length || 0
    await db.update('albums', { photo_count: actualPhotoCount }, { id })

    // 3. 清除 Worker 相册缓存（如果配置了 Worker URL）
    const workerUrl = process.env.WORKER_URL || process.env.WORKER_API_URL
    if (workerUrl) {
      try {
        const requestUrl = new URL(request.url)
        const protocol = requestUrl.protocol
        const host = requestUrl.host
        const proxyUrl = `http://localhost:3000/api/worker/clear-album-cache`
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }
        
        // 传递认证 cookie，代理路由会处理认证
        const cookieHeader = request.headers.get('cookie')
        if (cookieHeader) {
          headers['cookie'] = cookieHeader
        }
        
        // 异步调用，不阻塞删除操作
        fetch(proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ albumId: id }),
        }).catch((error) => {
          // 记录错误但不抛出（不影响删除操作）
          console.warn(`[Delete Photos] Failed to clear Worker cache for album ${id}:`, error)
        })
      } catch (workerCacheError) {
        // 记录错误但不阻止删除操作
        console.warn('[Delete Photos] Error clearing Worker cache:', workerCacheError)
      }
    }

    // 4. 清除 Next.js/Vercel 路由缓存，确保前端立即看到更新
    // 清除相册相关的所有公开API路由缓存
    if (albumData.slug) {
      try {
        // 清除照片列表API缓存
        revalidatePath(`/api/public/albums/${albumData.slug}/photos`)
        // 清除分组列表API缓存（人物相册）
        revalidatePath(`/api/public/albums/${albumData.slug}/groups`)
        // 清除相册信息API缓存
        revalidatePath(`/api/public/albums/${albumData.slug}`)
        // 清除相册页面缓存
        revalidatePath(`/album/${albumData.slug}`)
      } catch (revalidateError) {
        // 记录错误但不阻止删除操作
        console.warn('[Delete Photos] Failed to revalidate cache:', revalidateError)
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount,
      message: `已删除 ${deletedCount} 张照片（已移至回收站，MinIO 文件将保留 30 天后自动清理）`,
    })
  } catch (error) {
    return handleError(error, '获取照片列表失败')
  }
}
