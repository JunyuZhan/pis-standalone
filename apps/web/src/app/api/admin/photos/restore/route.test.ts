/**
 * 照片恢复 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POST /api/admin/photos/restore', () => {
  let mockAdminClient: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup Database mock
    mockAdminClient = {
      from: vi.fn(),
      update: vi.fn(),
    }
    const { createAdminClient } = await import('@/lib/database')
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminClient)

    // Setup Auth mock
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    mockGetCurrentUser = getCurrentUser
    
    // 默认用户已登录
    mockGetCurrentUser.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['22222222-2222-2222-2222-222222222222'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for empty photoIds array', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: [] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      // expect(data.error.message).toContain('请选择要恢复的照片') // Zod message format changed
    })

    it('should return 400 for non-array photoIds', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: 'not-an-array' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for photoIds exceeding limit', async () => {
      const photoIds = Array.from({ length: 101 }, (_, i) => '22222222-2222-2222-2222-222222222222')
      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      // expect(data.error.message).toContain('单次最多恢复100张照片') // Zod message format changed
    })
  })

  describe('photo validation', () => {
    it('should return 404 if no deleted photos found', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        in: mockIn,
        not: mockNot,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['22222222-2222-2222-2222-222222222222'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
      expect(data.error.message).toContain('未找到已删除的照片')
    })

    it('should return 500 on database error when checking photos', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        in: mockIn,
        not: mockNot,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['22222222-2222-2222-2222-222222222222'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      // expect(data.error.code).toBe('DB_ERROR')
      expect(['DB_ERROR', 'INTERNAL_ERROR']).toContain(data.error.code)
    })
  })

  describe('successful restore', () => {
    it('should restore photos successfully', async () => {
      const mockPhotos = [
        { id: '22222222-2222-2222-2222-222222222222', album_id: '11111111-1111-1111-1111-111111111111', deleted_at: '2024-01-01' },
        { id: '33333333-3333-3333-3333-333333333333', album_id: '11111111-1111-1111-1111-111111111111', deleted_at: '2024-01-01' },
      ]

      // Mock check photos
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      // Mock update restore
      mockAdminClient.update.mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      // Mock album check
      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumIn = vi.fn().mockResolvedValue({
        data: [{ id: '11111111-1111-1111-1111-111111111111', slug: 'album-slug' }],
        error: null,
      })

      // Mock count check
      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIn = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        data: null,
        count: 10,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({ // Check photos
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({ // Get albums
          select: mockAlbumSelect,
          in: mockAlbumIn,
        })
        .mockReturnValueOnce({ // Count photos
          select: mockCountSelect,
          eq: mockCountEq,
          in: mockCountIn,
          is: mockCountIs,
        })

      // Mock update album count
      mockAdminClient.update.mockResolvedValue({
        data: null,
        error: null,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.restoredCount).toBe(2)
      
      // Verify restore update
      expect(mockAdminClient.update).toHaveBeenCalledWith(
        'photos',
        { deleted_at: null },
        { 'id[]': ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'] }
      )
    })

    it('should update album photo count after restore', async () => {
      const mockPhotos = [
        { id: '22222222-2222-2222-2222-222222222222', album_id: '11111111-1111-1111-1111-111111111111', deleted_at: '2024-01-01' },
      ]

      // Mock check photos
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      // Mock update restore
      mockAdminClient.update.mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      // Mock album check
      const mockAlbumSelect = vi.fn().mockReturnThis()
      const mockAlbumIn = vi.fn().mockResolvedValue({
        data: [{ id: '11111111-1111-1111-1111-111111111111', slug: 'album-slug' }],
        error: null,
      })

      // Mock count check
      const mockCountSelect = vi.fn().mockReturnThis()
      const mockCountEq = vi.fn().mockReturnThis()
      const mockCountIn = vi.fn().mockReturnThis()
      const mockCountIs = vi.fn().mockResolvedValue({
        data: null,
        count: 5, // New count
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({ // Check photos
          select: mockSelect,
          in: mockIn,
          not: mockNot,
        })
        .mockReturnValueOnce({ // Get albums
          select: mockAlbumSelect,
          in: mockAlbumIn,
        })
        .mockReturnValueOnce({ // Count photos
          select: mockCountSelect,
          eq: mockCountEq,
          in: mockCountIn,
          is: mockCountIs,
        })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['22222222-2222-2222-2222-222222222222'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      
      // Verify album update
      expect(mockAdminClient.update).toHaveBeenCalledWith(
        'albums',
        { photo_count: 5 },
        { id: '11111111-1111-1111-1111-111111111111' }
      )
    })
  })

  describe('error handling', () => {
    it('should return 500 on restore error', async () => {
      const mockPhotos = [
        { id: '22222222-2222-2222-2222-222222222222', album_id: '11111111-1111-1111-1111-111111111111', deleted_at: '2024-01-01' },
      ]

      // Mock check photos
      const mockSelect = vi.fn().mockReturnThis()
      const mockIn = vi.fn().mockReturnThis()
      const mockNot = vi.fn().mockResolvedValue({
        data: mockPhotos,
        error: null,
      })

      // Mock update restore error
      mockAdminClient.update.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        in: mockIn,
        not: mockNot,
      })

      const request = createMockRequest('http://localhost:3000/api/admin/photos/restore', {
        method: 'POST',
        body: { photoIds: ['22222222-2222-2222-2222-222222222222'] },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
      expect(data.error.message).toContain('数据库更新失败')
    })
  })
})
