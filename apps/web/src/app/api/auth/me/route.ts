import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { createSuccessResponse, handleError } from '@/lib/validation/error-handler'

/**
 * 获取当前用户信息 API
 * 
 * @route GET /api/auth/me
 * @description 获取当前登录用户的信息，用于客户端检查登录状态
 * 
 * @auth 可选（如果未登录，返回 user: null）
 * 
 * @returns {Object} 200 - 成功返回用户信息
 * @returns {Object|null} 200.data.user - 用户信息对象（如果已登录）或 null（如果未登录）
 * @returns {string} [200.data.user.id] - 用户ID（如果已登录）
 * @returns {string} [200.data.user.email] - 用户邮箱（如果已登录）
 * 
 * @returns {Object} 200 - 未登录时也返回 200，但 user 为 null
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/auth/me')
 * const data = await response.json()
 * if (data.user) {
 *   console.log('已登录:', data.user.email)
 * } else {
 *   console.log('未登录')
 * }
 * ```
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('pis-auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ user: null })
    }

    const secret = new TextEncoder().encode(
      process.env.AUTH_JWT_SECRET || process.env.ALBUM_SESSION_SECRET || 'fallback-secret'
    )

    try {
      const { payload } = await jwtVerify(authToken, secret, {
        issuer: 'pis-auth',
        audience: 'pis-app',
      })

      return createSuccessResponse({
        user: {
          id: payload.sub,
          email: payload.email,
        },
      })
    } catch {
      // Token 无效
      return createSuccessResponse({ user: null })
    }
  } catch (error) {
    return createSuccessResponse({ user: null })
  }
}
