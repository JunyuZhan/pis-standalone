/**
 * 公开相册照片列表 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
  }

  return {
    createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  }
})

describe('GET /api/public/albums/[slug]/photos', () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    mockSupabaseClient = await createClient()
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('ALBUM_NOT_FOUND')
    })

    it('should return 404 if allow_share is false', async () => {
      const mockAlbum = {
        id: 'album-123',
        allow_share: false,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('ALBUM_NOT_FOUND')
    })

    it('should return 403 if album is expired', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1)

      const mockAlbum = {
        id: 'album-123',
        allow_share: true,
        expires_at: expiredDate.toISOString(),
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('EXPIRED')
    })
  })

  describe('pagination', () => {
    it('should return photos with default pagination', async () => {
      const mockAlbum = {
        id: 'album-123',
        sort_rule: 'capture_desc',
        allow_share: true,
        expires_at: null,
      }

      const mockPhotos = [
        { id: 'photo-1', filename: 'photo1.jpg' },
        { id: 'photo-2', filename: 'photo2.jpg' },
      ]

      // Mock album query
      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: { ...mockAlbum, is_public: true },
        error: null,
      })

      // Mock photos query - 使用链式调用mock
      const mockQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
      }

      mockQuery.select.mockReturnValue(mockQuery)
      mockQuery.eq.mockReturnValue(mockQuery)
      mockQuery.is.mockReturnValue(mockQuery)
      mockQuery.order.mockReturnValue(mockQuery)
      mockQuery.range.mockResolvedValue({
        data: mockPhotos,
        error: null,
        count: 2,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photos).toHaveLength(2)
      expect(data.photos[0].id).toBe('photo-1')
      expect(data.photos[0].filename).toBe('photo1.jpg')
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.total).toBe(2)
    })

    it('should handle custom pagination parameters', async () => {
      const mockAlbum = {
        id: 'album-123',
        sort_rule: 'capture_desc',
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      // 创建链式调用的mock对象
      const mockQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
      }

      mockQuery.select.mockReturnValue(mockQuery)
      mockQuery.eq.mockReturnValue(mockQuery)
      mockQuery.is.mockReturnValue(mockQuery)
      mockQuery.order.mockReturnValue(mockQuery)
      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 100,
      })

      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce(mockQuery)

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
        id: 'album-123',
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
      }

      mockQuery.select.mockReturnValue(mockQuery)
      mockQuery.eq.mockReturnValue(mockQuery)
      mockQuery.is.mockReturnValue(mockQuery)
      mockQuery.order.mockReturnValue(mockQuery)
      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      })

      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(mockQuery.order).toHaveBeenCalledWith('captured_at', { ascending: false })
    })

    it('should sort by capture_asc when specified', async () => {
      const mockAlbum = {
        id: 'album-123',
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
      }

      mockQuery.select.mockReturnValue(mockQuery)
      mockQuery.eq.mockReturnValue(mockQuery)
      mockQuery.is.mockReturnValue(mockQuery)
      mockQuery.order.mockReturnValue(mockQuery)
      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      })

      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos?sort=capture_asc')
      await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(mockQuery.order).toHaveBeenCalledWith('captured_at', { ascending: true })
    })

    it('should sort by manual when specified', async () => {
      const mockAlbum = {
        id: 'album-123',
        sort_rule: null,
        allow_share: true,
        expires_at: null,
        is_public: true,
      }

      const mockQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
      }

      mockQuery.select.mockReturnValue(mockQuery)
      mockQuery.eq.mockReturnValue(mockQuery)
      mockQuery.is.mockReturnValue(mockQuery)
      mockQuery.order.mockReturnValue(mockQuery)
      mockQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      })

      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce(mockQuery)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos?sort=manual')
      await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(mockQuery.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    })
  })

  describe('group filtering', () => {
    it('should return empty result if group has no photos', async () => {
      const mockAlbum = {
        id: 'album-123',
        sort_rule: null,
        allow_share: true,
        expires_at: null,
      }

      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockAssignmentsSelect = vi.fn().mockReturnThis()
      const mockAssignmentsEq = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce({
          select: mockAssignmentsSelect,
          eq: mockAssignmentsEq,
        })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos?group=group-123')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photos).toEqual([])
      expect(data.pagination.total).toBe(0)
    })

    it('should filter photos by group when group specified', async () => {
      const mockAlbum = {
        id: 'album-123',
        sort_rule: null,
        allow_share: true,
        expires_at: null,
      }

      const mockAssignments = [
        { photo_id: 'photo-1' },
        { photo_id: 'photo-2' },
      ]

      const mockPhotos = [
        { id: 'photo-1', filename: 'photo1.jpg' },
        { id: 'photo-2', filename: 'photo2.jpg' },
      ]

      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockAssignmentsSelect = vi.fn().mockReturnThis()
      const mockAssignmentsEq = vi.fn().mockResolvedValue({
        data: mockAssignments,
        error: null,
      })

      const mockPhotosIn = vi.fn().mockReturnThis()
      const mockPhotosIs = vi.fn().mockReturnThis()
      const mockPhotosEq = vi.fn().mockReturnThis()
      const mockPhotosOrder = vi.fn().mockReturnThis()
      const mockPhotosRange = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
        count: 2,
      })

      const mockPhotosSelect = vi.fn().mockReturnValue({
        eq: mockPhotosEq,
        is: mockPhotosIs,
        in: mockPhotosIn,
        order: mockPhotosOrder,
        range: mockPhotosRange,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce({
          select: mockAssignmentsSelect,
          eq: mockAssignmentsEq,
        })
        .mockReturnValueOnce({
          select: mockPhotosSelect,
          eq: mockPhotosEq,
          is: mockPhotosIs,
          in: mockPhotosIn,
          order: mockPhotosOrder,
          range: mockPhotosRange,
        })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos?group=group-123')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photos).toHaveLength(2)
      expect(data.photos[0].id).toBe('photo-1')
      expect(data.photos[0].filename).toBe('photo1.jpg')
      expect(mockPhotosIn).toHaveBeenCalledWith('id', ['photo-1', 'photo-2'])
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
        id: 'album-123',
        sort_rule: null,
        allow_share: true,
        expires_at: null,
      }

      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumEq = vi.fn().mockReturnThis()
      const mockAlbumSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockPhotosSelect = vi.fn().mockReturnThis()
      const mockPhotosEq = vi.fn().mockReturnThis()
      const mockPhotosIs = vi.fn().mockReturnThis()
      const mockPhotosOrder = vi.fn().mockReturnThis()
      const mockPhotosRange = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
        count: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockAlbumSelect,
          eq: mockAlbumEq,
          single: mockAlbumSingle,
        })
        .mockReturnValueOnce({
          select: mockPhotosSelect,
          eq: mockPhotosEq,
          is: mockPhotosIs,
          order: mockPhotosOrder,
          range: mockPhotosRange,
        })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/photos')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })
})
