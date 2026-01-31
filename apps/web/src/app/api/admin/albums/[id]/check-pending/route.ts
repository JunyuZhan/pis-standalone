import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

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
    // 注意：内部调用使用 http://localhost:3000，避免 HTTPS 证书问题
    const proxyUrl = `http://localhost:3000/api/worker/check-pending`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // 传递认证 cookie，代理路由会处理认证
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }
    
    const workerRes = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ albumId }),
    })
    
    if (!workerRes.ok) {
      const errorText = await workerRes.text()
      return ApiError.internal(`Worker 服务错误: ${errorText}`)
    }
    
    const result = await workerRes.json()
    return NextResponse.json(result)
  } catch (error) {
    return handleError(error, '检查待处理照片失败')
  }
}
