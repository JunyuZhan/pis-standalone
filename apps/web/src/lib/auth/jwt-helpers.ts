/**
 * @fileoverview PIS Web - JWT 辅助函数（Edge Runtime 兼容）
 *
 * @description
 * 提供 middleware 和 API routes 使用的 JWT 辅助函数。
 * 这些函数不依赖 Node.js crypto 模块，完全兼容 Edge Runtime。
 *
 * @module lib/auth/jwt-helpers
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, createAccessToken, COOKIE_NAME, REFRESH_COOKIE_NAME, type AuthUser } from './jwt'

/**
 * 从请求中获取用户（用于 API Routes 和 Middleware）
 *
 * @param {NextRequest} request Next.js 请求对象
 * @returns {Promise<AuthUser|null>} 用户对象，未认证返回 null
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload || payload.type !== 'access') return null

  return {
    id: payload.sub,
    email: payload.email,
  }
}

/**
 * 中间件辅助函数：更新会话（刷新即将过期的令牌）
 *
 * @description
 * 应在中间件中调用，确保会话连续性。
 * 当访问令牌过期但刷新令牌有效时，自动生成新的访问令牌。
 *
 * @param {NextRequest} request Next.js 请求对象
 * @returns {Promise<NextResponse>} Next.js 响应对象
 */
export async function updateSessionMiddleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request })

  const token = request.cookies.get(COOKIE_NAME)?.value
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value

  if (!token && refreshToken) {
    // 访问令牌过期，尝试使用刷新令牌
    const payload = await verifyToken(refreshToken)
    if (payload && payload.type === 'refresh') {
      const user: AuthUser = { id: payload.sub, email: payload.email }
      const newAccessToken = await createAccessToken(user)
      const isProduction = process.env.NODE_ENV === 'production'

      response.cookies.set(COOKIE_NAME, newAccessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60,
      })
    }
  }

  return response
}
