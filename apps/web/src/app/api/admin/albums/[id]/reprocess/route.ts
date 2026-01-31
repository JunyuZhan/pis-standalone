import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { reprocessAlbumSchema, albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 重新处理相册照片 API
 * 
 * @route POST /api/admin/albums/[id]/reprocess
 * 
 * @requestBody
 * {
 *   "apply_color_grading": true  // 可选，默认 true，是否应用调色配置
 * }
 * 
 * @returns
 * - 200: 成功加入处理队列
 *   {
 *     "message": "已加入处理队列",
 *     "total_photos": 25,
 *     "estimated_time": "2-3 分钟"
 *   }
 * - 400: 请求参数错误
 * - 401: 未授权
 * - 404: 相册不存在
 * - 500: 服务器错误
 * 
 * @security
 * - 需要用户认证（自定义认证）
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const { id } = idValidation.data
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 解析和验证请求体（允许空请求体）
    let body: unknown = {}
    try {
      const bodyText = await request.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch {
      // 如果请求体为空或格式错误，使用默认值
      body = { apply_color_grading: true }
    }

    const bodyValidation = safeValidate(reprocessAlbumSchema, body)
    if (!bodyValidation.success) {
      return handleError(bodyValidation.error, '输入验证失败')
    }

    // apply_color_grading 参数保留用于未来扩展，当前总是应用调色配置
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _apply_color_grading = bodyValidation.data.apply_color_grading ?? true

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id, photo_count')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 获取需要重新处理的照片
    const photosResult = await db
      .from('photos')
      .select('id, album_id, original_key, status')
      .eq('album_id', id)
      .in('status', ['completed', 'failed'])
      .not('original_key', 'is', null)
      .is('deleted_at', null)

    if (photosResult.error) {
      return ApiError.internal(`数据库错误: ${photosResult.error.message}`)
    }

    const photos = photosResult.data || []

    if (!photos || photos.length === 0) {
      return ApiError.badRequest('相册中没有需要重新处理的照片')
    }

    // 使用现有的重新处理 API
    const reprocessUrl = new URL(request.url)
    reprocessUrl.pathname = '/api/admin/photos/reprocess'
    
    const reprocessResponse = await fetch(reprocessUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        albumId: id,
        photoIds: photos.map(p => p.id),
      }),
    })

    if (!reprocessResponse.ok) {
      const errorData = await reprocessResponse.json().catch(() => ({}))
      return ApiError.internal(errorData.error?.message || '重新处理失败')
    }

    const result = await reprocessResponse.json()

    // 估算处理时间（每张照片约 1-2 秒）
    const estimatedMinutes = Math.ceil(photos.length / 30)  // 假设每分钟处理 30 张

    return NextResponse.json({
      message: result.message || '已加入处理队列',
      total_photos: photos.length,
      estimated_time: estimatedMinutes <= 1 ? '1 分钟' : `${estimatedMinutes}-${estimatedMinutes + 1} 分钟`,
    })
  } catch (error) {
    return handleError(error, '重新处理相册失败')
  }
}
