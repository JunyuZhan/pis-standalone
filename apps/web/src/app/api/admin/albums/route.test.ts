/**
 * 相册列表和创建 API 路由测试
 * 
 * 测试 GET 和 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { createMockRequest } from '@/test/test-utils'
import { getUserFromRequest } from '@/lib/auth/jwt-helpers'

// Mock dependencies
// Mock JWT authentication
vi.mock('@/lib/auth/jwt-helpers', async () => {
  const mockGetUserFromRequest = vi.fn()
  return {
    getUserFromRequest: mockGetUserFromRequest,
    updateSessionMiddleware: vi.fn().mockResolvedValue(new Response(null)),
  }
})

// Mock database
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

// Mock global fetch
global.fetch = vi.fn()

vi.mock('@/lib/utils', () => ({
  getAlbumShareUrl: vi.fn((slug: string) => `https://example.com/album/${slug}`),
  generateAlbumSlug: vi.fn(() => 'test-album'),
  getAppBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

describe('GET /api/admin/albums', () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    
    // Initialize mockSupabaseClient with default mocks
    mockSupabaseClient = {
      from: vi.fn(),
      insert: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    
    // 默认用户已登录
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: 'user-123', email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      vi.mocked(getUserFromRequest).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/albums')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('pagination', () => {
    it('should return albums with default pagination', async () => {
      const mockAlbums = [
        { id: 'album-1', title: 'Album 1' },
        { id: 'album-2', title: 'Album 2' },
      ]

      const mockSelect = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockReturnThis()
      const mockOffset = vi.fn().mockReturnThis()
      const mockThen = (resolve: any) => resolve({
        data: mockAlbums,
        error: null,
        count: 2,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        is: mockIs,
        order: mockOrder,
        limit: mockLimit,
        offset: mockOffset,
        then: mockThen,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.albums).toEqual(mockAlbums)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(50)
      expect(data.pagination.total).toBe(2)
    })

    it('should handle custom pagination parameters', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockReturnThis()
      const mockOffset = vi.fn().mockReturnThis()
      const mockThen = (resolve: any) => resolve({
        data: [],
        error: null,
        count: 100,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        is: mockIs,
        order: mockOrder,
        limit: mockLimit,
        offset: mockOffset,
        then: mockThen,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums?page=2&limit=20')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(20)
      expect(data.pagination.totalPages).toBe(5)
      expect(mockLimit).toHaveBeenCalledWith(20)
      expect(mockOffset).toHaveBeenCalledWith(20)
    })
  })

  describe('filtering', () => {
    it('should filter by is_public=true', async () => {
      // Setup mock chain to support: db.from().is().order().limit().offset().eq()
      const mockQueryAfterRange = {
        data: [{ id: 'album-1', is_public: true }],
        error: null,
        count: 1,
      }
      
      const mockThen = (resolve: any) => resolve(mockQueryAfterRange)
      const mockEq = vi.fn().mockReturnValue({ then: mockThen })
      
      const mockOffset = vi.fn().mockReturnValue({ 
        eq: mockEq,
        then: mockThen
      })
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset })
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ is: mockIs })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        is: mockIs,
        order: mockOrder,
        limit: mockLimit,
        offset: mockOffset,
        eq: mockEq,
        then: mockThen,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums?is_public=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.albums).toBeDefined()
    })

    it('should filter by is_public=false', async () => {
      const mockQueryAfterRange = {
        data: [{ id: 'album-1', is_public: false }],
        error: null,
        count: 1,
      }
      
      const mockThen = (resolve: any) => resolve(mockQueryAfterRange)
      const mockEq = vi.fn().mockReturnValue({ then: mockThen })
      
      const mockOffset = vi.fn().mockReturnValue({ 
        eq: mockEq,
        then: mockThen
      })
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset })
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
      const mockIs = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ is: mockIs })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        is: mockIs,
        order: mockOrder,
        limit: mockLimit,
        offset: mockOffset,
        eq: mockEq,
        then: mockThen,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums?is_public=false')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.albums).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockReturnThis()
      const mockOffset = vi.fn().mockReturnThis()
      const mockThen = (resolve: any) => resolve({
        data: null,
        error: { message: 'Database error' },
        count: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        is: mockIs,
        order: mockOrder,
        limit: mockLimit,
        offset: mockOffset,
        then: mockThen,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on exception', async () => {
      vi.mocked(getUserFromRequest).mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest('http://localhost:3000/api/admin/albums')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('POST /api/admin/albums', () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    
    // Initialize mockSupabaseClient with default mocks
    mockSupabaseClient = {
      from: vi.fn(),
      insert: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    
    // 默认用户已登录
    vi.mocked(getUserFromRequest).mockResolvedValue({
      id: 'user-123', email: 'test@example.com',
    })

    // 默认创建成功
    const mockInsert = vi.fn().mockResolvedValue({
      data: [{
        id: 'album-123',
        slug: 'test-album',
        title: 'Test Album',
        is_public: false,
      }],
      error: null,
    })

    // 如果代码使用了 db.insert()，则直接 mock 它
    mockSupabaseClient.insert = mockInsert
    
    // 如果代码使用了 db.from().insert() (Supabase style)，则 mock from().insert()
    const mockFromInsert = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'album-123',
        slug: 'test-album',
        title: 'Test Album',
        is_public: false,
      },
      error: null,
    })

    mockSupabaseClient.from.mockReturnValue({
      insert: mockFromInsert,
      select: mockSelect,
      single: mockSingle,
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      vi.mocked(getUserFromRequest).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for empty title', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: '' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      // The error message is generic "输入验证失败", detailed error is in details
      expect(JSON.stringify(data.error)).toContain('标题不能为空')
    })

    it('should return 400 for title exceeding 200 characters', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'a'.repeat(201) },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(JSON.stringify(data.error)).toContain('标题最多 200 个字符')
    })

    it('should return 400 for invalid layout', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album', layout: 'invalid-layout' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(JSON.stringify(data.error)).toContain('Invalid enum value')
    })

    it('should return 400 for invalid sort_rule', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album', sort_rule: 'invalid-sort' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(JSON.stringify(data.error)).toContain('Invalid enum value')
    })

    it('should return 400 for invalid watermark_type', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album', watermark_type: 'invalid-type' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(JSON.stringify(data.error)).toContain('Invalid input')
    })
  })

  describe('SSRF protection', () => {
    it('should reject localhost URLs for poster_image_url', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: {
          title: 'Test Album',
          poster_image_url: 'http://localhost:8080/image.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(JSON.stringify(data.error)).toContain('不能使用内网地址')
    })

    it('should reject private IP URLs for poster_image_url', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: {
          title: 'Test Album',
          poster_image_url: 'http://192.168.1.1/image.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(JSON.stringify(data.error)).toContain('不能使用内网地址')
    })

    it('should reject non-http protocols for poster_image_url', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: {
          title: 'Test Album',
          poster_image_url: 'file:///etc/passwd',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(JSON.stringify(data.error)).toContain('必须使用 http 或 https 协议')
    })

    it('should accept valid public URLs for poster_image_url', async () => {
      const mockInsert = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          slug: 'test-album',
          title: 'Test Album',
          is_public: false,
          poster_image_url: 'https://example.com/image.jpg',
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: {
          title: 'Test Album',
          poster_image_url: 'https://example.com/image.jpg',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe('album-123')
    })
  })

  describe('successful creation', () => {
    it('should create album successfully with minimal data', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe('album-123')
      expect(data.data.slug).toBe('test-album')
      expect(data.data.title).toBe('Test Album')
      expect(data.data.shareUrl).toBeDefined()
    })

    it('should create album with all optional fields', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        data: [{
          id: 'album-123',
          slug: 'test-album',
          title: 'Test Album',
          description: 'Test Description',
          is_public: true,
          layout: 'grid',
          sort_rule: 'manual',
        }],
        error: null,
      })
      mockSupabaseClient.insert = mockInsert

      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: {
          title: 'Test Album',
          description: 'Test Description',
          is_public: true,
          layout: 'grid',
          sort_rule: 'manual',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.title).toBe('Test Album')
      expect(data.data.is_public).toBe(true)
    })

    it('should handle shareUrl generation error gracefully', async () => {
      const { getAlbumShareUrl } = await import('@/lib/utils')
      vi.mocked(getAlbumShareUrl).mockImplementation(() => {
        throw new Error('URL generation failed')
      })

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{
          id: 'album-123',
          slug: 'test-album',
          title: 'Test Album',
          is_public: false,
        }],
        error: null,
      })
      mockSupabaseClient.insert = mockInsert

      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.shareUrl).toBeDefined()
      // Should use fallback URL
      expect(data.data.shareUrl).toContain('test-album')
    })
  })

  describe('error handling', () => {
    it('should return 409 for duplicate slug error', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint "albums_slug_key"' },
      })
      mockSupabaseClient.insert = mockInsert

      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error.code).toBe('DUPLICATE_SLUG')
    })

    it('should return 500 on database error', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })
      mockSupabaseClient.insert = mockInsert

      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on exception', async () => {
      vi.mocked(getUserFromRequest).mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest('http://localhost:3000/api/admin/albums', {
        method: 'POST',
        body: { title: 'Test Album' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
