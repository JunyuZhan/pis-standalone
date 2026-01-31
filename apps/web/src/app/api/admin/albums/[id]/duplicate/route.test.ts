/**
 * 复制相册 API 路由测试
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

vi.mock('@/lib/utils', () => ({
  getAlbumShareUrl: vi.fn((slug: string) => `https://example.com/album/${slug}`),
}))

describe('POST /api/admin/albums/[id]/duplicate', () => {
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
        'http://localhost:3000/api/admin/albums/album-123/duplicate',
        {
          method: 'POST',
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
        'http://localhost:3000/api/admin/albums/invalid-id/duplicate',
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

  describe('album duplication', () => {
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
        `http://localhost:3000/api/admin/albums/${albumId}/duplicate`,
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

    it('should successfully duplicate album', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const originalAlbum = {
        id: albumId,
        title: 'Original Album',
        description: 'Original Description',
        is_public: true,
        layout: 'masonry',
        sort_rule: 'capture_desc',
        allow_download: true,
        allow_batch_download: true,
        show_exif: true,
        allow_share: true,
        password: null,
        expires_at: null,
        watermark_enabled: false,
        watermark_type: null,
        watermark_config: null,
        share_title: null,
        share_description: null,
        share_image_url: null,
        cover_photo_id: null,
        photo_count: 10,
        selected_count: 5,
        view_count: 100,
      }

      const newAlbum = {
        id: 'new-album-id',
        slug: 'original-album-fu-ben',
        title: 'Original Album (副本)',
        ...originalAlbum,
        photo_count: 0,
        selected_count: 0,
        view_count: 0,
      }

      // Mock album retrieval
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: originalAlbum,
        error: null,
      })

      mockDb.from.mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      // Mock album insertion
      mockDb.insert.mockResolvedValue({
        data: [newAlbum],
        error: null,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/duplicate`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe(newAlbum.id)
      expect(data.title).toBe('Original Album (副本)')
      expect(data.message).toBe('相册已复制')
      expect(mockDb.insert).toHaveBeenCalledWith(
        'albums',
        expect.objectContaining({
          title: 'Original Album (副本)',
          photo_count: 0,
          selected_count: 0,
          view_count: 0,
        })
      )
    })

    it('should return error if insertion fails', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const originalAlbum = {
        id: albumId,
        title: 'Original Album',
        description: 'Original Description',
        is_public: true,
        layout: 'masonry',
        sort_rule: 'capture_desc',
        allow_download: true,
        allow_batch_download: true,
        show_exif: true,
        allow_share: true,
        password: null,
        expires_at: null,
        watermark_enabled: false,
        watermark_type: null,
        watermark_config: null,
        share_title: null,
        share_description: null,
        share_image_url: null,
      }

      // Mock album retrieval
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: originalAlbum,
        error: null,
      })

      mockDb.from.mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      // Mock insertion failure
      mockDb.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/duplicate`,
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
