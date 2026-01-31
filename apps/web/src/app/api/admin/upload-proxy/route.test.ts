/**
 * 上传代理 API 路由测试
 * 
 * 测试 PUT 和 OPTIONS 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT, OPTIONS } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock fetch for worker call
global.fetch = vi.fn()

describe('PUT /api/admin/upload-proxy', () => {
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
        'http://localhost:3000/api/admin/upload-proxy?key=test-key',
        {
          method: 'PUT',
          body: 'test file content',
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for missing key parameter', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/upload-proxy',
        {
          method: 'PUT',
          body: 'test file content',
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for empty key parameter', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/upload-proxy?key=',
        {
          method: 'PUT',
          body: 'test file content',
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('upload proxy', () => {
    it('should successfully proxy upload to worker', async () => {
      const key = 'raw/album-123/photo.jpg'
      const workerResponse = {
        success: true,
        key,
        url: 'https://example.com/file.jpg',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => workerResponse,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/upload-proxy?key=${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': '1024',
          },
          body: 'test file content',
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(workerResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/upload?key=${encodeURIComponent(key)}`),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'image/jpeg',
            'Content-Length': '1024',
          }),
        })
      )
    })

    it('should return error when worker returns error', async () => {
      const key = 'raw/album-123/photo.jpg'

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Worker error',
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/upload-proxy?key=${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          body: 'test file content',
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should handle connection errors gracefully', async () => {
      const key = 'raw/album-123/photo.jpg'

      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

      const request = createMockRequest(
        `http://localhost:3000/api/admin/upload-proxy?key=${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          body: 'test file content',
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      // Should return success with warning (file may have been uploaded)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.key).toBe(key)
      expect(data.warning).toBeDefined()
    })

    it('should handle timeout errors gracefully', async () => {
      const key = 'raw/album-123/photo.jpg'

      mockFetch.mockRejectedValue(new Error('Timeout'))

      const request = createMockRequest(
        `http://localhost:3000/api/admin/upload-proxy?key=${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Length': '10485760', // 10MB
          },
          body: 'test file content',
        }
      )

      const response = await PUT(request)
      const data = await response.json()

      // Should return success with warning
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.warning).toBeDefined()
    })

    it('should include API key in headers when available', async () => {
      const key = 'raw/album-123/photo.jpg'
      const originalApiKey = process.env.WORKER_API_KEY
      process.env.WORKER_API_KEY = 'test-api-key'

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/upload-proxy?key=${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          body: 'test file content',
        }
      )

      await PUT(request)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      )

      // Restore original value
      if (originalApiKey) {
        process.env.WORKER_API_KEY = originalApiKey
      } else {
        delete process.env.WORKER_API_KEY
      }
    })
  })
})

describe('OPTIONS /api/admin/upload-proxy', () => {
  it('should return CORS headers', async () => {
    const response = await OPTIONS()

    expect(response.status).toBe(204)
    const headers = response.headers
    expect(headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(headers.get('Access-Control-Allow-Methods')).toBe('PUT, OPTIONS')
    expect(headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })
})
