/**
 * 公开相册信息 API 路由测试
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
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}))

describe('GET /api/public/albums/[slug]', () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    mockSupabaseClient = await createClient()
  })

  describe('album retrieval', () => {
    it('should return album information successfully', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        description: 'Test Description',
        layout: 'masonry',
        allow_download: true,
        show_exif: true,
        photo_count: 10,
        password: null,
        expires_at: null,
        is_public: true,
        allow_share: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('album-123')
      expect(data.title).toBe('Test Album')
      expect(data.requires_password).toBe(false)
      expect(data.is_public).toBe(true)
    })

    it('should return requires_password=true when password is set', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        password: 'secret',
        expires_at: null,
        is_public: false,
        allow_share: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.requires_password).toBe(true)
      expect(data.password).toBeUndefined() // 密码不应返回
    })

    it('should return 404 if album does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if album is deleted', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('access control', () => {
    it('should return 404 if allow_share is false', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_share: false,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album is expired', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1) // Yesterday

      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        expires_at: expiredDate.toISOString(),
        allow_share: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('已过期')
    })

    it('should allow access if album is not expired', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1) // Tomorrow

      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        expires_at: futureDate.toISOString(),
        allow_share: true,
        is_public: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('album-123')
    })
  })

  describe('caching', () => {
    it('should set public cache headers for public albums', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        is_public: true,
        allow_share: true,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(response.status).toBe(200)
      const cacheControl = response.headers.get('Cache-Control')
      expect(cacheControl).toContain('public')
      expect(cacheControl).toContain('s-maxage=300')
    })

    it('should set private cache headers for private albums', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        is_public: false,
        allow_share: true,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(response.status).toBe(200)
      const cacheControl = response.headers.get('Cache-Control')
      expect(cacheControl).toContain('private')
      expect(cacheControl).toContain('no-cache')
    })

    it('should include ETag header', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        is_public: true,
        allow_share: true,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(response.status).toBe(200)
      const etag = response.headers.get('ETag')
      expect(etag).toBeDefined()
      expect(etag).toContain('album-123')
    })

    it('should return 304 if If-None-Match matches ETag', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        is_public: true,
        allow_share: true,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const etag = `"album-123-no-expiry"`
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug', {
        headers: {
          'if-none-match': etag,
        },
      })

      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      expect(response.status).toBe(304)
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on exception', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockRejectedValue(new Error('Database error'))

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
