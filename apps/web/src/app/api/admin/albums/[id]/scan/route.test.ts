/**
 * 扫描相册 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock fetch for worker proxy call
global.fetch = vi.fn()

describe('POST /api/admin/albums/[id]/scan', () => {
  let mockDb: any
  let mockGetCurrentUser: any
  let mockFetch: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
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
        'http://localhost:3000/api/admin/albums/550e8400-e29b-41d4-a716-446655440000/scan',
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid album ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/invalid-id/scan',
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

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/scan`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('worker proxy', () => {
    it('should proxy request to worker and return result', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
      }
      const workerResponse = {
        success: true,
        scanned: 10,
        added: 5,
      }

      // Mock album exists
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => workerResponse,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/scan`,
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
        '/api/worker/scan',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ albumId }),
        })
      )
    })

    it('should return error when worker returns error', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
      }

      // Mock album exists
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Worker error' }),
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/scan`,
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
