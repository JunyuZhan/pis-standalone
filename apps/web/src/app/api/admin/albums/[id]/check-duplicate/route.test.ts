/**
 * 检查重复文件 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('POST /api/admin/albums/[id]/check-duplicate', () => {
  let mockDb: any
  let mockAdminDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    mockAdminDb = createMockDatabaseClient()
    
    vi.mocked(createClient).mockResolvedValue(mockDb)
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
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
        'http://localhost:3000/api/admin/albums/album-123/check-duplicate',
        {
          method: 'POST',
          body: {
            filename: 'test.jpg',
            fileSize: 1024,
          },
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
        'http://localhost:3000/api/admin/albums/invalid-id/check-duplicate',
        {
          method: 'POST',
          body: {
            filename: 'test.jpg',
            fileSize: 1024,
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing required fields', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/album-123/check-duplicate',
        {
          method: 'POST',
          body: {},
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
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
        'http://localhost:3000/api/admin/albums/550e8400-e29b-41d4-a716-446655440000/check-duplicate',
        {
          method: 'POST',
          body: {
            filename: 'test.jpg',
            fileSize: 1024,
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('duplicate detection', () => {
    it('should return isDuplicate=false when no duplicate found', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      
      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: albumId },
        error: null,
      })

      mockDb.from.mockReturnValueOnce({
        select: mockSelectAlbum,
        eq: mockEqAlbum,
        is: mockIsAlbum,
        single: mockSingleAlbum,
      })

      // Mock no duplicate found
      const mockSelectPhoto = vi.fn().mockReturnThis()
      const mockEqPhoto = vi.fn().mockReturnThis()
      const mockIsPhoto = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockAdminDb.from.mockReturnValue({
        select: mockSelectPhoto,
        eq: mockEqPhoto,
        is: mockIsPhoto,
        limit: mockLimit,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/check-duplicate`,
        {
          method: 'POST',
          body: {
            filename: 'test.jpg',
            fileSize: 1024,
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.isDuplicate).toBe(false)
      expect(data.duplicatePhoto).toBe(null)
    })

    it('should return isDuplicate=true when duplicate found', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const duplicatePhoto = {
        id: 'photo-123',
        filename: 'test.jpg',
        file_size: 1024,
      }
      
      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: albumId },
        error: null,
      })

      mockDb.from.mockReturnValueOnce({
        select: mockSelectAlbum,
        eq: mockEqAlbum,
        is: mockIsAlbum,
        single: mockSingleAlbum,
      })

      // Mock duplicate found
      const mockSelectPhoto = vi.fn().mockReturnThis()
      const mockEqPhoto = vi.fn().mockReturnThis()
      const mockIsPhoto = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockResolvedValue({
        data: [duplicatePhoto],
        error: null,
      })

      mockAdminDb.from.mockReturnValue({
        select: mockSelectPhoto,
        eq: mockEqPhoto,
        is: mockIsPhoto,
        limit: mockLimit,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/check-duplicate`,
        {
          method: 'POST',
          body: {
            filename: 'test.jpg',
            fileSize: 1024,
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.isDuplicate).toBe(true)
      expect(data.duplicatePhoto).toEqual(duplicatePhoto)
    })
  })
})
