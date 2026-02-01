/**
 * @fileoverview API 路由认证辅助函数
 *
 * 提供统一的认证检查功能，用于 API Routes。
 * 简化了 API 路由中的用户认证和授权逻辑。
 *
 * @module lib/auth/api-helpers
 *
 * @example
 * ```typescript
 * import { requireAuth } from '@/lib/auth/api-helpers'
 *
 * export const POST = requireAuth(async (req, user) => {
 *   // user 是已认证的用户对象
 *   return NextResponse.json({ userId: user.id })
 * })
 * ```
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from './index'

/**
 * 获取当前用户（用于 API Routes）
 *
 * @description
 * 从请求中解析并返回用户信息。如果用户未认证，返回 null。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<{ id: string; email: string } | null>} 用户对象或 null
 *
 * @example
 * ```typescript
 * import { getCurrentUser } from '@/lib/auth/api-helpers'
 *
 * export async function GET(req: NextRequest) {
 *   const user = await getCurrentUser(req)
 *   if (!user) {
 *     return NextResponse.json({ error: '未登录' }, { status: 401 })
 *   }
 *   // 使用 user.id 和 user.email
 * }
 * ```
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<{ id: string; email: string } | null> {
  return getUserFromRequest(request)
}

/**
 * 要求认证的 API 路由包装器
 *
 * @description
 * 高阶函数，确保只有已认证的用户才能访问处理函数。
 * 未认证时自动返回 401 响应。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @param {Function} handler - 处理函数，接收请求和已认证用户
 * @returns {Promise<NextResponse>} 响应对象或认证错误响应
 *
 * @example
 * ```typescript
 * import { requireAuth } from '@/lib/auth/api-helpers'
 *
 * export const POST = requireAuth(async (req, user) => {
 *   // user.id 和 user.email 可用
 *   return NextResponse.json({ userId: user.id })
 * })
 *
 * // 未认证请求将自动返回：
 * // { error: { code: 'UNAUTHORIZED', message: '请先登录' } }
 * ```
 */
export async function requireAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    user: { id: string; email: string }
  ) => Promise<NextResponse>
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
