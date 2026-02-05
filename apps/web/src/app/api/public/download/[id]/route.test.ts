/**
 * 原图下载 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
const mockDb = {
  from: vi.fn(),
}

vi.mock('@/lib/database', () => ({
  createClient: vi.fn().mockResolvedValue(mockDb),
}))

// Mock fetch for Worker API calls
const mockFetch = vi.fn()

// Mock global fetch
global.fetch = mockFetch


describe('GET /api/public/download/[id]', () => {
  let mockDb: any
  let GET: typeof import('./route').GET
  const originalEnv = process.env
  
  // Valid UUIDs for testing
  const validPhotoId = '123e4567-e89b-12d3-a456-426614174000'
  const validAlbumId = '123e4567-e89b-12d3-a456-426614174001'

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    
    // 设置必要的环境变量
    process.env = {
      ...originalEnv,
      WORKER_API_URL: 'http://localhost:3001',
      WORKER_API_KEY: 'test-api-key',
    }
    
    // Mock global fetch
    global.fetch = mockFetch
    
    const { createClient } = await import('@/lib/database')
    mockDb = await createClient()
    
    // 重置 fetch mock
    mockFetch.mockReset()
    
    // 默认 mock Worker API 成功响应
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://minio.example.com/presigned-url' }),
    })
    
    // 重新导入route模块以使用新的mock
    const routeModule = await import('./route')
    GET = routeModule.GET
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('photo validation', () => {
    it('should return 404 if photo does not exist', async () => {
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

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('照片不存在')
    })

    it('should return 404 if photo status is not completed', async () => {
      // 注意：代码中使用了 .eq('status', 'completed')，所以未完成的照片不会返回
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('album validation', () => {
    it('should return 404 if album is deleted', async () => {
      const mockPhoto = {
        id: validPhotoId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
        filename: 'photo.jpg',
        album_id: validAlbumId,
      }
      
      const mockAlbum = {
        id: validAlbumId,
        allow_download: true,
        deleted_at: '2024-01-01T00:00:00Z',
      }

      // Mock first query (photos)
      const mockPhotoQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
      }

      // Mock second query (albums)
      const mockAlbumQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
      }

      mockDb.from
        .mockReturnValueOnce(mockPhotoQuery)
        .mockReturnValueOnce(mockAlbumQuery)

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('相册不存在')
    })

    it('should return 403 if album does not allow download', async () => {
      const mockPhoto = {
        id: validPhotoId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
        filename: 'photo.jpg',
        album_id: validAlbumId,
      }

      const mockAlbum = {
        id: validAlbumId,
        allow_download: false,
        deleted_at: null,
      }

      // Mock first query (photos)
      const mockPhotoQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
      }

      // Mock second query (albums)
      const mockAlbumQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
      }

      mockDb.from
        .mockReturnValueOnce(mockPhotoQuery)
        .mockReturnValueOnce(mockAlbumQuery)

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('不允许下载原图')
    })
  })

  describe('presigned URL generation', () => {
    it('should generate presigned URL successfully', async () => {
      const mockPhoto = {
        id: validPhotoId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
        filename: 'photo.jpg',
        album_id: validAlbumId,
      }

      const mockAlbum = {
        id: validAlbumId,
        allow_download: true,
        deleted_at: null,
      }

      // Mock first query (photos)
      const mockPhotoQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
      }

      // Mock second query (albums)
      const mockAlbumQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
      }

      mockDb.from
        .mockReturnValueOnce(mockPhotoQuery)
        .mockReturnValueOnce(mockAlbumQuery)

      const mockDownloadUrl = 'https://minio.example.com/presigned-url'
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: mockDownloadUrl }),
      })

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.downloadUrl).toBe(mockDownloadUrl)
      expect(data.data.filename).toBe('photo.jpg')
      expect(data.data.expiresIn).toBe(300) // 5 minutes
      
      // 验证 Worker API 被调用
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/presign/get'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      )
    })

    it('should return download URL with correct format', async () => {
      const mockPhoto = {
        id: validPhotoId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
        filename: '照片 测试.jpg', // 包含中文字符和空格
        album_id: validAlbumId,
      }

      const mockAlbum = {
        id: validAlbumId,
        allow_download: true,
        deleted_at: null,
      }

      // Mock first query (photos)
      const mockPhotoQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
      }

      // Mock second query (albums)
      const mockAlbumQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
      }

      mockDb.from
        .mockReturnValueOnce(mockPhotoQuery)
        .mockReturnValueOnce(mockAlbumQuery)

      const mockDownloadUrl = 'https://minio.example.com/presigned-url'
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: mockDownloadUrl }),
      })

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.downloadUrl).toBe(mockDownloadUrl)
      expect(data.data.filename).toBe('照片 测试.jpg')
      expect(data.data.expiresIn).toBe(300)
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on MinIO error', async () => {
      const mockPhoto = {
        id: validPhotoId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
        filename: 'photo.jpg',
        album_id: validAlbumId,
      }

      const mockAlbum = {
        id: validAlbumId,
        allow_download: true,
        deleted_at: null,
      }

      // Mock first query (photos)
      const mockPhotoQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
      }

      // Mock second query (albums)
      const mockAlbumQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
      }

      mockDb.from
        .mockReturnValueOnce(mockPhotoQuery)
        .mockReturnValueOnce(mockAlbumQuery)

      // Mock Worker API 返回错误
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Worker API error',
      })

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
      expect(data.error.message).toContain('Worker API error')
    })

    it('should return 500 on database error', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockRejectedValue(new Error('Database error'))

      mockDb.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest(`http://localhost:3000/api/public/download/${validPhotoId}`)
      const response = await GET(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
