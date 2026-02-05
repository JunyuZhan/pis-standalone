/**
 * 照片处理触发 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
// Mock Database
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

// Mock JWT authentication
vi.mock('@/lib/auth/jwt-helpers', async () => {
  const mockGetUserFromRequest = vi.fn()
  return {
    getUserFromRequest: mockGetUserFromRequest,
    updateSessionMiddleware: vi.fn().mockResolvedValue(new Response(null)),
  }
})

// Mock global fetch
global.fetch = vi.fn()

// Mock global fetch
global.fetch = vi.fn()

describe('POST /api/admin/photos/process', () => {
  let mockSupabaseClient: any
  let mockGetUserFromRequest: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup Database mock
    mockSupabaseClient = {
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
    }
    const { createClient } = await import('@/lib/database')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)

    // 导入 mock
    const { getUserFromRequest } = await import('@/lib/auth/jwt-helpers')
    mockGetUserFromRequest = getUserFromRequest
    
    // 默认用户已登录
    mockGetUserFromRequest.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
    })

    // 默认fetch成功
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetUserFromRequest.mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          albumId: '11111111-1111-1111-1111-111111111111',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing photoId', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          albumId: '11111111-1111-1111-1111-111111111111',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      // expect(data.error.message).toContain('缺少必要参数') // Zod default message might vary
    })

    it('should return 400 for missing albumId', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing originalKey', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          albumId: '11111111-1111-1111-1111-111111111111',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('worker API call', () => {
    it('should call worker proxy API successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          albumId: '11111111-1111-1111-1111-111111111111',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(global.fetch).toHaveBeenCalled()
      
      // 验证调用了正确的代理 URL
      const fetchCall = (global.fetch as any).mock.calls[0]
      expect(fetchCall[0]).toContain('/api/worker/process')
    })

    it('should handle worker API error gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Worker error',
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          albumId: '11111111-1111-1111-1111-111111111111',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // Worker 错误时返回 202 Accepted（请求已接受，但处理尚未完成）
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.warning).toBeDefined()
      expect(data.warning.code).toBe('WORKER_UNAVAILABLE')
    })

    it('should handle worker API network error gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          albumId: '11111111-1111-1111-1111-111111111111',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // 网络错误时返回 202 Accepted（请求已接受，但处理尚未完成）
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.warning).toBeDefined()
      expect(data.warning.code).toBe('WORKER_UNAVAILABLE')
    })

    it('should pass cookie header to worker API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        headers: {
          cookie: 'session=abc123',
        },
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          albumId: '11111111-1111-1111-1111-111111111111',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      
      // 验证 cookie 被传递
      const fetchCall = (global.fetch as any).mock.calls[0]
      const fetchOptions = fetchCall[1]
      expect(fetchOptions.headers['cookie']).toBe('session=abc123')
    })
  })

  describe('error handling', () => {
    it('should return 500 on unexpected error', async () => {
      // Mock getUser to throw error
      mockGetUserFromRequest.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/process', {
        method: 'POST',
        body: {
          photoId: '22222222-2222-2222-2222-222222222222',
          albumId: '11111111-1111-1111-1111-111111111111',
          originalKey: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
