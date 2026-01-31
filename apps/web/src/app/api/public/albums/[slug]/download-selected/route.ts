import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { albumSlugSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 批量下载已选照片 API
 * 
 * @route GET /api/public/albums/[slug]/download-selected
 * @description 获取所有已选照片的下载链接列表，用于批量下载
 * 
 * @auth 无需认证（公开接口，但需要相册允许批量下载）
 * 
 * @param {string} slug - 相册标识（URL友好格式）
 * 
 * @returns {Object} 200 - 成功返回下载链接列表
 * @returns {Object[]} 200.data.downloads - 下载链接数组
 * @returns {string} 200.data.downloads[].photoId - 照片ID
 * @returns {string} 200.data.downloads[].downloadUrl - 临时下载链接
 * @returns {string} 200.data.downloads[].filename - 文件名
 * @returns {number} 200.data.totalCount - 已选照片总数
 * 
 * @returns {Object} 403 - 禁止访问（相册不允许下载或不允许批量下载）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @note 仅返回已选中的照片（is_selected=true）的下载链接
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const slugValidation = safeValidate(albumSlugSchema, paramsData)
    if (!slugValidation.success) {
      return handleError(slugValidation.error, '无效的相册标识')
    }
    
    const { slug } = slugValidation.data
    const db = await createAdminClient()

    // 1. 获取相册信息
    const albumResult = await db
      .from('albums')
      .select('id, title, allow_download, allow_batch_download')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    const album = albumResult.data

    // 2. 检查是否允许下载
    if (!album.allow_download) {
      return ApiError.forbidden('此相册不允许下载')
    }

    if (!album.allow_batch_download) {
      return ApiError.forbidden('此相册不允许批量下载')
    }

    // 3. 获取所有已选照片
    const photosResult = await db
      .from('photos')
      .select('id, filename, original_key')
      .eq('album_id', album.id)
      .eq('is_selected', true)
      .eq('status', 'completed')
      .order('sort_order', { ascending: true })

    if (photosResult.error) {
      throw photosResult.error
    }

    const photos = photosResult.data || []

    if (!photos || photos.length === 0) {
      return ApiError.badRequest('没有已选照片')
    }

    // 4. 通过 Worker API 生成 presigned URL
    const workerUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const workerApiKey = process.env.WORKER_API_KEY
    
    if (!workerApiKey) {
      return handleError(new Error('WORKER_API_KEY not configured'), '服务器配置错误')
    }

    // 为每张照片生成 presigned URL
    const downloadLinks = await Promise.all(
      photos.map(async (photo) => {
        try {
          const workerResponse = await fetch(`${workerUrl}/api/presign/get`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': workerApiKey,
            },
            body: JSON.stringify({
              key: photo.original_key,
              expirySeconds: 5 * 60, // 5 分钟有效期
              responseContentDisposition: `attachment; filename="${encodeURIComponent(photo.filename)}"`,
            }),
          })

          if (!workerResponse.ok) {
            console.error(`[Batch Download API] Failed to generate presigned URL for photo ${photo.id}`)
            throw new Error('Failed to generate download URL')
          }

          const { url: downloadUrl } = await workerResponse.json()

          return {
            id: photo.id,
            filename: photo.filename,
            url: downloadUrl,
          }
        } catch (error) {
          console.error(`[Batch Download API] Error generating URL for photo ${photo.id}:`, error)
          // 如果生成失败，返回 null，前端可以跳过这张照片
          return null
        }
      })
    )

    // 过滤掉生成失败的链接
    const validLinks = downloadLinks.filter((link): link is NonNullable<typeof link> => link !== null)

    if (validLinks.length === 0) {
      return handleError(new Error('无法生成下载链接'), '无法生成下载链接')
    }

    return createSuccessResponse({
      albumTitle: album.title,
      count: validLinks.length,
      photos: validLinks,
    })

  } catch (error) {
    return handleError(error, '获取下载链接失败')
  }
}
