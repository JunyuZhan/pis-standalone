/**
 * 检查存储 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock fetch for worker proxy call
global.fetch = vi.fn()

describe('GET /api/admin/albums/[id]/check-storage', () => {
  let mockDb: any
  let mockAdminDb: any
  let mockGetCurrentUser: any
  let mockFetch: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    mockAdminDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminDb)
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
        'http://localhost:3000/api/admin/albums/album-123/check-storage'
      )

      const response = await GET(request, {
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
        'http://localhost:3000/api/admin/albums/invalid-id/check-storage'
      )

      const response = await GET(request, {
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
        `http://localhost:3000/api/admin/albums/${albumId}/check-storage`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('storage check', () => {
    it('should successfully check storage and return comparison results', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
      }
      const dbPhotos = [
        {
          id: 'photo-1',
          original_key: 'raw/album-123/photo1.jpg',
          thumb_key: 'processed/album-123/thumb1.jpg',
          preview_key: 'processed/album-123/preview1.jpg',
          filename: 'photo1.jpg',
          status: 'completed',
        },
        {
          id: 'photo-2',
          original_key: 'raw/album-123/photo2.jpg',
          thumb_key: null,
          preview_key: null,
          filename: 'photo2.jpg',
          status: 'pending',
        },
      ]
      const rawFiles = [
        { key: 'raw/album-123/photo1.jpg', size: 1024 },
        { key: 'raw/album-123/photo2.jpg', size: 2048 },
        { key: 'raw/album-123/orphan.jpg', size: 512 },
      ]
      const processedFiles = [
        { key: 'processed/album-123/thumb1.jpg', size: 256 },
        { key: 'processed/album-123/preview1.jpg', size: 512 },
        { key: 'processed/album-123/orphan.jpg', size: 128 },
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
      const mockIsPhotos = vi.fn().mockResolvedValue({
        data: dbPhotos,
        error: null,
      })

      mockDb.from.mockReturnValueOnce({
        select: mockSelectAlbum,
        eq: mockEqAlbum,
        is: mockIsAlbum,
        single: mockSingleAlbum,
      })

      mockAdminDb.from.mockReturnValue({
        select: mockSelectPhotos,
        eq: mockEqPhotos,
        is: mockIsPhotos,
      })

      // Mock worker API calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: rawFiles }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: processedFiles }),
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/check-storage`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.album.id).toBe(albumId)
      expect(data.summary.dbPhotos).toBe(2)
      expect(data.summary.rawFiles).toBe(3)
      expect(data.summary.processedFiles).toBe(3)
      expect(data.details.missingInStorage).toBeDefined()
      expect(data.details.missingInDb).toBeDefined()
    })

    it('should handle worker API errors gracefully', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
      }
      const dbPhotos = []

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
      const mockIsPhotos = vi.fn().mockResolvedValue({
        data: dbPhotos,
        error: null,
      })

      mockDb.from.mockReturnValueOnce({
        select: mockSelectAlbum,
        eq: mockEqAlbum,
        is: mockIsAlbum,
        single: mockSingleAlbum,
      })

      mockAdminDb.from.mockReturnValue({
        select: mockSelectPhotos,
        eq: mockEqPhotos,
        is: mockIsPhotos,
      })

      // Mock worker API errors
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
        })
        .mockResolvedValueOnce({
          ok: false,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/check-storage`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.rawFiles).toBe(0)
      expect(data.summary.processedFiles).toBe(0)
    })

    it('should return error if database query fails', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock photos query error
      const mockSelectPhotos = vi.fn().mockReturnThis()
      const mockEqPhotos = vi.fn().mockReturnThis()
      const mockIsPhotos = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockDb.from.mockReturnValueOnce({
        select: mockSelectAlbum,
        eq: mockEqAlbum,
        is: mockIsAlbum,
        single: mockSingleAlbum,
      })

      mockAdminDb.from.mockReturnValue({
        select: mockSelectPhotos,
        eq: mockEqPhotos,
        is: mockIsPhotos,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/check-storage`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
