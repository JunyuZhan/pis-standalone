/**
 * @fileoverview 测试夹具 - 认证 mock
 * 
 * 提供认证相关的 mock 函数，简化 API 测试
 */

import { vi, beforeEach } from 'vitest'

/**
 * 设置认证 mock
 * 
 * @param options - 配置选项
 * @param options.userId - 默认用户 ID
 * @param options.email - 默认用户邮箱
 * @param options.isAuthenticated - 是否已认证（默认 true）
 * @returns cleanup 函数
 */
export function setupAuthMock(options: {
  userId?: string
  email?: string
  isAuthenticated?: boolean
} = {}): () => void {
  const {
    userId = 'test-user-123',
    email = 'test@example.com',
    isAuthenticated = true,
  } = options

  // Mock getUserFromRequest
  const getUserFromRequest = vi.fn()
  
  if (isAuthenticated) {
    getUserFromRequest.mockResolvedValue({
      id: userId,
      email: email,
    })
  } else {
    getUserFromRequest.mockResolvedValue(null)
  }

  // Mock jwt-helpers module
  vi.doMock('@/lib/auth/jwt-helpers', () => ({
    getUserFromRequest,
    updateSessionMiddleware: vi.fn().mockResolvedValue(new Response(null)),
  }))

  // Also mock the index re-export
  vi.doMock('@/lib/auth', () => ({
    getUserFromRequest,
    updateSessionMiddleware: vi.fn().mockResolvedValue(new Response(null)),
    getCurrentUser: isAuthenticated 
      ? vi.fn().mockResolvedValue({ id: userId, email })
      : vi.fn().mockResolvedValue(null),
    createAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
    createRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
    verifyToken: vi.fn().mockResolvedValue({
      sub: userId,
      email: email,
      type: 'access',
    }),
    COOKIE_NAME: 'pis-auth-token',
    REFRESH_COOKIE_NAME: 'pis-refresh-token',
  }))

  return () => {
    vi.clearAllMocks()
  }
}

/**
 * 设置未认证状态
 */
export function setupUnauthenticatedMock(): () => void {
  return setupAuthMock({ isAuthenticated: false })
}

/**
 * 快速设置已认证请求的辅助函数
 * 
 * @example
 * ```typescript
 * const { mockGetUser } = setupQuickAuth(request)
 * mockGetUser.mockResolvedValue({ id: 'custom-user', email: 'custom@example.com' })
 * ```
 */
export function setupQuickAuth(request: { headers: { get: (name: string) => string | null } }): {
  mockGetUser: ReturnType<typeof vi.fn>
} {
  const mockGetUser = vi.fn().mockResolvedValue({
    id: 'test-user-123',
    email: 'test@example.com',
  })

  // 替换 getUserFromRequest 函数
  vi.doMock('@/lib/auth/jwt-helpers', () => ({
    getUserFromRequest: mockGetUser,
    updateSessionMiddleware: vi.fn().mockResolvedValue(new Response(null)),
  }))

  return { mockGetUser }
}
