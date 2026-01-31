/**
 * 获取当前用户 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}))

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('user retrieval', () => {
    it('should return user if token is valid', async () => {
      const { cookies } = await import('next/headers')
      const { jwtVerify } = await import('jose')

      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({
          value: 'valid-token',
        }),
      } as any)

      vi.mocked(jwtVerify).mockResolvedValue({
        payload: {
          sub: 'user-123',
          email: 'test@example.com',
        },
      } as any)

      const request = createMockRequest('http://localhost:3000/api/auth/me')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user.id).toBe('user-123')
      expect(data.data.user.email).toBe('test@example.com')
    })

    it('should return null user if token is missing', async () => {
      const { cookies } = await import('next/headers')

      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as any)

      const request = createMockRequest('http://localhost:3000/api/auth/me')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user).toBe(null)
    })

    it('should return null user if token is invalid', async () => {
      const { cookies } = await import('next/headers')
      const { jwtVerify } = await import('jose')

      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({
          value: 'invalid-token',
        }),
      } as any)

      vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'))

      const request = createMockRequest('http://localhost:3000/api/auth/me')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user).toBe(null)
    })

    it('should handle errors gracefully', async () => {
      const { cookies } = await import('next/headers')

      vi.mocked(cookies).mockRejectedValue(new Error('Cookie error'))

      const request = createMockRequest('http://localhost:3000/api/auth/me')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user).toBe(null)
    })
  })
})
