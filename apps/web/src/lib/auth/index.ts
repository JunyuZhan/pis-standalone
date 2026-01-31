/**
 * 自定义认证系统
 * 
 * 用于完全自托管模式，不依赖 Supabase
 * 使用 JWT + HttpOnly Cookie 实现安全的会话管理
 */
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// ==================== 配置 ====================

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET || process.env.ALBUM_SESSION_SECRET || 'fallback-secret-please-change'
)
const JWT_ISSUER = 'pis-auth'
const JWT_AUDIENCE = 'pis-app'
const ACCESS_TOKEN_EXPIRY = '1h'  // 访问令牌有效期
const REFRESH_TOKEN_EXPIRY = '7d' // 刷新令牌有效期
const COOKIE_NAME = 'pis-auth-token'
const REFRESH_COOKIE_NAME = 'pis-refresh-token'

// ==================== 类型定义 ====================

export interface AuthUser {
  id: string
  email: string
  created_at?: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number
  user: AuthUser
}

interface JWTPayload {
  sub: string      // user id
  email: string
  type: 'access' | 'refresh'
  iat: number
  exp: number
}

// ==================== 密码哈希 ====================

/**
 * 使用 Node.js 原生 crypto 进行密码哈希
 * 基于 PBKDF2 算法，安全且无需额外依赖
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString('hex')
  const iterations = 100000
  const keylen = 64
  const digest = 'sha512'
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}:${iterations}:${derivedKey.toString('hex')}`)
    })
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, iterations, storedHash] = hash.split(':')
  const iterCount = parseInt(iterations, 10)
  const keylen = 64
  const digest = 'sha512'
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterCount, keylen, digest, (err, derivedKey) => {
      if (err) reject(err)
      resolve(derivedKey.toString('hex') === storedHash)
    })
  })
}

// ==================== JWT 令牌 ====================

export async function createAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function createRefreshToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// ==================== Cookie 管理 ====================

export async function setAuthCookies(session: AuthSession): Promise<void> {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === 'production'
  
  // 访问令牌 Cookie
  cookieStore.set(COOKIE_NAME, session.access_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })
  
  // 刷新令牌 Cookie
  cookieStore.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  cookieStore.delete(REFRESH_COOKIE_NAME)
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value || null
}

export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value || null
}

// ==================== 会话管理 ====================

/**
 * 获取当前用户（服务端）
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getAuthToken()
  if (!token) return null
  
  const payload = await verifyToken(token)
  if (!payload || payload.type !== 'access') return null
  
  return {
    id: payload.sub,
    email: payload.email,
  }
}

/**
 * 创建会话
 */
export async function createSession(user: AuthUser): Promise<AuthSession> {
  const accessToken = await createAccessToken(user)
  const refreshToken = await createRefreshToken(user)
  
  const session: AuthSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    user,
  }
  
  await setAuthCookies(session)
  return session
}

/**
 * 刷新会话
 */
export async function refreshSession(): Promise<AuthSession | null> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return null
  
  const payload = await verifyToken(refreshToken)
  if (!payload || payload.type !== 'refresh') return null
  
  const user: AuthUser = {
    id: payload.sub,
    email: payload.email,
  }
  
  return createSession(user)
}

/**
 * 销毁会话
 */
export async function destroySession(): Promise<void> {
  await clearAuthCookies()
}

// ==================== Middleware 辅助 ====================

/**
 * 从请求中获取用户（用于 API Routes 和 Middleware）
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
 * Middleware: 更新会话（刷新即将过期的令牌）
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

// ==================== 数据库操作（需要外部实现）====================

/**
 * 数据库操作接口
 * 由外部注入实现，支持不同的数据库后端
 */
export interface AuthDatabase {
  findUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string } | null>
  createUser(email: string, passwordHash: string): Promise<{ id: string; email: string }>
  updateUserPassword(userId: string, passwordHash: string): Promise<void>
  updateLastLogin?(userId: string): Promise<void>
}

let authDatabase: AuthDatabase | null = null

export function setAuthDatabase(db: AuthDatabase): void {
  authDatabase = db
}

export function getAuthDatabase(): AuthDatabase {
  if (!authDatabase) {
    throw new Error('Auth database not initialized. Call setAuthDatabase first.')
  }
  return authDatabase
}
