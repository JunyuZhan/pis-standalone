/**
 * 下载选中照片 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => {
  const mockAdminClient = {
    from: vi.fn(),
  }

  return {
    createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
    createClient: vi.fn().mockReturnValue(mockAdminClient), // In case it uses createClient too
  }
})

// Mock global fetch for Worker API calls
const originalFetch = global.fetch
let mockFetch: ReturnType<typeof vi.fn>

describe('GET /api/public/albums/[slug]/download-selected', () => {
  let mockAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup fetch mock
    mockFetch = vi.fn()
    global.fetch = mockFetch as any
    
    const { createAdminClient } = await import('@/lib/database')
    mockAdminClient = await createAdminClient()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album does not allow download', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: false,
        allow_batch_download: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('不允许下载')
    })

    it('should return 403 if album does not allow batch download', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: false,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('不允许批量下载')
    })
  })

  describe('photo retrieval', () => {
    it('should return download links for selected photos successfully', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: true,
      }

      const mockPhotos = [
        {
          id: 'photo-1',
          filename: 'photo1.jpg',
          original_key: 'raw/album-123/photo-1.jpg',
        },
        {
          id: 'photo-2',
          filename: 'photo2.jpg',
          original_key: 'raw/album-123/photo-2.jpg',
        },
      ]

      // Mock album query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      // Mock photos query - 需要链式调用：select().eq().eq().eq().order()
      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order.mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      // Mock Worker API responses for presigned URLs
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://presigned-url-1.com/photo-1.jpg' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://presigned-url-2.com/photo-2.jpg' }),
        } as Response)

      // Set environment variables for Worker API
      const originalWorkerUrl = process.env.WORKER_API_URL
      const originalWorkerKey = process.env.WORKER_API_KEY
      process.env.WORKER_API_URL = 'http://localhost:3001'
      process.env.WORKER_API_KEY = 'test-api-key'

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      // Restore environment variables
      if (originalWorkerUrl) {
        process.env.WORKER_API_URL = originalWorkerUrl
      } else {
        delete process.env.WORKER_API_URL
      }
      if (originalWorkerKey) {
        process.env.WORKER_API_KEY = originalWorkerKey
      } else {
        delete process.env.WORKER_API_KEY
      }

      expect(response.status).toBe(200)
      expect(data.data.albumTitle).toBe('Test Album')
      expect(data.data.count).toBe(2)
      expect(data.data.photos).toHaveLength(2)
      expect(data.data.photos[0].id).toBe('photo-1')
      expect(data.data.photos[0].filename).toBe('photo1.jpg')
      expect(data.data.photos[0].url).toBe('https://presigned-url-1.com/photo-1.jpg')
      expect(data.data.photos[1].id).toBe('photo-2')
      expect(data.data.photos[1].filename).toBe('photo2.jpg')
      expect(data.data.photos[1].url).toBe('https://presigned-url-2.com/photo-2.jpg')
      
      // Verify Worker API was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/presign/get',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
          }),
        })
      )
    })

    it('should return 400 if no photos are selected', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order.mockResolvedValue({
        data: [],
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('没有已选照片')
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error when querying photos', async () => {
      const mockAlbum = {
        id: 'album-123',
        title: 'Test Album',
        allow_download: true,
        allow_batch_download: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockAlbum,
        error: null,
      })

      const mockQuery2 = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockQuery2.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          is: mockIs,
          single: mockSingle,
        })
        .mockReturnValueOnce(mockQuery2)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/download-selected')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      // 代码中会throw photosError，所以会被catch捕获返回500
      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
