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
 * @description
 * 如果访问令牌过期但刷新令牌有效，会尝试刷新访问令牌。
 * 注意：在 API Routes 中，刷新后的 token 需要通过 response headers 返回给客户端。
 *
 * @param {NextRequest} request Next.js 请求对象
 * @returns {Promise<AuthUser|null>} 用户对象，未认证返回 null
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value

  // 调试日志（仅在开发环境）
  if (process.env.NODE_ENV === 'development') {
    const pathname = request.nextUrl.pathname
    if (pathname.startsWith('/api/admin') || pathname.startsWith('/admin')) {
      console.log(`[Auth getUserFromRequest] Path: ${pathname}`)
      console.log(`[Auth getUserFromRequest] Access token present: ${!!token}, Refresh token present: ${!!refreshToken}`)
      if (token) {
        console.log(`[Auth getUserFromRequest] Access token length: ${token.length}`)
      }
      if (refreshToken) {
        console.log(`[Auth getUserFromRequest] Refresh token length: ${refreshToken.length}`)
      }
    }
  }

  // 检查访问令牌是否有效
  if (token) {
    const payload = await verifyToken(token)
    if (payload && payload.type === 'access') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth getUserFromRequest] Access token valid for user: ${payload.email}`)
      }
      return {
        id: payload.sub,
        email: payload.email,
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth getUserFromRequest] Access token invalid or expired')
      }
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth getUserFromRequest] Access token not found')
    }
  }

  // 如果访问令牌无效（不存在或过期）且刷新令牌存在，尝试刷新
  // 注意：在 API Routes 中，我们不能直接设置 cookie，但中间件应该已经处理了刷新
  // 这里我们返回 null，让调用者知道需要重新认证
  // 实际上，中间件应该已经刷新了 token，所以后续请求应该能够读取到新的 token
  if (refreshToken) {
    const refreshPayload = await verifyToken(refreshToken)
    if (refreshPayload && refreshPayload.type === 'refresh') {
      // 刷新令牌有效，但访问令牌无效
      // 在 API Routes 中，我们不能设置 cookie，所以返回用户信息
      // 调用者需要确保中间件已经刷新了 token
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth getUserFromRequest] Refresh token valid for user: ${refreshPayload.email}, but access token invalid`)
      }
      return {
        id: refreshPayload.sub,
        email: refreshPayload.email,
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth getUserFromRequest] Refresh token invalid or expired')
      }
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth getUserFromRequest] Refresh token not found')
    }
  }

  return null
}

/**
 * 中间件辅助函数：更新会话（刷新即将过期的令牌）
 *
 * @description
 * 应在中间件中调用，确保会话连续性。
 * 当访问令牌过期但刷新令牌有效时，自动生成新的访问令牌。
 *
 * @param {NextRequest} request Next.js 请求对象
 * @returns {Promise<{ response: NextResponse; refreshedUser: AuthUser | null }>} 响应对象和刷新后的用户信息
 */
export async function updateSessionMiddleware(request: NextRequest): Promise<{ response: NextResponse; refreshedUser: AuthUser | null }> {
  const response = NextResponse.next({ request })

  const token = request.cookies.get(COOKIE_NAME)?.value
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value

  // 检查访问令牌是否有效
  let tokenValid = false
  let currentUser: AuthUser | null = null
  if (token) {
    const payload = await verifyToken(token)
    if (payload && payload.type === 'access') {
      tokenValid = true
      currentUser = { id: payload.sub, email: payload.email }
    } else {
      // Token 无效（过期或格式错误）
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] Access token invalid or expired, checking refresh token...')
      }
    }
  } else {
    // Token 不存在
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] Access token not found, checking refresh token...')
    }
  }

  // 如果访问令牌无效（不存在或过期）且刷新令牌存在，尝试刷新
  if (!tokenValid && refreshToken) {
    const refreshPayload = await verifyToken(refreshToken)
    if (refreshPayload && refreshPayload.type === 'refresh') {
      const user: AuthUser = { id: refreshPayload.sub, email: refreshPayload.email }
      const newAccessToken = await createAccessToken(user)
      const isProduction = process.env.NODE_ENV === 'production'

      response.cookies.set(COOKIE_NAME, newAccessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60, // 1 小时
      })
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] Token refreshed successfully for user:', user.email)
      }
      
      // 返回刷新后的用户信息
      return { response, refreshedUser: user }
    } else {
      // Refresh token 也无效
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] Refresh token invalid or expired')
      }
    }
  }

  // 如果 token 有效，返回当前用户；否则返回 null
  if (process.env.NODE_ENV === 'development' && currentUser) {
    console.log('[Auth] Access token valid for user:', currentUser.email)
  }
  return { response, refreshedUser: currentUser }
}
