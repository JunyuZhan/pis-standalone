/**
 * API 路由认证辅助函数
 * 
 * 提供统一的认证检查功能，用于 API Routes
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from './index'

/**
 * 获取当前用户（用于 API Routes）
 * 
 * @param request NextRequest 对象
 * @returns 用户对象或 null
 */
export async function getCurrentUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  return getUserFromRequest(request)
}

/**
 * 要求认证的 API 路由包装器
 * 
 * @param request NextRequest 对象
 * @param handler 处理函数
 * @returns NextResponse 或认证错误响应
 */
export async function requireAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: { id: string; email: string }) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await getCurrentUser(request)
  
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    )
  }
  
  return handler(request, user)
}
