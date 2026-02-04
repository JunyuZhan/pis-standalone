/**
 * @fileoverview PIS Web - 自定义认证系统
 *
 * @description
 * 实现完全自托管的认证解决方案，不依赖 Supabase。
 * 使用 JWT + HttpOnly Cookie 实现安全的会话管理。
 *
 * 功能特性：
 * - 基于 PBKDF2 的密码哈希（SHA-512，100,000 次迭代）
 * - JWT 访问令牌（1小时有效期）和刷新令牌（7天有效期）
 * - HttpOnly Cookie 防止 XSS 攻击
 * - 支持 Next.js App Router 和 Middleware
 *
 * @module lib/auth
 *
 * @example
 * ```typescript
 * import { hashPassword, verifyPassword, createSession } from '@/lib/auth'
 *
 * // 注册新用户
 * const hash = await hashPassword('password123')
 * await db.createUser(email, hash)
 *
 * // 登录
 * const user = await db.findUserByEmail(email)
 * if (user && await verifyPassword(password, user.password_hash)) {
 *   await createSession(user)
 * }
 * ```
 */
import { cookies } from 'next/headers'
// JWT 函数从 jwt.ts 导入（Edge Runtime 兼容）
import { createAccessToken, createRefreshToken, verifyToken, COOKIE_NAME, REFRESH_COOKIE_NAME, type JWTPayload } from './jwt'
// 密码哈希函数从 password.ts 导入（避免在 Edge Runtime 中导入 Node.js crypto）
export { hashPassword, verifyPassword } from './password'
// Middleware 辅助函数从 jwt-helpers.ts 导入（Edge Runtime 兼容）
export { getUserFromRequest, updateSessionMiddleware } from './jwt-helpers'

// 重新导出 JWT 函数和类型以保持向后兼容
export { createAccessToken, createRefreshToken, verifyToken, COOKIE_NAME, REFRESH_COOKIE_NAME, type JWTPayload }

// ==================== Type Definitions ====================

/**
 * 认证用户信息
 *
 * @interface
 */
export interface AuthUser {
  /** 用户唯一标识符（UUID） */
  id: string
  /** 用户邮箱地址 */
  email: string
  /** 账号创建时间（ISO 8601 格式） */
  created_at?: string
}

/**
 * 认证会话信息
 *
 * @interface
 */
export interface AuthSession {
  /** JWT 访问令牌 */
  access_token: string
  /** JWT 刷新令牌 */
  refresh_token: string
  /** 访问令牌过期时间（Unix 时间戳） */
  expires_at: number
  /** 关联的用户信息 */
  user: AuthUser
}

// ==================== Password Hashing ====================
// 密码哈希函数已移至 password.ts，此处重新导出以保持向后兼容
// 注意：password.ts 不能在 Edge Runtime 中使用（依赖 Node.js crypto）

// ==================== JWT Tokens ====================
// JWT 函数已移至 jwt.ts，此处重新导出以保持向后兼容
// jwt.ts 完全兼容 Edge Runtime（不依赖 Node.js crypto）

// ==================== Cookie Management ====================

/**
 * 设置认证 Cookie
 *
 * @description
 * 同时设置访问令牌和刷新令牌的 HttpOnly Cookie。
 * 生产环境下启用 secure 标志。
 *
 * @param {AuthSession} session 包含令牌的会话对象
 * @returns {Promise<void>}
 */
export async function setAuthCookies(session: AuthSession): Promise<void> {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === 'production'

  // 访问令牌 Cookie
  cookieStore.set(COOKIE_NAME, session.access_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 小时
  })

  // 刷新令牌 Cookie
  cookieStore.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 天
  })
}

/**
 * 清除认证 Cookie（登出）
 *
 * @description
 * 删除访问令牌和刷新令牌 Cookie
 * @returns {Promise<void>}
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  cookieStore.delete(REFRESH_COOKIE_NAME)
}

/**
 * 从 Cookie 中获取访问令牌
 *
 * @returns {Promise<string|null>} 访问令牌字符串，不存在返回 null
 */
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value || null
}

