/**
 * 重新处理相册 API 路由测试
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

// Mock fetch for internal API call
global.fetch = vi.fn()

describe('POST /api/admin/albums/[id]/reprocess', () => {
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
        'http://localhost:3000/api/admin/albums/550e8400-e29b-41d4-a716-446655440000/reprocess',
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
        'http://localhost:3000/api/admin/albums/invalid-id/reprocess',
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
        `http://localhost:3000/api/admin/albums/${albumId}/reprocess`,
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

  describe('reprocess', () => {
    it('should successfully reprocess album photos', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        photo_count: 10,
      }
      const photos = [
        { id: 'photo-1', album_id: albumId, original_key: 'key1', status: 'completed' },
        { id: 'photo-2', album_id: albumId, original_key: 'key2', status: 'completed' },
        { id: 'photo-3', album_id: albumId, original_key: 'key3', status: 'failed' },
      ]
      const reprocessResponse = {
        message: '已加入处理队列',
        total: 3,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock photos query
      const mockSelectPhotos = vi.fn().mockReturnThis()
      const mockEqPhotos = vi.fn().mockReturnThis()
      const mockInPhotos = vi.fn().mockReturnThis()
      const mockNotPhotos = vi.fn().mockReturnThis()
      const mockIsPhotos = vi.fn().mockResolvedValue({
        data: photos,
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          is: mockIsAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectPhotos,
          eq: mockEqPhotos,
          in: mockInPhotos,
          not: mockNotPhotos,
          is: mockIsPhotos,
        })

      // Mock internal reprocess API call
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => reprocessResponse,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/reprocess`,
        {
          method: 'POST',
          body: {
            apply_color_grading: true,
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('已加入处理队列')
      expect(data.total_photos).toBe(3)
      expect(data.estimated_time).toBeDefined()
    })

    it('should return 400 if no photos to reprocess', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        photo_count: 0,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock no photos
      const mockSelectPhotos = vi.fn().mockReturnThis()
      const mockEqPhotos = vi.fn().mockReturnThis()
      const mockInPhotos = vi.fn().mockReturnThis()
      const mockNotPhotos = vi.fn().mockReturnThis()
      const mockIsPhotos = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          is: mockIsAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectPhotos,
          eq: mockEqPhotos,
          in: mockInPhotos,
          not: mockNotPhotos,
          is: mockIsPhotos,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/reprocess`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('没有需要重新处理的照片')
    })

    it('should handle empty request body with defaults', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        photo_count: 5,
      }
      const photos = [
        { id: 'photo-1', album_id: albumId, original_key: 'key1', status: 'completed' },
      ]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock photos query
      const mockSelectPhotos = vi.fn().mockReturnThis()
      const mockEqPhotos = vi.fn().mockReturnThis()
      const mockInPhotos = vi.fn().mockReturnThis()
      const mockNotPhotos = vi.fn().mockReturnThis()
      const mockIsPhotos = vi.fn().mockResolvedValue({
        data: photos,
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          is: mockIsAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectPhotos,
          eq: mockEqPhotos,
          in: mockInPhotos,
          not: mockNotPhotos,
          is: mockIsPhotos,
        })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: '已加入处理队列' }),
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/reprocess`,
        {
          method: 'POST',
          body: '',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('已加入处理队列')
    })
  })
})
