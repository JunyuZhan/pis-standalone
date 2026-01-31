/**
 * Album Authorization Middleware
 *
 * Provides session-based authorization for password-protected albums.
 * Validates session tokens and enforces access control across all public APIs.
 *
 * Security Features:
 * - Session token validation
 * - Consistent error responses
 * - Security event logging
 * - Backward compatibility with public albums
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/database";
import {
  validateAlbumSessionToken,
  AlbumSessionData,
} from "@/lib/album-session";

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
 * Verify album authorization using session token
 *
 * @param request - Next.js request object
 * @param slug - Album slug
 * @returns Authorization result
 */
export async function verifyAlbumAuth(
  request: NextRequest,
  slug: string,
): Promise<AlbumAuthResult> {
  try {
    const db = await createClient();

    // Get album info
    const albumResult = await db
      .from("albums")
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
 * Check if album access requires authentication
 */
export function albumRequiresAuth(album: {
  password?: string | null;
}): boolean {
  return !!album.password;
}
