/**
 * 照片旋转 API 路由测试
 * 
 * 测试 PATCH 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from './route'
import { createMockRequest } from '@/test/test-utils'
import { getUserFromRequest } from '@/lib/auth/jwt-helpers'

// Mock dependencies
// Mock JWT authentication
vi.mock('@/lib/auth/jwt-helpers', async () => {
  return {
    getUserFromRequest: vi.fn(),
    updateSessionMiddleware: vi.fn().mockResolvedValue(new Response(null)),
  }
})

const mockGetUserFromRequest = vi.mocked(getUserFromRequest)

// Mock database
vi.mock('@/lib/database', () => {
  return {
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
  }
})

// Mock global fetch
global.fetch = vi.fn()

vi.mock('@/lib/supabase/admin', () => {
  const mockAdminClient = {
    from: vi.fn(),
  }

  return {
    createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
  }
})

describe('PATCH /api/admin/photos/[id]/rotate', () => {
  let mockAdminClient: any
  let mockSupabaseClient: any
  const photoId = '550e8400-e29b-41d4-a716-446655440000'
  const albumId = '550e8400-e29b-41d4-a716-446655440001'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Create mock clients
    mockSupabaseClient = {
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
      }
    }

    mockAdminClient = {
      from: vi.fn(),
      update: vi.fn(),
    }
    
    // Mock createClient to return mockSupabaseClient
    const { createClient, createAdminClient } = await import('@/lib/database')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminClient)
    
    // 默认用户已登录
    mockGetUserFromRequest.mockResolvedValue({
      id: 'user-123', email: 'test@example.com',
    } as any)

    // 默认fetch成功
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetUserFromRequest.mockResolvedValue(null)

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: 'invalid-json',
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 400 for invalid rotation value', async () => {
      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 45 }, // Invalid rotation
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('输入验证失败')
    })

    it('should accept valid rotation values', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: null,
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'pending', // 使用pending状态，避免触发worker调用
        album_id: albumId,
        original_key: `raw/${albumId}/${photoId}.jpg`,
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: photoId,
        rotation: 90,
      }

      // Mock photo query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      // Mock admin update
      mockAdminClient.update.mockResolvedValue({
        data: [mockUpdatedPhoto],
        error: null,
      })

      // Mock photo status query
      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.data.rotation).toBe(90)
    })

    it('should accept null rotation value', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: null,
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'pending', // 非completed状态，不需要重新处理
        album_id: albumId,
        original_key: `raw/${albumId}/${photoId}.jpg`,
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: photoId,
        rotation: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockAdminClient.update.mockResolvedValue({
        data: [mockUpdatedPhoto],
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: null },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.data.rotation).toBeNull()
    })
  })

  describe('photo validation', () => {
    it('should return 404 if photo does not exist', async () => {
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

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if photo is deleted', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: '2024-01-01T00:00:00Z', // 已删除
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('已被删除')
    })
  })

  describe('worker API integration', () => {
    it('should trigger reprocessing for completed photos', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: null,
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'completed',
        album_id: albumId,
        original_key: `raw/${albumId}/${photoId}.jpg`,
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: photoId,
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockAdminClient.update
        .mockResolvedValueOnce({
          data: [mockUpdatedPhoto],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      // Mock successful worker API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.needsReprocessing).toBe(true)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should handle worker API error gracefully', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: null,
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'completed',
        album_id: albumId,
        original_key: `raw/${albumId}/${photoId}.jpg`,
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: photoId,
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockAdminClient.update.mockResolvedValue({
        data: [mockUpdatedPhoto],
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      // Mock worker API error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'Worker error' }),
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
      expect(data.error.message).toContain('Worker处理失败')
    })

    it('should handle worker API network error', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: null,
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'completed',
        album_id: albumId,
        original_key: `raw/${albumId}/${photoId}.jpg`,
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: photoId,
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockAdminClient.update.mockResolvedValue({
        data: [mockUpdatedPhoto],
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'))

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
      expect(data.error.message).toContain('无法连接到 Worker 服务')
    })

    it('should not trigger reprocessing for non-completed photos', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: null,
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockPhotoStatus = {
        status: 'pending', // 非completed状态
        album_id: albumId,
        original_key: `raw/${albumId}/${photoId}.jpg`,
        deleted_at: null,
      }

      const mockUpdatedPhoto = {
        id: photoId,
        rotation: 90,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockAdminClient.update.mockResolvedValue({
        data: [mockUpdatedPhoto],
        error: null,
      })

      const mockAdminSelect2 = vi.fn().mockReturnThis()
      const mockAdminEq2 = vi.fn().mockReturnThis()
      const mockAdminIs = vi.fn().mockReturnThis()
      const mockAdminSingle2 = vi.fn().mockResolvedValue({
        data: mockPhotoStatus,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockAdminSelect2,
          eq: mockAdminEq2,
          is: mockAdminIs,
          single: mockAdminSingle2,
        })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.needsReprocessing).toBe(false)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database update error', async () => {
      const mockPhoto = {
        id: photoId,
        album_id: albumId,
        deleted_at: null,
        albums: {
          id: albumId,
          deleted_at: null,
        },
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      mockAdminClient.update.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        body: { rotation: 90 },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: photoId }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('DB_ERROR')
    })
  })
})
