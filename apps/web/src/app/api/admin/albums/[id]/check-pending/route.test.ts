/**
 * 检查待处理照片 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock fetch for worker proxy call
global.fetch = vi.fn()

describe('POST /api/admin/albums/[id]/check-pending', () => {
  let mockGetCurrentUser: any
  let mockFetch: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    mockFetch = vi.mocked(global.fetch)
    
    // 默认用户已登录
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/album-123/check-pending',
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: 'album-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid album ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/invalid-id/check-pending',
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('worker proxy', () => {
    it('should proxy request to worker and return result', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const workerResponse = {
        success: true,
        processed: 5,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => workerResponse,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/check-pending`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(workerResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/worker/check-pending',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should return error when worker returns error', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Worker error',
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/check-pending`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
