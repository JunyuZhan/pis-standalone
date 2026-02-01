/**
 * @fileoverview 相册认证中间件
 *
 * 为密码保护的相册提供基于会话的授权验证。
 * 验证会话令牌并在所有公共 API 上强制执行访问控制。
 *
 * 安全特性：
 * - 会话令牌验证
 * - 统一的错误响应
 * - 安全事件日志记录
 * - 向后兼容公共相册
 *
 * @module lib/middleware/album-auth
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/database";
import {
  validateAlbumSessionToken,
  AlbumSessionData,
} from "@/lib/album-session";

/**
 * 相册认证结果接口
 *
 * @interface
 * @template {Object} AlbumAuthResult
 * @property {boolean} authorized - 是否已授权
 * @property {Object} [album] - 相册信息
 * @property {string} album.id - 相册 ID
 * @property {string} album.slug - 相册 slug
 * @property {string|null} [album.password] - 相册密码
 * @property {string|null} [album.expires_at] - 过期时间
 * @property {AlbumSessionData} [sessionData] - 会话数据
 * @property {Object} [error] - 错误信息
 * @property {string} error.code - 错误代码
 * @property {string} error.message - 错误消息
 */
export interface AlbumAuthResult {
  authorized: boolean;
  album?: {
    id: string;
    slug: string;
    password?: string | null;
    expires_at?: string | null;
  };
  sessionData?: AlbumSessionData;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 使用会话令牌验证相册授权
 *
 * @description
 * 执行以下验证步骤：
 * 1. 查询相册信息（包括密码和过期时间）
 * 2. 检查相册是否已过期
 * 3. 如果无密码，允许公共访问
 * 4. 如果有密码，验证会话令牌
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @param {string} slug - 相册 slug
 * @returns {Promise<AlbumAuthResult>} 认证结果对象
 *
 * @example
 * ```typescript
 * const result = await verifyAlbumAuth(request, 'summer-vacation')
 * if (result.authorized) {
 *   console.log('已授权访问相册:', result.album?.id)
 * } else {
 *   console.log('访问被拒绝:', result.error?.message)
 * }
 * ```
 */
export async function verifyAlbumAuth(
  request: NextRequest,
  slug: string,
): Promise<AlbumAuthResult> {
  try {
    const db = await createClient();

    // Get album info
    const albumResult = await db
      .from<{ id: string; slug: string; password: string | null; expires_at: string | null; deleted_at: string | null }>("albums")
      .select("id, slug, password, expires_at, deleted_at")
      .eq("slug", slug)
      .single();

    if (albumResult.error || !albumResult.data || albumResult.data.deleted_at) {
      return {
        authorized: false,
        error: {
          code: "ALBUM_NOT_FOUND",
          message: "相册不存在",
        },
      };
    }

    const album = albumResult.data

    // Check if album has expired
    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return {
        authorized: false,
        error: {
          code: "ALBUM_EXPIRED",
          message: "相册已过期",
        },
      };
    }

    // If no password is set, album is publicly accessible
    if (!album.password) {
      return {
        authorized: true,
        album: {
          id: album.id,
          slug: album.slug,
          password: album.password,
          expires_at: album.expires_at,
        },
      };
    }

    // Check for session token in cookie
    const sessionToken = request.cookies.get(`album_session_${slug}`)?.value;

    if (!sessionToken) {
      return {
        authorized: false,
        error: {
          code: "SESSION_REQUIRED",
          message: "需要输入密码访问此相册",
        },
      };
    }

    // Validate session token
    const validationResult = validateAlbumSessionToken(sessionToken);

    if (!validationResult) {
      return {
        authorized: false,
        error: {
          code: "SESSION_INVALID",
          message: "会话无效，请重新输入密码",
        },
      };
    }

    // Session is valid
    return {
      authorized: true,
      album: {
        id: album.id,
        slug: album.slug,
        password: album.password,
        expires_at: album.expires_at,
      },
      sessionData: validationResult,
    };
  } catch (error) {
    console.error("[Album Auth] Verification error:", error);
    return {
      authorized: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "验证服务暂时不可用",
      },
    };
  }
}

/**
 * 检查相册访问是否需要认证
 *
 * @param {Object} album - 相册对象
 * @param {string|null} [album.password] - 相册密码
 * @returns {boolean} 需要认证返回 true
 *
 * @example
 * ```typescript
 * if (albumRequiresAuth(album)) {
 *   // 显示密码输入界面
 * }
 * ```
 */
export function albumRequiresAuth(album: {
  password?: string | null;
}): boolean {
  return !!album.password;
}
