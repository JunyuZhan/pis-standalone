import { NextRequest } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { reprocessPhotoSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'
import { getInternalApiUrl } from '@/lib/utils'

/**
 * 批量重新生成预览图 API
 * POST /api/admin/photos/reprocess
 * 
 * 用途：
 * - 当预览图标准修改后，重新生成已上传照片的预览图
 * - 确保所有照片都使用最新的预览图标准
 */
export async function POST(request: NextRequest) {
  try {
    const db = await createClient()

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
      return ApiError.badRequest('请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(reprocessPhotoSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { photoIds, albumId } = validation.data

    // 构建查询：获取需要重新处理的照片（排除已删除的）
    // 支持处理 completed 和 failed 状态的照片
    let query = db
      .from('photos')
      .select('id, album_id, original_key, status')
      .in('status', ['completed', 'failed']) // 支持处理已完成和失败状态的照片
      .not('original_key', 'is', null) // 必须有原图
      .is('deleted_at', null) // 排除已删除的照片

    // 如果指定了照片ID，只处理这些照片
    if (photoIds && photoIds.length > 0) {
      query = query.in('id', photoIds)
    }

    // 如果指定了相册ID，只处理该相册的照片
    if (albumId) {
      query = query.eq('album_id', albumId)
    }

    const result = await query

    if (result.error) {
      return handleError(result.error, '查询照片失败')
    }

    const photos = result.data as Array<{
      id: string
      album_id: string
      original_key: string
      status: string
    }>

    if (!photos || photos.length === 0) {
      return createSuccessResponse({
        success: true,
        message: '没有需要重新处理的照片',
        queued: 0,
      })
    }

    // 使用代理路由调用 Worker API 触发重新处理
    // 代理路由会自动处理 Worker URL 配置和认证
    const proxyUrl = getInternalApiUrl('/api/worker/process')

    // 批量添加到处理队列
    let queuedCount = 0
    let failedCount = 0
    const errors: string[] = []

    // 限制并发请求数量，避免过载
    const batchSize = 10
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (photo) => {
          try {
            // 先将状态设置为 pending，以便重新处理
            await db.update('photos', { status: 'pending' }, { id: photo.id })

            // 使用代理路由调用 Worker API 触发处理
            const headers: HeadersInit = {
              'Content-Type': 'application/json',
            }
            
            // 传递认证 cookie，代理路由会处理认证
            const cookieHeader = request.headers.get('cookie')
            if (cookieHeader) {
              headers['cookie'] = cookieHeader
            }
            
            const processRes = await fetch(proxyUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                photoId: photo.id,
                albumId: photo.album_id,
                originalKey: photo.original_key,
              }),
            })

            if (processRes.ok) {
              queuedCount++
            } else {
              failedCount++
              const errorText = await processRes.text()
              errors.push(`照片 ${photo.id}: ${errorText}`)
              // 恢复状态
              await db.update('photos', { status: 'completed' }, { id: photo.id })
            }
          } catch (error) {
            failedCount++
            const errorMessage = error instanceof Error ? error.message : '未知错误'
            errors.push(`照片 ${photo.id}: ${errorMessage}`)
            // 恢复状态
            await db.update('photos', { status: 'completed' }, { id: photo.id })
          }
        })
      )
    }

    return createSuccessResponse({
      success: true,
      message: `已排队 ${queuedCount} 张照片重新处理`,
      queued: queuedCount,
      failed: failedCount,
      total: photos.length,
      ...(errors.length > 0 && { errors: errors.slice(0, 10) }), // 最多返回10个错误
    })
  } catch (error) {
    return handleError(error, '重新处理照片失败')
  }
}
