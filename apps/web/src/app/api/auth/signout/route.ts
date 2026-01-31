import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'
import { createSuccessResponse, handleError } from '@/lib/validation/error-handler'

/**
 * 登出 API 路由
 * 
 * @route POST /api/auth/signout
 * @description 清除用户会话，登出当前用户
 * 
 * @auth 需要用户登录（但即使未登录也会返回成功，避免错误）
 * 
 * @returns {Object} 200 - 登出成功
 * @returns {boolean} 200.data.success - 操作是否成功
 * 
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/auth/signout', {
 *   method: 'POST'
 * })
 * ```
 */
export async function POST() {
  try {
    await destroySession()
    return createSuccessResponse({ success: true })
  } catch (error) {
    return handleError(error, '登出失败')
  }
}
