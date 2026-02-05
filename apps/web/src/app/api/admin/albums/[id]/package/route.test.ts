/**
 * 打包下载 API 路由测试
 * 
 * 测试 POST 和 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock fetch for worker call
global.fetch = vi.fn()

describe('POST /api/admin/albums/[id]/package', () => {
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

    // Mock worker call success
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/550e8400-e29b-41d4-a716-446655440000/package',
        {
          method: 'POST',
          body: {
            photoSelection: 'all',
          },
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
        'http://localhost:3000/api/admin/albums/invalid-id/package',
        {
          method: 'POST',
          body: {
            photoSelection: 'all',
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

    it('should return 400 for invalid photoSelection when custom without photoIds', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      
      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/package`,
        {
          method: 'POST',
          body: {
            photoSelection: 'custom',
            // photoIds missing
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
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
        `http://localhost:3000/api/admin/albums/${albumId}/package`,
        {
          method: 'POST',
          body: {
            photoSelection: 'all',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album does not allow download', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
        allow_download: false,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/package`,
        {
          method: 'POST',
          body: {
            photoSelection: 'all',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('package creation', () => {
    it('should successfully create package for all photos', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
        allow_download: true,
      }
      const photos = [
        { id: 'photo-1' },
        { id: 'photo-2' },
        { id: 'photo-3' },
      ]
      const packageData = {
        id: 'package-123',
        album_id: albumId,
        photo_ids: photos.map(p => p.id),
        status: 'pending',
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
          is: mockIsPhotos,
        })

      // Mock package insertion
      mockDb.insert.mockResolvedValue({
        data: [packageData],
        error: null,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/package`,
        {
          method: 'POST',
          body: {
            photoSelection: 'all',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.packageId).toBe(packageData.id)
      expect(data.status).toBe('pending')
    })

    it('should return 400 if no photos to package', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
        title: 'Test Album',
        allow_download: true,
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
          is: mockIsPhotos,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/package`,
        {
          method: 'POST',
          body: {
            photoSelection: 'all',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('没有可打包的照片')
    })
  })
})

describe('GET /api/admin/albums/[id]/package', () => {
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
        'http://localhost:3000/api/admin/albums/550e8400-e29b-41d4-a716-446655440000/package?packageId=550e8400-e29b-41d4-a716-446655440001'
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
        'http://localhost:3000/api/admin/albums/invalid-id/package?packageId=package-123'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing packageId', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      
      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/package`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('package retrieval', () => {
    it('should return package data when found', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const packageId = '550e8400-e29b-41d4-a716-446655440001'
      const packageData = {
        id: packageId,
        album_id: albumId,
        photo_ids: ['photo-1', 'photo-2'],
        status: 'completed',
        download_url: 'https://example.com/download.zip',
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: packageData,
        error: null,
      })

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/package?packageId=${packageId}`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(packageData)
    })

    it('should return 404 if package not found', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const packageId = '550e8400-e29b-41d4-a716-446655440001'

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/package?packageId=${packageId}`
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
