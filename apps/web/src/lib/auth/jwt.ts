/**
 * @fileoverview PIS Web - JWT 工具函数（Edge Runtime 兼容）
 *
 * @description
 * 提供 JWT 相关的工具函数，不依赖 Node.js crypto 模块，可在 Edge Runtime 中使用。
 * 这些函数只使用 jose 库，完全兼容 Edge Runtime。
 *
 * @module lib/auth/jwt
 */
import { SignJWT, jwtVerify } from 'jose'

// ==================== Configuration ====================

/** JWT 密钥（从环境变量读取） */
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET || process.env.ALBUM_SESSION_SECRET || 'fallback-secret-please-change'
)

/** JWT 签发者标识 */
const JWT_ISSUER = 'pis-auth'

/** JWT 受众标识 */
const JWT_AUDIENCE = 'pis-app'

/** 访问令牌有效期（1小时） */
const ACCESS_TOKEN_EXPIRY = '1h'

/** 刷新令牌有效期（7天） */
const REFRESH_TOKEN_EXPIRY = '7d'

/** 访问令牌 Cookie 名称 */
export const COOKIE_NAME = 'pis-auth-token'

/** 刷新令牌 Cookie 名称 */
export const REFRESH_COOKIE_NAME = 'pis-refresh-token'

// ==================== Type Definitions ====================

/**
 * JWT 载荷接口
 */
export interface JWTPayload {
  /** 用户邮箱 */
  email: string
  /** 令牌类型 */
  type: 'access' | 'refresh'
  /** 用户 ID（subject） */
  sub: string
  /** 签发者 */
  iss: string
  /** 受众 */
  aud: string
  /** 签发时间（issued at） */
  iat: number
  /** 过期时间（expiration） */
  exp: number
}

/**
 * 认证用户信息
 */
export interface AuthUser {
  /** 用户唯一标识符（UUID） */
  id: string
  /** 用户邮箱地址 */
  email: string
}

// ==================== JWT Tokens ====================

/**
 * 为用户创建访问令牌
 *
 * @param {AuthUser} user 用户信息对象
 * @returns {Promise<string>} 签名后的 JWT 访问令牌
 */
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

/**
 * 为用户创建刷新令牌
 *
 * @param {AuthUser} user 用户信息对象
 * @returns {Promise<string>} 签名后的 JWT 刷新令牌
 */
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

/**
 * 验证 JWT 令牌
 *
 * @param {string} token JWT 令牌字符串
 * @returns {Promise<JWTPayload|null>} 验证成功返回解码后的载荷，失败返回 null
 */
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
