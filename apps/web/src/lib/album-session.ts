/**
 * @fileoverview PIS Web - 相册会话管理
 *
 * @description 为密码保护的相册提供基于会话的安全认证。使用存储在 HTTP-only Cookie 中的 JWT 令牌实现无状态认证。
 * @module lib/album-session
 *
 * 安全特性：
 * - 加密安全的 JWT 令牌
 * - HTTP-only Cookie 存储
 * - 24 小时令牌过期
 * - 最小化载荷以减少令牌大小
 *
 * @example
 * ```typescript
 * import {
 *   generateAlbumSessionToken,
 *   validateAlbumSessionToken,
 *   getSessionCookieOptions
 * } from '@/lib/album-session'
 *
 * // 生成会话令牌
 * const token = generateAlbumSessionToken(albumId, albumSlug)
 *
 * // 设置 Cookie
 * const cookies = await getCookies()
 * const options = getSessionCookieOptions()
 * cookies.set('album-session', token, options)
 *
 * // 验证令牌
 * const payload = validateAlbumSessionToken(token)
 * if (payload) {
 *   console.log('相册访问有效:', payload.albumSlug)
 * }
 * ```
 */

import jwt from "jsonwebtoken"

/**
 * 相册会话载荷结构
 *
 * @description 定义 JWT 令牌中包含的数据字段
 * @interface
 */
export interface AlbumSessionPayload {
  /** 相册 ID */
  albumId: string
  /** 相册 slug */
  albumSlug: string
  /** 签发时间（Unix 时间戳） */
  iat: number
  /** 过期时间（Unix 时间戳） */
  exp: number
  /** 令牌类型标识 */
  type: "album-access"
}

/**
 * 相册会话数据类型别名
 *
 * @description 向后兼容的类型定义
 * @typedef {AlbumSessionPayload}
 */
export type AlbumSessionData = AlbumSessionPayload

/**
 * 获取 JWT 密钥
 *
 * @description 从环境变量读取密钥，生产环境必须配置。开发环境未配置时自动生成随机密钥。
 * @returns {string} JWT 密钥字符串
 * @throws {Error} 生产环境未配置密钥时抛出错误
 * @internal
 */
function getJWTSecret(): string {
  const secret = process.env.ALBUM_SESSION_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ALBUM_SESSION_SECRET environment variable is required in production",
      )
    }
    // 开发环境：使用随机生成的密钥（每次重启会变化，更安全）
    // 注意：开发环境重启后现有 session 会失效，需要重新验证密码
    if (!global._devAlbumSessionSecret) {
      global._devAlbumSessionSecret = Array.from(
        { length: 32 },
        () =>
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
            Math.floor(Math.random() * 62)
          ],
      ).join("")
      console.warn(
        "⚠️ ALBUM_SESSION_SECRET not set, using auto-generated development secret (sessions will invalidate on restart)",
      )
    }
    return global._devAlbumSessionSecret
  }

  if (secret.length < 32) {
    throw new Error("ALBUM_SESSION_SECRET must be at least 32 characters long")
  }

  return secret
}

// 声明全局变量类型
/* eslint-disable no-var */
declare global {
  // 使用 var 声明全局变量（TypeScript 要求）
  var _devAlbumSessionSecret: string | undefined
}
/* eslint-enable no-var */

/**
 * 生成相册访问的安全会话令牌
 *
 * @param albumId - 相册 ID
 * @param albumSlug - 相册 slug
 * @param expiresInHours - 令牌有效期（小时），默认 24
 * @returns JWT 令牌字符串
 *
 * @example
 * ```typescript
 * const token = generateAlbumSessionToken(
 *   'abc-123',
 *   'summer-vacation',
 *   48 // 48 小时有效期
 * )
 * ```
 */
export function generateAlbumSessionToken(
  albumId: string,
  albumSlug: string,
  expiresInHours: number = 24,
): string {
  const secret = getJWTSecret()

  const payload: Omit<AlbumSessionPayload, "iat" | "exp"> = {
    albumId,
    albumSlug,
    type: "album-access",
  }

  const token = jwt.sign(payload, secret, {
    expiresIn: `${expiresInHours}h`,
    algorithm: "HS256",
  })

  return token
}

/**
 * 验证并解码相册会话令牌
 *
 * @param token - JWT 令牌字符串
 * @returns 验证成功返回解码后的载荷，失败或过期返回 null
 *
 * @example
 * ```typescript
 * const payload = validateAlbumSessionToken(token)
 * if (payload) {
 *   console.log('有效访问，相册:', payload.albumSlug)
 * } else {
 *   console.log('令牌无效或已过期')
 * }
 * ```
 */
export function validateAlbumSessionToken(
  token: string,
): AlbumSessionPayload | null {
  try {
    const secret = getJWTSecret()

    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as AlbumSessionPayload

    // 验证令牌类型
    if (decoded.type !== "album-access") {
      console.warn("Invalid token type:", decoded.type)
      return null
    }

    // 验证必需字段
    if (!decoded.albumId || !decoded.albumSlug) {
      console.warn("Missing required fields in token payload")
      return null
    }

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log("Token expired:", error.message)
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn("Invalid token:", error.message)
    } else {
      console.error("Token validation error:", error)
    }
    return null
  }
}

/** 会话令牌 Cookie 名称 */
export const ALBUM_SESSION_COOKIE_NAME = "album-session"

/**
 * 相册会话 Cookie 配置选项
 */
export interface AlbumSessionCookieOptions {
  /** 仅 HTTP，防止 JavaScript 访问 */
  httpOnly: boolean
  /** 仅 HTTPS（生产环境） */
  secure: boolean
  /** SameSite 策略 */
  sameSite: "lax" | "strict" | "none"
  /** 有效期（秒） */
  maxAge: number
  /** Cookie 路径 */
  path: string
}

/**
 * 获取会话令牌的安全 Cookie 配置
 *
 * @description
 * 自动根据开发/生产环境调整配置
 *
 * @returns Cookie 配置对象
 *
 * @example
 * ```typescript
 * import { cookies } from 'next/headers'
 * import { getSessionCookieOptions } from '@/lib/album-session'
 *
 * const cookieStore = await cookies()
 * const options = getSessionCookieOptions()
 * cookieStore.set('album-session', token, options)
 * ```
 */
export function getSessionCookieOptions(): AlbumSessionCookieOptions {
  const isProduction = process.env.NODE_ENV === "production"

  return {
    httpOnly: true, // 防止 XSS 访问
    secure: isProduction, // 生产环境仅 HTTPS
    sameSite: "lax", // CSRF 保护，同时允许正常导航
    maxAge: 24 * 60 * 60, // 24 小时（秒）
    path: "/", // 全站可用
  }
}
