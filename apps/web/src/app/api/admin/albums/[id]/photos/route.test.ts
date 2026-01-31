/**
 * 相册照片列表 API 路由测试
 * 
 * 测试 GET 和 DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, DELETE } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/cloudflare-purge', () => ({
  purgePhotoCache: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('GET /api/admin/albums/[id]/photos', () => {
  let mockDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
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
        'http://localhost:3000/api/admin/albums/album-123/photos'
      )

      const response = await GET(request, {
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
        'http://localhost:3000/api/admin/albums/invalid-id/photos'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('photo retrieval', () => {
    it('should return photos list with pagination', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
      }
      const photos = [
        {
          id: 'photo-1',
          album_id: albumId,
          original_key: 'original-1.jpg',
          preview_key: 'preview-1.jpg',
          thumb_key: 'thumb-1.jpg',
          filename: 'photo1.jpg',
          file_size: 1024,
          width: 1920,
          height: 1080,
          mime_type: 'image/jpeg',
          blur_data: null,
          exif: {},
          captured_at: '2024-01-01T00:00:00Z',
          status: 'completed',
          is_selected: true,
          sort_order: 1,
          rotation: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
        },
      ]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: mockSelectAlbum,
            eq: mockEqAlbum,
            is: mockIsAlbum,
            single: mockSingleAlbum,
          }
        }
        if (table === 'photos') {
          const mockSelectPhotos = vi.fn().mockReturnThis()
          const mockEqPhotos = vi.fn().mockReturnThis()
          const mockIsPhotos = vi.fn().mockReturnThis()
          const mockOrderPhotos = vi.fn().mockReturnThis()
          const mockLimitPhotos = vi.fn().mockReturnThis()
          const mockOffsetPhotos = vi.fn().mockResolvedValue({
            data: photos,
            error: null,
            count: 1,
          })

          return {
            select: mockSelectPhotos,
            eq: mockEqPhotos,
            is: mockIsPhotos,
            order: mockOrderPhotos,
            limit: mockLimitPhotos,
            offset: mockOffsetPhotos,
          }
        }
        return mockDb.from()
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/photos?page=1&limit=50`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.album.id).toBe(albumId)
      expect(data.data.photos).toHaveLength(1)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.limit).toBe(50)
    })

    it('should filter photos by status', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = { id: albumId, title: 'Test Album' }

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: album, error: null }),
          }
        }
        if (table === 'photos') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            }),
          }
        }
        return mockDb.from()
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/photos?status=completed`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })

      expect(response.status).toBe(200)
    })

    it('should return 404 if album does not exist', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/photos`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})

describe('DELETE /api/admin/albums/[id]/photos', () => {
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
        'http://localhost:3000/api/admin/albums/album-123/photos',
        { method: 'DELETE', body: { photoIds: ['photo-1'] } }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 if photoIds is missing', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/album-123/photos',
        { method: 'DELETE', body: {} }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if photoIds is empty', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/album-123/photos',
        { method: 'DELETE', body: { photoIds: [] } }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if too many photos', async () => {
      const photoIds = Array.from({ length: 101 }, (_, i) => `photo-${i}`)
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/album-123/photos',
        { method: 'DELETE', body: { photoIds } }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('photo deletion', () => {
    it('should delete photos successfully', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const photoIds = ['photo-1', 'photo-2']
      const album = {
        id: albumId,
        slug: 'test-album',
        cover_photo_id: null,
      }
      const photos = [
        {
          id: 'photo-1',
          original_key: 'original-1.jpg',
          thumb_key: 'thumb-1.jpg',
          preview_key: 'preview-1.jpg',
        },
        {
          id: 'photo-2',
          original_key: 'original-2.jpg',
          thumb_key: 'thumb-2.jpg',
          preview_key: 'preview-2.jpg',
        },
      ]

      let callCount = 0
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          callCount++
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: album,
                error: null,
              }),
            }
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { count: 0 },
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: photos,
              error: null,
            }),
          }
        }
        return mockDb.from()
      })

      mockDb.update.mockResolvedValue({
        data: [{ id: 'photo-1' }],
        error: null,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/photos`,
        { method: 'DELETE', body: { photoIds } }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.deletedCount).toBe(2)
    })

    it('should return 404 if album does not exist', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/photos`,
        { method: 'DELETE', body: { photoIds: ['photo-1'] } }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if no valid photos found', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        slug: 'test-album',
        cover_photo_id: null,
      }

      let callCount = 0
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: album,
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          callCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }
        }
        return mockDb.from()
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/photos`,
        { method: 'DELETE', body: { photoIds: ['photo-1'] } }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})
