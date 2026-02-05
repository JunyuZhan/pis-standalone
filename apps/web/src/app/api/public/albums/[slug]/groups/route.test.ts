/**
 * 相册分组列表 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
const { mockSupabaseClientRef } = vi.hoisted(() => {
  const mockClient = {
    from: vi.fn(),
  }
  return {
    mockSupabaseClientRef: { current: mockClient },
  }
})

vi.mock('@/lib/database', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClientRef.current),
}))

describe('GET /api/public/albums/[slug]/groups', () => {

  const validAlbumId = '550e8400-e29b-41d4-a716-446655440000'
  const validGroupId1 = '550e8400-e29b-41d4-a716-446655440001'
  const validGroupId2 = '550e8400-e29b-41d4-a716-446655440002'
  const validPhotoId1 = '550e8400-e29b-41d4-a716-446655440003'
  const validPhotoId2 = '550e8400-e29b-41d4-a716-446655440004'
  const validPhotoId3 = '550e8400-e29b-41d4-a716-446655440005'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset the mock client
    mockSupabaseClientRef.current.from = vi.fn()
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      // Mock album query
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }
      mockSupabaseClientRef.current.from.mockReturnValue(mockChain)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 403 if album is not public', async () => {
      const mockAlbum = {
        id: validAlbumId,
        is_public: false,
        deleted_at: null,
        expires_at: null,
      }

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockAlbum,
          error: null,
        }),
      }
      mockSupabaseClientRef.current.from.mockReturnValue(mockChain)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 403 if album is deleted', async () => {
      const mockAlbum = {
        id: validAlbumId,
        is_public: true,
        deleted_at: '2024-01-01T00:00:00Z',
        expires_at: null,
      }

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockAlbum,
          error: null,
        }),
      }
      mockSupabaseClientRef.current.from.mockReturnValue(mockChain)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should return 403 if album is expired', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1)

      const mockAlbum = {
        id: validAlbumId,
        is_public: true,
        deleted_at: null,
        expires_at: expiredDate.toISOString(),
      }

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockAlbum,
          error: null,
        }),
      }
      mockSupabaseClientRef.current.from.mockReturnValue(mockChain)

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('groups retrieval', () => {
    it('should return groups with photo counts successfully', async () => {
      const mockAlbum = {
        id: validAlbumId,
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockGroups = [
        {
          id: validGroupId1,
          name: 'Group 1',
          album_id: validAlbumId,
        },
        {
          id: validGroupId2,
          name: 'Group 2',
          album_id: validAlbumId,
        },
      ]

      const mockPhotos = [
        { id: validPhotoId1, status: 'completed', deleted_at: null, album_id: validAlbumId },
        { id: validPhotoId2, status: 'completed', deleted_at: null, album_id: validAlbumId },
        { id: validPhotoId3, status: 'completed', deleted_at: null, album_id: validAlbumId },
      ]

      const mockAssignments = [
        { group_id: validGroupId1, photo_id: validPhotoId1 },
        { group_id: validGroupId1, photo_id: validPhotoId2 },
        { group_id: validGroupId2, photo_id: validPhotoId3 },
      ]

      // Setup mocks based on table name
      mockSupabaseClientRef.current.from.mockImplementation((table: string) => {
        if (table === 'albums') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
          }
        }
        if (table === 'photo_groups') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(), // First order
            // We need to handle the second order call which returns the promise
            then: (resolve: (value: unknown) => void) => resolve({ data: mockGroups, error: null }),
          }
        }
        if (table === 'photos') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: mockPhotos, error: null }),
          }
        }
        if (table === 'photo_group_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(), // First in
            // The second in call (or the chain end) needs to resolve
            then: (resolve: (value: unknown) => void) => resolve({ data: mockAssignments, error: null }),
          }
        }
        return {}
      })

      // Fix for chained calls that might need more precise mocking
      // Specifically handling the double order() and double in()
      // A better approach is to return a chain object that handles repeated calls
      
      const mockGroupsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      // @ts-ignore - mockResolvedValue is not standard on the object but we use it for the final result
      mockGroupsChain.order.mockReturnValue(mockGroupsChain) // Allow chaining
      // We need to make the chain awaitable
      // @ts-ignore
      mockGroupsChain.then = (resolve: (value: unknown) => void) => resolve({ data: mockGroups, error: null })
      
      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: mockPhotos, error: null }),
      }

      const mockAssignmentsChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      }
      mockAssignmentsChain.in.mockReturnValue(mockAssignmentsChain)
      // @ts-ignore
      mockAssignmentsChain.then = (resolve: (value: unknown) => void) => resolve({ data: mockAssignments, error: null })

      mockSupabaseClientRef.current.from.mockImplementation((table: string) => {
        if (table === 'albums') return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
        }
        if (table === 'photo_groups') return mockGroupsChain
        if (table === 'photos') return mockPhotosChain
        if (table === 'photo_group_assignments') return mockAssignmentsChain
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.groups).toHaveLength(2)
      // Sort order depends on implementation, but likely ID or name. 
      // The implementation orders by sort_order then created_at.
      // We didn't mock sort_order, so it depends on array order.
      // Group 1 has 2 photos, Group 2 has 1 photo.
      const group1 = data.data.groups.find((g: { id: string; photo_count: number }) => g.id === validGroupId1)
      const group2 = data.data.groups.find((g: { id: string; photo_count: number }) => g.id === validGroupId2)
      
      expect(group1).toBeDefined()
      expect(group1.photo_count).toBe(2)
      expect(group2).toBeDefined()
      expect(group2.photo_count).toBe(1)
    })

    it('should return only groups with photos', async () => {
      const mockAlbum = {
        id: validAlbumId,
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockGroups = [
        {
          id: validGroupId1,
          name: 'Group 1',
          album_id: validAlbumId,
        },
        {
          id: validGroupId2,
          name: 'Empty Group',
          album_id: validAlbumId,
        },
      ]

      const mockPhotos = [
        { id: validPhotoId1, status: 'completed', deleted_at: null, album_id: validAlbumId },
      ]

      const mockAssignments = [
        { group_id: validGroupId1, photo_id: validPhotoId1 },
      ]

      const mockGroupsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockGroupsChain.order.mockReturnValue(mockGroupsChain)
      // @ts-ignore
      mockGroupsChain.then = (resolve: (value: unknown) => void) => resolve({ data: mockGroups, error: null })

      const mockPhotosChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: mockPhotos, error: null }),
      }

      const mockAssignmentsChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      }
      mockAssignmentsChain.in.mockReturnValue(mockAssignmentsChain)
      // @ts-ignore
      mockAssignmentsChain.then = (resolve: (value: unknown) => void) => resolve({ data: mockAssignments, error: null })

      mockSupabaseClientRef.current.from.mockImplementation((table: string) => {
        if (table === 'albums') return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
        }
        if (table === 'photo_groups') return mockGroupsChain
        if (table === 'photos') return mockPhotosChain
        if (table === 'photo_group_assignments') return mockAssignmentsChain
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.groups).toHaveLength(1)
      expect(data.data.groups[0].id).toBe(validGroupId1)
    })

    it('should return empty array if no groups exist', async () => {
      const mockAlbum = {
        id: validAlbumId,
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockGroupsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockGroupsChain.order.mockReturnValue(mockGroupsChain)
      // @ts-ignore
      mockGroupsChain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null })

      mockSupabaseClientRef.current.from.mockImplementation((table: string) => {
        if (table === 'albums') return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
        }
        if (table === 'photo_groups') return mockGroupsChain
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.groups).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 500 on database error when querying groups', async () => {
      const mockAlbum = {
        id: validAlbumId,
        is_public: true,
        deleted_at: null,
        expires_at: null,
      }

      const mockGroupsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      }
      mockGroupsChain.order.mockReturnValue(mockGroupsChain)
      // @ts-ignore
      mockGroupsChain.then = (resolve: (value: unknown) => void) => resolve({ data: null, error: { message: 'Database error' } })

      mockSupabaseClientRef.current.from.mockImplementation((table: string) => {
        if (table === 'albums') return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockAlbum, error: null }),
        }
        if (table === 'photo_groups') return mockGroupsChain
        return {}
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/groups')
      const response = await GET(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(['DB_ERROR', 'INTERNAL_ERROR']).toContain(data.error.code)
    })
  })
})
