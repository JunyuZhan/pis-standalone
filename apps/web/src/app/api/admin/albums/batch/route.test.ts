/**
 * 批量操作相册 API 路由测试
 * 
 * 测试 DELETE 和 PATCH 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE, PATCH } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('DELETE /api/admin/albums/batch', () => {
  let mockDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        { method: 'DELETE', body: { albumIds: ['album-1'], operation: 'delete' } }
      )

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid request body', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        { method: 'DELETE', body: {} }
      )

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid operation', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        { method: 'DELETE', body: { albumIds: ['album-1'], operation: 'invalid' } }
      )

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('BAD_REQUEST')
    })
  })

  describe('batch deletion', () => {
    it('should delete albums successfully', async () => {
      const albumIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ]
      const albums = [
        { id: albumIds[0], title: 'Album 1' },
        { id: albumIds[1], title: 'Album 2' },
      ]

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: albums,
          error: null,
        }),
      })

      mockDb.update.mockResolvedValue({
        data: [{ id: albumIds[0] }],
        error: null,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        { method: 'DELETE', body: { albumIds, operation: 'delete' } }
      )

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deletedCount).toBe(2)
    })

    it('should return 404 if no valid albums found', async () => {
      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        { method: 'DELETE', body: { albumIds: ['album-1'], operation: 'delete' } }
      )

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})

describe('PATCH /api/admin/albums/batch', () => {
  let mockDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        { method: 'PATCH', body: { albumIds: ['album-1'], updates: {} } }
      )

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid request body', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        { method: 'PATCH', body: {} }
      )

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('batch update', () => {
    it('should update albums successfully', async () => {
      const albumIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ]

      mockDb.update.mockResolvedValue({
        data: [{ id: albumIds[0] }],
        error: null,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        {
          method: 'PATCH',
          body: {
            albumIds,
            updates: {
              is_public: true,
              layout: 'grid',
            },
          },
        }
      )

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.updatedCount).toBe(2)
    })

    it('should update only provided fields', async () => {
      const albumIds = ['550e8400-e29b-41d4-a716-446655440000']

      mockDb.update.mockResolvedValue({
        data: [{ id: albumIds[0] }],
        error: null,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/batch',
        {
          method: 'PATCH',
          body: {
            albumIds,
            updates: {
              is_public: false,
            },
          },
        }
      )

      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
