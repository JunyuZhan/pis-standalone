import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { rotatePhotoSchema, photoIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 照片旋转 API
 * 
 * @route PATCH /api/admin/photos/[id]/rotate
 * @description 更新照片的旋转角度（0、90、180、270度）
 * 
 * @auth 需要管理员登录
 * 
 * @param {string} id - 照片ID（UUID格式）
 * 
 * @body {Object} requestBody - 旋转请求体
 * @body {number} requestBody.rotation - 旋转角度（0、90、180、270，必填）
 * 
 * @returns {Object} 200 - 旋转更新成功
 * @returns {Object} 200.data - 更新后的照片数据
 * @returns {number} 200.data.rotation - 新的旋转角度
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败或无效的旋转角度）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 404 - 照片不存在
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @note 旋转角度必须是 0、90、180、270 之一
 */
interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(photoIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的照片ID')
    }
    
    const { id } = idValidation.data
    const db = await createClient()
    const dbAdmin = await createAdminClient()

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
    const validation = safeValidate(rotatePhotoSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { rotation } = validation.data

    // 验证照片存在且用户有权限访问（排除已删除的照片）
    // 查询照片（包含相册信息验证）
    const photoResult = await db
      .from<{ id: string; album_id: string; deleted_at: string | null }>('photos')
      .select('id, album_id, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    
    // 验证相册存在且未删除
    if (photoResult.data) {
      const albumResult = await db
        .from<{ id: string }>('albums')
        .select('id')
        .eq('id', photoResult.data.album_id)
        .is('deleted_at', null)
        .single()
      
      if (albumResult.error || !albumResult.data) {
        return ApiError.notFound('相册不存在或已被删除')
      }
    }

    if (photoResult.error || !photoResult.data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片不存在或已被删除' } },
        { status: 404 }
      )
    }
    
    const photo = photoResult.data
    
    // 双重检查：确保照片未删除
    if (photo.deleted_at) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '照片已被删除，无法旋转' } },
        { status: 404 }
      )
    }

    // 更新旋转角度
    const updateResult = await dbAdmin.update('photos', { rotation: rotation === null ? null : rotation }, { id })

    if (updateResult.error) {
      console.error('Failed to update photo rotation:', updateResult.error)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '更新失败：' + updateResult.error.message } },
        { status: 500 }
      )
    }

    const updatedPhoto = updateResult.data && updateResult.data.length > 0 ? updateResult.data[0] : null

    // 如果照片状态是 completed，需要重新处理图片以应用新的旋转角度
    // 注意：只处理未删除的照片
    const photoStatusResult = await dbAdmin
      .from<{ status: string; album_id: string; original_key: string | null; deleted_at: string | null }>('photos')
      .select('status, album_id, original_key, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    
    const photoStatus = photoStatusResult.data
    
    // 如果照片已删除，不触发重新处理
    if (!photoStatus || photoStatus.deleted_at) {
      return createSuccessResponse({
        success: true,
        data: updatedPhoto,
        message: '旋转角度已保存，但照片已删除，无法重新处理',
      })
    }

    // 只有 completed 状态的照片才需要重新处理以应用旋转
    // pending/processing 状态的照片会在处理时自动应用新的旋转角度
    // failed 状态的照片需要手动重新处理
    let needsReprocessing = false
    let reprocessingError: string | null = null
    
    if (photoStatus.status === 'completed' && photoStatus.original_key) {
      // 触发重新处理 - 直接调用 Worker API，使用环境变量中的 API key
      try {
        const workerApiUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        const workerApiKey = process.env.WORKER_API_KEY
        
        // 添加 Worker API Key 认证
        if (workerApiKey) {
          headers['X-API-Key'] = workerApiKey
          // 开发环境：添加调试日志
          if (process.env.NODE_ENV === 'development') {
            console.log('[Rotate API] Worker URL:', workerApiUrl)
            console.log('[Rotate API] API Key configured:', workerApiKey.substring(0, 8) + '...')
          }
        } else {
          // 开发环境：如果没有设置 API key，记录警告
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Rotate API] WORKER_API_KEY not set, worker may reject the request if it requires authentication')
          }
        }
        
        const processRes = await fetch(`${workerApiUrl}/api/process`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            photoId: id,
            albumId: photoStatus.album_id,
            originalKey: photoStatus.original_key,
          }),
        })

        if (processRes.ok) {
          // Worker 确认收到任务后，才更新状态为 pending
          // Worker 确认收到任务后，才更新状态为 pending
          await dbAdmin.update('photos', { status: 'pending' }, { id })
          needsReprocessing = true
        } else {
          const errorText = await processRes.text()
          console.error('[Rotate API] Worker process error:', errorText)
          try {
            const errorData = JSON.parse(errorText)
            const errorMsg = errorData.message || errorData.error || 'Worker API 调用失败'
            
            // 如果是认证错误，提供更友好的提示
            if (errorMsg.includes('API key') || errorMsg.includes('Unauthorized')) {
              reprocessingError = `Worker API 认证失败。请确保 .env 中的 WORKER_API_KEY 与 Worker 服务配置一致。当前 Worker URL: ${workerApiUrl}`
            } else {
              reprocessingError = errorMsg
            }
          } catch {
            reprocessingError = errorText || 'Worker API 调用失败'
          }
          // Worker 调用失败，保持原状态，旋转角度已保存，下次处理时会应用
        }
      } catch (err) {
        console.error('[Rotate API] Failed to trigger reprocessing:', err)
        const errorMsg = err instanceof Error ? err.message : 'Worker 服务不可用'
        
        // 如果是网络错误，提供更友好的提示
        if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED')) {
          const workerApiUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
          reprocessingError = `无法连接到 Worker 服务 (${workerApiUrl})。请确保 Worker 服务正在运行。`
        } else {
          reprocessingError = errorMsg
        }
        // Worker 不可用时，保持原状态，旋转角度已保存
        // 可以通过手动重新处理或定时任务来应用旋转
      }
    }

    // 如果需要重新处理但失败了，返回错误信息
    if (photoStatus.status === 'completed' && !needsReprocessing && reprocessingError) {
      return handleError(
        new Error(`Worker处理失败: ${reprocessingError}`),
        `旋转角度已保存，但无法触发重新处理：${reprocessingError}。请稍后手动重新生成预览图。`,
        500
      )
    }

    return createSuccessResponse({
      success: true,
      data: updatedPhoto,
      needsReprocessing,
    })
  } catch (err) {
    return handleError(err, '更新旋转角度失败')
  }
}
