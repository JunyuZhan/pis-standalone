/**
 * 照片选择 API 路由测试
 * 
 * 测试 GET 和 PATCH 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
const { mockAdminClient, mockSupabaseClient } = vi.hoisted(() => {
  return {
    mockAdminClient: {
      from: vi.fn(),
      update: vi.fn(),
    },
    mockSupabaseClient: {
      from: vi.fn(),
    }
  }
})

vi.mock('@/lib/database', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
  createAdminClient: vi.fn().mockResolvedValue(mockAdminClient),
}))

describe('GET /api/public/photos/[id]/select', () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    mockSupabaseClient = await createClient()
  })

  describe('photo retrieval', () => {
    it('should return photo selection status successfully', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        is_selected: true,
        album_id: '550e8400-e29b-41d4-a716-446655440001',
      }

      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
          error: null,
        })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select')
      const response = await GET(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(data.data.isSelected).toBe(true)
    })

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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select')
      const response = await GET(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if photo is deleted', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select')
      const response = await GET(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album is not public', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
      }

      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        is_public: false,
        deleted_at: null,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
          error: null,
        })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select')
      const response = await GET(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 403 if album is expired', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
      }

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1)

      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        is_public: true,
        deleted_at: null,
        expires_at: expiredDate.toISOString(),
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
          error: null,
        })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select')
      const response = await GET(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select')
      const response = await GET(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('PATCH /api/public/photos/[id]/select', () => {
  let mockSupabaseClient: any
  let mockAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    mockSupabaseClient = await createClient()
    mockAdminClient = await createAdminClient()
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: 'invalid-json',
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid isSelected type', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: 'true' }, // 字符串而不是布尔值
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if photo is deleted', async () => {
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if album is deleted', async () => {
      // Mock photo exists
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
      }

      // Mock album check returns null (deleted or not found)
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      
      // First call for photo, second for album
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Not found' },
        })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album is not public', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
      }

      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        is_public: false,
        deleted_at: null,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
          error: null,
        })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 403 if album is expired', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
      }

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1)

      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        is_public: true,
        deleted_at: null,
        expires_at: expiredDate.toISOString(),
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
          error: null,
        })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('successful update', () => {
    it('should update selection status to true', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
        deleted_at: null,
      }
      
      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        deleted_at: null,
        is_public: true,
        expires_at: null,
      }

      const mockUpdatedPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        is_selected: true,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(data.data.isSelected).toBe(true)
    })

    it('should update selection status to false', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
        deleted_at: null,
      }
      
      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        deleted_at: null,
        is_public: true,
        expires_at: null,
      }

      const mockUpdatedPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        is_selected: false,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: false },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(data.data.isSelected).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database update error', async () => {
      const mockPhoto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        album_id: '550e8400-e29b-41d4-a716-446655440001',
        deleted_at: null,
      }
      
      const mockAlbum = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        deleted_at: null,
        is_public: true,
        expires_at: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockIs = vi.fn().mockReturnThis()
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: mockPhoto,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockAlbum,
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

      const request = createMockRequest('http://localhost:3000/api/public/photos/550e8400-e29b-41d4-a716-446655440000/select', {
        method: 'PATCH',
        body: { isSelected: true },
      })

      const response = await PATCH(request, { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
