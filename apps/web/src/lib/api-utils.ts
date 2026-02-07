/**
 * API 工具函数
 * 
 * 提供通用的 API 错误处理和认证辅助函数
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from './auth'
import { createAdminClient } from './database'

// 导出 handleError 从 validation/error-handler
export { handleError } from './validation/error-handler'
// 导出原始 ApiError 作为 ApiErrorHelpers
export { ApiError as ApiErrorHelpers } from './validation/error-handler'

/**
 * 可构造的 ApiError 类
 * 用于兼容使用 `throw new ApiError(message, status, code?, details?)` 的代码
 */
export class ApiError extends Error {
  statusCode: number
  code?: string
  details?: unknown

  constructor(message: string, statusCode: number = 500, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

/**
 * API 错误响应处理
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error)
  
  if (error instanceof Error) {
    // 检查是否是带有状态码的错误
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    return NextResponse.json(
      {
        error: {
          code: 'API_ERROR',
          message: error.message,
        },
      },
      { status: statusCode }
    )
  }
  
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    },
    { status: 500 }
  )
}

/**
 * 获取当前认证用户
 * 用于 API 路由
 * 从 cookies 中读取认证信息（支持 JWT access token 和 refresh token）
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: {
    id: string
    email: string
    role: string
  }
}> {
  // 从 cookies 中获取用户信息
  const authUser = await getUserFromRequest(request)
  
  if (!authUser) {
    const error = new Error('未授权访问') as Error & { statusCode: number }
    error.statusCode = 401
    throw error
  }
  
  // 从数据库获取用户角色
  const db = await createAdminClient()
  const { data: userData, error: dbError } = await db
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()
  
  if (dbError || !userData) {
    const authError = new Error('用户不存在或已被禁用') as Error & { statusCode: number }
    authError.statusCode = 401
    throw authError
  }
  
  return {
    user: {
      id: authUser.id,
      email: authUser.email,
      role: (userData as { role: string | null }).role || 'guest',
    },
  }
}
