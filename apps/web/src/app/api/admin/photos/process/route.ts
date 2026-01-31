import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { processPhotoSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 触发照片处理 API
 * 
 * @route POST /api/admin/photos/process
 * @description 触发 Worker 服务处理照片（生成缩略图、预览图等）
 * 
 * @auth 需要管理员登录
 * 
 * @body {Object} requestBody - 照片处理请求体
 * @body {string} requestBody.photoId - 照片ID（UUID格式，必填）
 * @body {string} requestBody.albumId - 相册ID（UUID格式，必填）
 * @body {string} requestBody.originalKey - 原始文件在存储中的键名（必填）
 * 
 * @returns {Object} 200 - 处理请求已提交
 * @returns {boolean} 200.data.success - 操作是否成功
 * 
 * @returns {Object} 202 - 请求已接受，但 Worker 服务暂时不可用
 * @returns {Object} 202.warning - 警告信息
 * @returns {string} 202.warning.code - 警告代码（WORKER_UNAVAILABLE）
 * @returns {string} 202.warning.message - 警告消息
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @note 如果 Worker 服务不可用，会返回 202 状态码，照片将在后台异步处理
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
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(processPhotoSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { photoId, albumId, originalKey } = validation.data

    // 使用代理路由调用 Worker API 触发处理
    // 代理路由会自动处理 Worker URL 配置和认证
    const requestUrl = new URL(request.url)
    const protocol = requestUrl.protocol
    const host = requestUrl.host
    const proxyUrl = `http://localhost:3000/api/worker/process`

    let workerAvailable = true
    let workerError: string | null = null

    try {
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
        body: JSON.stringify({ photoId, albumId, originalKey }),
      })

      if (!processRes.ok) {
        const errorText = await processRes.text()
        console.error('Worker process error:', processRes.status, errorText)
        workerAvailable = false
        workerError = `Worker 返回错误: ${processRes.status}`
      }
    } catch (err) {
      console.error('Failed to call worker:', err)
      workerAvailable = false
      workerError = err instanceof Error ? err.message : '无法连接到 Worker 服务'
    }

    // 如果 Worker 不可用，返回警告状态码
    if (!workerAvailable) {
      return NextResponse.json(
        {
          success: true,
          warning: {
            code: 'WORKER_UNAVAILABLE',
            message: '照片处理服务暂时不可用，照片将在后台异步处理',
            details: workerError,
          },
        },
        { status: 202 } // 202 Accepted: 请求已接受，但处理尚未完成
      )
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    return handleError(error, '触发照片处理失败')
  }
}
