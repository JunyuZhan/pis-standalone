/**
 * 查看相册 API 路由测试
 * 
 * 测试 POST 方法（增加浏览次数）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

describe('POST /api/public/albums/[slug]/view', () => {
  let mockDb: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
  })

  describe('validation', () => {
    it('should return 400 for invalid slug', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/public/albums/invalid-slug!/view',
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ slug: 'invalid-slug!' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const slug = 'non-existent-album'
      
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
        `http://localhost:3000/api/public/albums/${slug}/view`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ slug }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('view count increment', () => {
    it('should increment view count using RPC function', async () => {
      const slug = 'test-album'
      const album = {
        id: 'album-123',
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock RPC success
      mockDb.rpc.mockResolvedValue({
        data: null,
        error: null,
      })

      // Mock updated view count
      const mockSelectView = vi.fn().mockReturnThis()
      const mockEqView = vi.fn().mockReturnThis()
      const mockSingleView = vi.fn().mockResolvedValue({
        data: { view_count: 101 },
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
          select: mockSelectView,
          eq: mockEqView,
          single: mockSingleView,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/public/albums/${slug}/view`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ slug }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.view_count).toBe(101)
      expect(mockDb.rpc).toHaveBeenCalledWith('increment_album_view_count', {
        album_id: album.id,
      })
    })

    it('should use fallback method when RPC fails', async () => {
      const slug = 'test-album'
      const album = {
        id: 'album-123',
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock RPC failure
      mockDb.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function not found' },
      })

      // Mock current view count
      const mockSelectCurrent = vi.fn().mockReturnThis()
      const mockEqCurrent = vi.fn().mockReturnThis()
      const mockSingleCurrent = vi.fn().mockResolvedValue({
        data: { view_count: 50 },
        error: null,
      })

      // Mock update
      mockDb.update.mockResolvedValue({
        data: null,
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
          select: mockSelectCurrent,
          eq: mockEqCurrent,
          single: mockSingleCurrent,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/public/albums/${slug}/view`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ slug }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.view_count).toBe(51)
      expect(mockDb.update).toHaveBeenCalledWith(
        'albums',
        { view_count: 51 },
        { id: album.id }
      )
    })

    it('should handle error gracefully and return current view count', async () => {
      const slug = 'test-album'

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: 'album-123' },
        error: null,
      })

      // Mock RPC failure
      mockDb.rpc.mockRejectedValue(new Error('Database error'))

      // Mock fallback query
      const mockSelectFallback = vi.fn().mockReturnThis()
      const mockEqFallback = vi.fn().mockReturnThis()
      const mockIsFallback = vi.fn().mockReturnThis()
      const mockSingleFallback = vi.fn().mockResolvedValue({
        data: { view_count: 10 },
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
          select: mockSelectFallback,
          eq: mockEqFallback,
          is: mockIsFallback,
          single: mockSingleFallback,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/public/albums/${slug}/view`,
        {
          method: 'POST',
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ slug }),
      })
      const data = await response.json()

      // Should return fallback response
      expect(data.success).toBe(false)
      expect(data.view_count).toBe(10)
      expect(data.error).toBe('Failed to increment view count')
    })
  })
})
