import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'
import { getInternalApiUrl } from '@/lib/utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 检查并修复 pending 状态的照片（事件驱动）
 * POST /api/admin/albums/[id]/check-pending
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const albumId = idValidation.data.id
    
    // 验证登录状态
    const user = await getCurrentUser(request)
    
    if (!user) {
      return ApiError.unauthorized('请先登录')
    }
    
    // 使用代理路由调用 Worker API
    // 代理路由会自动处理 Worker URL 配置和认证
    // 使用相对路径，Next.js 会自动处理
    const proxyUrl = getInternalApiUrl('/api/worker/check-pending')
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // 传递认证 cookie，代理路由会处理认证
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }
    
    let workerRes: Response
    try {
      workerRes = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ albumId }),
      })
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : '无法连接到 Worker 服务'
      console.error('[Check Pending API] Fetch error:', fetchError)
      
      // 检查是否是连接错误
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed') || errorMsg.includes('ECONNRESET')) {
        return NextResponse.json(
          {
            error: {
              code: 'WORKER_UNAVAILABLE',
              message: 'Worker 服务不可用',
              details: '无法连接到 Worker 服务。请确保 Worker 服务正在运行（运行 `pnpm dev:worker` 启动 Worker 服务）。',
            },
          },
          { status: 503 }
        )
      }
      
      return ApiError.internal(`调用 Worker 服务失败: ${errorMsg}`)
    }
    
    if (!workerRes.ok) {
      let errorText = ''
      let errorData: { error?: string | { code?: string; message?: string; details?: string }; details?: string } = {}
      
      try {
        errorText = await workerRes.text()
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
      } catch {
        errorText = `HTTP ${workerRes.status} ${workerRes.statusText}`
      }
      
      // 处理嵌套的错误对象
      const errorMessage = typeof errorData.error === 'string'
        ? errorData.error
        : (errorData.error && typeof errorData.error === 'object' ? errorData.error.message : null) || 'Worker 服务错误'
      const errorCode = typeof errorData.error === 'string'
        ? 'WORKER_ERROR'
        : (errorData.error && typeof errorData.error === 'object' ? errorData.error.code : null) || 'WORKER_ERROR'
      const errorDetails = (typeof errorData.error === 'object' && errorData.error && 'details' in errorData.error
        ? errorData.error.details
        : null) || errorData.details || errorText
      
      return NextResponse.json(
        {
          error: {
            code: errorCode,
            message: errorMessage,
            details: errorDetails,
          },
        },
        { status: workerRes.status >= 400 && workerRes.status < 600 ? workerRes.status : 500 }
      )
    }
    
    const result = await workerRes.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Check Pending API] Unhandled error:', error)
    return handleError(error, '检查待处理照片失败')
  }
}
