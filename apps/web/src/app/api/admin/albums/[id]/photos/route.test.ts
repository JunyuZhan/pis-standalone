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
    mockDb.update = vi.fn().mockResolvedValue({ data: [], error: null })
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
          // Mock selected count query which calls select().eq().eq().eq().is().execute()
          // Mock list query which calls select().eq().order().order().limit().offset().is().execute()
          
          const mockExecute = vi.fn()
          
          // Use mockImplementationOnce for execute to distinguish calls if needed
          // But here we can just return based on what's called or use resolved value
          
          // Chain builder
          const builder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis(),
            execute: mockExecute,
          }

          // First call is for photos list
          mockExecute.mockResolvedValueOnce({
            data: photos,
            count: 1,
            error: null,
          })

          // Second call (if any) is for selected count
          mockExecute.mockResolvedValueOnce({
            data: photos, // Assuming same photos are selected
            count: 1,
            error: null,
          })

          return builder
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
      // data.success is not returned by createSuccessResponse
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
          const mockExecute = vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          })
          
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis(),
            execute: mockExecute,
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
      const photoIds = Array.from({ length: 101 }, (_, i) => `550e8400-e29b-41d4-a716-44665544${i.toString().padStart(4, '0')}`)
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
      const photoIds = ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']
      const album = {
        id: albumId,
        slug: 'test-album',
        cover_photo_id: null,
      }
      const photos = [
        {
          id: photoIds[0],
          original_key: 'original-1.jpg',
          thumb_key: 'thumb-1.jpg',
          preview_key: 'preview-1.jpg',
        },
        {
          id: photoIds[1],
          original_key: 'original-2.jpg',
          thumb_key: 'thumb-2.jpg',
          preview_key: 'preview-2.jpg',
        },
      ]

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
          // For deletion check: select().eq().is().in().execute()
          // For update: update().in()
          
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: photos,
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue({
              data: photos,
              count: 2,
              error: null,
            }), // Add update here
          }
        }
        return mockDb.from()
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
      
      // Verify db.update was called for each photo (2) + photo count update (1)
      expect(mockDb.update).toHaveBeenCalledTimes(3)
      // Verify update albums photo_count was called
      expect(mockDb.update).toHaveBeenCalledWith('albums', expect.objectContaining({ photo_count: expect.any(Number) }), { id: albumId })
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
        { method: 'DELETE', body: { photoIds: ['550e8400-e29b-41d4-a716-446655440001'] } }
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
        { method: 'DELETE', body: { photoIds: ['550e8400-e29b-41d4-a716-446655440001'] } }
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
