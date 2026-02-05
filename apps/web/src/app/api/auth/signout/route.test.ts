/**
 * 登出 API 路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

// Mock dependencies - mock should be at top level
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

vi.mock('@/lib/auth', () => ({
  destroySession: vi.fn(),
}))

describe('POST /api/auth/signout', () => {
  let mockDestroySession: any

  beforeEach(async () => {
    vi.clearAllMocks()

    const { destroySession } = await import('@/lib/auth')
    mockDestroySession = vi.mocked(destroySession)
  })

  it('should sign out successfully', async () => {
    mockDestroySession.mockResolvedValue(undefined)

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockDestroySession).toHaveBeenCalled()
  })

  it('should handle signOut errors gracefully', async () => {
    mockDestroySession.mockRejectedValue(new Error('Sign out failed'))

    const response = await POST()
    const data = await response.json()

    // API 应返回 500 错误，因为我们通过 handleError 处理了错误
    expect(response.status).toBe(500)
    expect(data.success).toBe(undefined)
    expect(data.error).toBeDefined()
  })

  it('should handle signOut exceptions gracefully', async () => {
    mockDestroySession.mockRejectedValue(new Error('Unexpected error'))

    // signOut 抛出异常时，会被 catch 并通过 handleError 返回 500 响应
    const response = await POST()
    const data = await response.json()
    
    expect(response.status).toBe(500)
    expect(data.error.code).toBe('INTERNAL_ERROR')
  })
})
