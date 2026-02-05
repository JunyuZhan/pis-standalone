/**
 * 公开相册照片列表 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
const { mockSupabaseClient } = vi.hoisted(() => {
  return {
    mockSupabaseClient: {
      from: vi.fn(),
    }
  }
})

vi.mock('@/lib/database', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  createAdminClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}))

describe('GET /api/public/albums/[slug]/photos', () => {
  let mockSupabaseClient: any

  const validAlbumId = '550e8400-e29b-41d4-a716-446655440000'
  const validGroupId = '550e8400-e29b-41d4-a716-446655440001'
  const validPhotoId1 = '550e8400-e29b-41d4-a716-446655440002'
  const validPhotoId2 = '550e8400-e29b-41d4-a716-446655440003'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    mockSupabaseClient = await createClient()
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }
      mockSupabaseClient.from.mockReturnValue(mockChain)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if allow_share is false', async () => {
      const mockAlbum = {
        id: validAlbumId,
        allow_share: false,
      }

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockAlbum,
          error: null,
        }),
      }
      mockSupabaseClient.from.mockReturnValue(mockChain)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album is expired', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1)

      const mockAlbum = {
        id: validAlbumId,
        allow_share: true,
        expires_at: expiredDate.toISOString(),
      }

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockAlbum,
          error: null,
        }),
      }
      mockSupabaseClient.from.mockReturnValue(mockChain)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('pagination', () => {
    it('should return photos with default pagination', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: 'capture_desc',
        allow_share: true,
        expires_at: null,
      }

      const mockPhotos = [
        { id: validPhotoId1, filename: 'photo1.jpg' },
        { id: validPhotoId2, filename: 'photo2.jpg' },
      ]

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({
          data: mockPhotos,
          error: null,
          count: 2,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ...mockAlbum, is_public: true },
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return mockPhotosChain
        }
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photos).toHaveLength(2)
      expect(data.photos[0].id).toBe(validPhotoId1)
      expect(data.photos[0].filename).toBe('photo1.jpg')
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.total).toBe(2)
    })

    it('should handle custom pagination parameters', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: 'capture_desc',
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({
          data: [],
          error: null,
          count: 100,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAlbum,
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return mockPhotosChain
        }
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos?page=2&limit=30')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(30)
      expect(data.pagination.totalPages).toBe(4)
    })
  })

  describe('sorting', () => {
    it('should sort by capture_desc by default', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({
          data: [],
          error: null,
          count: 0,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAlbum,
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return mockPhotosChain
        }
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(mockPhotosChain.order).toHaveBeenCalledWith('captured_at', { ascending: false })
    })

    it('should sort by capture_asc when specified', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({
          data: [],
          error: null,
          count: 0,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAlbum,
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return mockPhotosChain
        }
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos?sort=capture_asc')
      await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(mockPhotosChain.order).toHaveBeenCalledWith('captured_at', { ascending: true })
    })

    it('should sort by manual when specified', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({
          data: [],
          error: null,
          count: 0,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAlbum,
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return mockPhotosChain
        }
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos?sort=manual')
      await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(mockPhotosChain.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    })
  })

  describe('group filtering', () => {
    it('should return empty result if group has no photos', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: null,
        allow_share: true,
        expires_at: null,
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAlbum,
              error: null,
            }),
          }
        }
        if (table === 'photo_group_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }
        }
        return {}
      })

      const request = createMockRequest(`http://localhost:3000/api/public/albums/test-slug/photos?group=${validGroupId}`)
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photos).toEqual([])
      expect(data.pagination.total).toBe(0)
    })

    it('should filter photos by group when group specified', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockAssignments = [
        { photo_id: validPhotoId1 },
        { photo_id: validPhotoId2 },
      ]

      const mockPhotos = [
        { id: validPhotoId1, filename: 'photo1.jpg' },
        { id: validPhotoId2, filename: 'photo2.jpg' },
      ]

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({
          data: mockPhotos,
          error: null,
          count: 2,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAlbum,
              error: null,
            }),
          }
        }
        if (table === 'photo_group_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockAssignments,
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return mockPhotosChain
        }
        return {}
      })

      const request = createMockRequest(`http://localhost:3000/api/public/albums/test-slug/photos?group=${validGroupId}`)
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photos).toHaveLength(2)
      expect(data.photos[0].id).toBe(validPhotoId1)
      expect(data.photos[0].filename).toBe('photo1.jpg')
      expect(mockPhotosChain.in).toHaveBeenCalledWith('id', [validPhotoId1, validPhotoId2])
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error', async () => {
      const mockAlbum = {
        id: validAlbumId,
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({
          data: null,
          error: { message: 'Database error' },
          count: null,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAlbum,
              error: null,
            }),
          }
        }
        if (table === 'photos') {
          return mockPhotosChain
        }
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(['DB_ERROR', 'INTERNAL_ERROR']).toContain(data.error.code)
    })
  })
})
