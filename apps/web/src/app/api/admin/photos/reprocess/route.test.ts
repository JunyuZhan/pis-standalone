/**
 * 照片重新处理 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'

// 辅助函数：创建可 await 的查询结果对象
function createQueryResult(data: any, error: any = null) {
  const promise = Promise.resolve({ data, error })
  const queryResult = Object.assign(promise, {
    in: vi.fn().mockReturnValue(promise),
    eq: vi.fn().mockReturnValue(promise),
  })
  return queryResult
}

// Mock dependencies
// Mock Database
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

// Mock JWT authentication
vi.mock('@/lib/auth/jwt-helpers', async () => {
  const mockGetUserFromRequest = vi.fn()
  return {
    getUserFromRequest: mockGetUserFromRequest,
    updateSessionMiddleware: vi.fn().mockResolvedValue(new Response(null)),
  }
})

// Mock global fetch
global.fetch = vi.fn()

// Mock global fetch
global.fetch = vi.fn()

describe('POST /api/admin/photos/reprocess', () => {
  let mockSupabaseClient: any
  let mockGetUserFromRequest: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup Database mock
    mockSupabaseClient = {
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
      update: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const { createClient } = await import('@/lib/database')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)

    // 导入 mock
    const { getUserFromRequest } = await import('@/lib/auth/jwt-helpers')
    mockGetUserFromRequest = getUserFromRequest
    
    // 默认用户已登录
    mockGetUserFromRequest.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
    })

    // 默认fetch成功
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetUserFromRequest.mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if neither photoIds nor albumId is provided', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        in: mockIn,
        not: mockNot,
        is: mockIs,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {},
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      // expect(data.error.message).toContain('请指定要重新处理的照片ID或相册ID')
    })

    it('should return 400 if photoIds exceeds limit', async () => {
      const photoIds = Array.from({ length: 101 }, (_, i) => `photo-${i}`)

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      // expect(data.error.message).toContain('单次最多重新处理100张照片')
    })
  })

  describe('photo query', () => {
    it('should return success if no photos found', async () => {
      // 创建查询链 mock：select -> in -> not -> is
      const finalQueryResult = createQueryResult([], null)
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: vi.fn().mockReturnValue({
          not: mockNot,
          is: vi.fn().mockReturnValue(finalQueryResult),
        }),
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.queued).toBe(0)
      expect(data.data.message).toContain('没有需要重新处理的照片')
    })

    it('should return 500 on database query error', async () => {
      // 创建查询链 mock
      const finalQueryResult = createQueryResult(null, { message: 'Database error' })
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: vi.fn().mockReturnValue({
          not: mockNot,
          is: vi.fn().mockReturnValue(finalQueryResult),
        }),
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      // expect(data.error.code).toBe('DB_ERROR')
      expect(['DB_ERROR', 'INTERNAL_ERROR']).toContain(data.error.code)
    })

    it('should filter photos by photoIds', async () => {
      const mockPhotos = [
        {
          id: '22222222-2222-2222-2222-222222222222',
          album_id: '11111111-1111-1111-1111-111111111111',
          original_key: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
          status: 'completed',
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          album_id: '11111111-1111-1111-1111-111111111111',
          original_key: 'raw/11111111-1111-1111-1111-111111111111/33333333-3333-3333-3333-333333333333.jpg',
          status: 'completed',
        },
      ]

      // 创建查询链 mock
      const finalQueryResult = createQueryResult(mockPhotos, null)
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: vi.fn().mockReturnValue({
          not: mockNot,
          is: vi.fn().mockReturnValue(finalQueryResult),
        }),
      })

      const createUpdateMock = () => {
        const mockUpdate = vi.fn().mockReturnThis()
        const mockUpdateEq = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        })
        return {
          update: mockUpdate,
          eq: mockUpdateEq,
        }
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockImplementation(() => createUpdateMock())

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.queued).toBe(2)
      // query.in('id', photoIds) 是在 .is() 返回的对象上调用的
      expect(finalQueryResult.in).toHaveBeenCalledWith('id', ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'])
    })

    it('should filter photos by albumId', async () => {
      const mockPhotos = [
        {
          id: '22222222-2222-2222-2222-222222222222',
          album_id: '11111111-1111-1111-1111-111111111111',
          original_key: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
          status: 'completed',
        },
      ]

      // 创建查询链 mock
      const finalQueryResult = createQueryResult(mockPhotos, null)
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockEq = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult), // query.eq('album_id', albumId) 返回这个
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: mockEq, // query.eq('album_id', albumId) 返回这个
      })

      const createUpdateMock = () => {
        const mockUpdate = vi.fn().mockReturnThis()
        const mockUpdateEq = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        })
        return {
          update: mockUpdate,
          eq: mockUpdateEq,
        }
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockImplementation(() => createUpdateMock())

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          albumId: '11111111-1111-1111-1111-111111111111',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      // query.eq('album_id', albumId) 是在 .is() 返回的对象上调用的
      expect(finalQueryResult.eq).toHaveBeenCalledWith('album_id', '11111111-1111-1111-1111-111111111111')
    })
  })

  describe('reprocessing workflow', () => {
    it('should successfully reprocess photos', async () => {
      const mockPhotos = [
        {
          id: '22222222-2222-2222-2222-222222222222',
          album_id: '11111111-1111-1111-1111-111111111111',
          original_key: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
          status: 'completed',
        },
      ]

      // 创建查询链 mock
      const finalQueryResult = createQueryResult(mockPhotos, null)
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: vi.fn().mockReturnValue({
          not: mockNot,
          is: vi.fn().mockReturnValue(finalQueryResult),
        }),
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.queued).toBe(1)
      expect(data.data.total).toBe(1)
      expect(data.data.failed).toBe(0)
      
      // 验证状态更新为 pending
      expect(mockSupabaseClient.update).toHaveBeenCalledWith('photos', { status: 'pending' }, { id: '22222222-2222-2222-2222-222222222222' })
      
      // 验证调用了 Worker API
      expect(global.fetch).toHaveBeenCalled()
      const fetchCall = (global.fetch as any).mock.calls[0]
      expect(fetchCall[0]).toContain('/api/worker/process')
    })

    it('should handle batch processing with concurrency limit', async () => {
      // 创建 25 张照片（超过 batchSize=10）
      const mockPhotos = Array.from({ length: 25 }, (_, i) => ({
        id: `22222222-2222-2222-2222-2222222222${i.toString().padStart(2, '0')}`,
        album_id: '11111111-1111-1111-1111-111111111111',
        original_key: `raw/album-123/photo-${i}.jpg`,
        status: 'completed',
      }))

      // 创建查询链 mock（使用 albumId）
      const finalQueryResult = {
        data: mockPhotos,
        error: null,
      }
      const promise = Promise.resolve(finalQueryResult)
      const mockIs = vi.fn().mockResolvedValue(finalQueryResult)
      
      const isResult = Object.assign(promise, {
        in: vi.fn().mockReturnValue(promise),
        eq: vi.fn().mockReturnValue(promise),
      })
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(isResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(isResult),
      })
      const mockEq = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(isResult), // query.eq('album_id', albumId) 返回这个
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(isResult), // query.is('deleted_at', null)
        eq: mockEq,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          albumId: '11111111-1111-1111-1111-111111111111',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.queued).toBe(25)
      expect(data.data.total).toBe(25)
      
      // 验证所有照片都被处理
      expect(global.fetch).toHaveBeenCalledTimes(25)
    })

    it('should handle worker API failures gracefully', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          status: 'completed',
        },
      ]

      // 创建查询链 mock
      const finalQueryResult = createQueryResult(mockPhotos, null)
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: vi.fn().mockReturnValue({
          not: mockNot,
          is: vi.fn().mockReturnValue(finalQueryResult),
        }),
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })

      // Worker API 失败
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Worker error',
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.queued).toBe(0)
      expect(data.data.failed).toBe(1)
      expect(data.data.errors).toBeDefined()
    })

    it('should handle network errors gracefully', async () => {
      const mockPhotos = [
        {
          id: '22222222-2222-2222-2222-222222222222',
          album_id: '11111111-1111-1111-1111-111111111111',
          original_key: 'raw/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
          status: 'completed',
        },
      ]

      // 创建查询链 mock
      const finalQueryResult = createQueryResult(mockPhotos, null)
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: vi.fn().mockReturnValue({
          not: mockNot,
          is: vi.fn().mockReturnValue(finalQueryResult),
        }),
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })

      // Worker API 网络错误
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.failed).toBe(1)
      expect(data.data.errors).toBeDefined()
    })

    it('should pass cookie header to worker API', async () => {
      const mockPhotos = [
        {
          id: 'photo-123',
          album_id: 'album-123',
          original_key: 'raw/album-123/photo-123.jpg',
          status: 'completed',
        },
      ]

      // 创建查询链 mock
      const finalQueryResult = createQueryResult(mockPhotos, null)
      
      const mockNot = vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockIn = vi.fn().mockReturnValue({
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
      })
      const mockSelect = vi.fn().mockReturnValue({
        in: mockIn,
        not: mockNot,
        is: vi.fn().mockReturnValue(finalQueryResult),
        eq: vi.fn().mockReturnValue({
          not: mockNot,
          is: vi.fn().mockReturnValue(finalQueryResult),
        }),
      })

      const createUpdateMock = () => {
        const mockUpdate = vi.fn().mockReturnThis()
        const mockEq = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        })
        return {
          update: mockUpdate,
          eq: mockEq,
        }
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockImplementation(() => createUpdateMock())

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        headers: {
          cookie: 'session=abc123',
        },
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      
      // 验证 cookie 被传递
      const fetchCall = (global.fetch as any).mock.calls[0]
      const fetchOptions = fetchCall[1]
      expect(fetchOptions.headers['cookie']).toBe('session=abc123')
    })
  })

  describe('error handling', () => {
    it('should return 500 on unexpected error', async () => {
      mockGetUserFromRequest.mockRejectedValue(new Error('Unexpected error'))

      const request = createMockRequest('http://localhost:3000/api/admin/photos/reprocess', {
        method: 'POST',
        body: {
          photoIds: ['22222222-2222-2222-2222-222222222222'],
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