/**
 * 从 Cookie 中获取刷新令牌
 *
 * @returns {Promise<string|null>} 刷新令牌字符串，不存在返回 null
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value || null
}

// ==================== Session Management ====================

/**
 * 获取当前已认证的用户（服务端）
 *
 * @returns {Promise<AuthUser|null>} 用户对象，未认证返回 null
 *
 * @example
 * ```typescript
 * const user = await getCurrentUser()
 * if (user) {
 *   console.log('当前用户:', user.email)
 * }
 * ```
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
 * 为用户创建新会话
 *
 * @description
 * 生成访问令牌和刷新令牌，并设置 Cookie。
 *
 * @param {AuthUser} user 要创建会话的用户
 * @returns {Promise<AuthSession>} 创建的会话对象
 *
 * @example
 * ```typescript
 * const session = await createSession({ id: '123', email: 'user@example.com' })
 * console.log('会话已创建，过期时间:', new Date(session.expires_at * 1000))
 * ```
 */
export async function createSession(user: AuthUser): Promise<AuthSession> {
  const accessToken = await createAccessToken(user)
  const refreshToken = await createRefreshToken(user)

  const session: AuthSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 小时
    user,
  }

  await setAuthCookies(session)
  return session
}

/**
 * 使用刷新令牌更新现有会话
 *
 * @description
 * 当访问令牌过期时，使用刷新令牌获取新的访问令牌。
 *
 * @returns {Promise<AuthSession|null>} 新会话对象，刷新失败返回 null
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
 * 销毁当前会话（登出）
 *
 * @description
 * 清除所有认证 Cookie
 * @returns {Promise<void>}
 */
export async function destroySession(): Promise<void> {
  await clearAuthCookies()
}

// ==================== Middleware Helpers ====================

// ==================== Middleware Helpers ====================
// Middleware 辅助函数已移至 jwt-helpers.ts，此处重新导出以保持向后兼容
// jwt-helpers.ts 完全兼容 Edge Runtime（不依赖 Node.js crypto）

// ==================== Database Operations (External Implementation) ====================

/**
 * 认证数据库接口
 *
 * @description
 * 由外部数据库适配器实现，支持不同的数据库后端。
 *
 * @interface
 *
 * @example
 * ```typescript
 * class MyDatabase implements AuthDatabase {
 *   async findUserByEmail(email: string) {
 *     // 实现查询逻辑
 *   }
 *   // ... 其他方法
 * }
 * ```
 */
export interface AuthDatabase {
  /**
   * 根据邮箱查找用户
   *
   * @param email - 用户邮箱（会自动转为小写）
   * @returns 用户对象，不存在返回 null
   */
  findUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string | null } | null>

  /**
   * 创建新用户
   *
   * @param email - 用户邮箱
   * @param passwordHash - 密码哈希值
   * @returns 创建的用户对象
   */
  createUser(email: string, passwordHash: string): Promise<{ id: string; email: string }>

  /**
   * 更新用户密码
   *
   * @param userId - 用户 ID
   * @param passwordHash - 新的密码哈希值
   */
  updateUserPassword(userId: string, passwordHash: string): Promise<void>

  /**
   * 更新用户最后登录时间（可选）
   *
   * @param userId - 用户 ID
   */
  updateLastLogin?(userId: string): Promise<void>

  /**
   * 检查是否存在任何管理员账户
   * 
   * @returns {Promise<boolean>} 如果存在至少一个管理员，返回 true
   */
  hasAnyAdmin?(): Promise<boolean>
}

/** 内部数据库实例 */
let authDatabase: AuthDatabase | null = null

/**
 * 设置认证数据库实例
 *
 * @param db - 数据库实例
 * @throws {Error} 如果 db 不是 AuthDatabase 实例
 *
 * @example
 * ```typescript
 * setAuthDatabase(new PostgreSQLAuthDatabase())
 * ```
 */
export function setAuthDatabase(db: AuthDatabase): void {
  authDatabase = db
}

/**
 * 获取认证数据库实例
 *
 * @returns 数据库实例
 * @throws {Error} 如果数据库未初始化
 *
 * @example
 * ```typescript
 * try {
 *   const db = getAuthDatabase()
 *   const user = await db.findUserByEmail(email)
 * } catch (err) {
 *   console.error('数据库未初始化')
 * }
 * ```
 */
export function getAuthDatabase(): AuthDatabase {
  if (!authDatabase) {
    throw new Error('Auth database not initialized. Call setAuthDatabase first.')
  }
  return authDatabase
}
