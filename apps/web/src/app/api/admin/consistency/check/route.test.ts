/**
 * 一致性检查 API 路由测试
 * 
 * 测试 POST 和 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock fetch for worker proxy call
global.fetch = vi.fn()

describe('POST /api/admin/consistency/check', () => {
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
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should use default values for empty request body', async () => {
      const workerResponse = {
        success: true,
        checked: 100,
        fixed: 0,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => workerResponse,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
          body: '',
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/worker/consistency/check',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            autoFix: false,
            deleteOrphanedFiles: false,
            deleteOrphanedRecords: false,
            batchSize: 100,
          }),
        })
      )
    })

    it('should return 400 if deleteOrphanedFiles is true without autoFix', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
          body: {
            autoFix: false,
            deleteOrphanedFiles: true,
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if deleteOrphanedRecords is true without autoFix', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
          body: {
            autoFix: false,
            deleteOrphanedRecords: true,
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should accept valid request with autoFix enabled', async () => {
      const workerResponse = {
        success: true,
        checked: 100,
        fixed: 5,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => workerResponse,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
          body: {
            autoFix: true,
            deleteOrphanedFiles: true,
            deleteOrphanedRecords: false,
            batchSize: 50,
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result).toEqual(workerResponse)
    })
  })

  describe('worker proxy', () => {
    it('should proxy request to worker and return result', async () => {
      const workerResponse = {
        success: true,
        checked: 100,
        fixed: 0,
        orphanedFiles: 2,
        orphanedRecords: 1,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => workerResponse,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
          body: {
            autoFix: false,
            batchSize: 100,
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result).toEqual(workerResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/worker/consistency/check',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should return error when worker returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Worker error',
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
          body: {
            autoFix: false,
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should handle worker unavailable error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

      const request = createMockRequest(
        'http://localhost:3000/api/admin/consistency/check',
        {
          method: 'POST',
          body: {
            autoFix: false,
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('GET /api/admin/consistency/check', () => {
  it('should return API documentation', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/admin/consistency/check'
    )

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.endpoint).toBe('/api/admin/consistency/check')
    expect(data.methods.POST).toBeDefined()
    expect(data.methods.POST.description).toBe('执行数据一致性检查')
  })
})
