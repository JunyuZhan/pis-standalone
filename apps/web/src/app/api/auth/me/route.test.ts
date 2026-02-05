/**
 * 获取当前用户 API 路由测试
 *
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("user retrieval", () => {
    it('should return user if token is valid', async () => {
      const { getCurrentUser } = await import('@/lib/auth')

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user.id).toBe('user-123')
      expect(data.data.user.email).toBe('test@example.com')
    })

    it('should return null user when unauthenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth')

      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user).toBe(null)
    })

    it('should handle errors gracefully', async () => {
      const { getCurrentUser } = await import('@/lib/auth')

      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Auth error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user).toBe(null)
    })
  })
})
