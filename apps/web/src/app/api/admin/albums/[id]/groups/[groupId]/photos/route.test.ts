/**
 * 分组照片 API 路由测试
 * 
 * 测试 GET、POST、DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/albums/[id]/groups/[groupId]/photos', () => {
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

  describe('validation', () => {
    it('should return 400 for invalid album ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/invalid-id/groups/group-123/photos'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id', groupId: 'group-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid group ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/album-123/groups/invalid-id/photos'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000', groupId: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('permissions', () => {
    it('should allow access for album owner', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
        user_id: 'user-123',
        is_public: false,
      }
      const group = {
        id: groupId,
      }
      const assignments = [
        { photo_id: 'photo-1' },
        { photo_id: 'photo-2' },
      ]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: group,
        error: null,
      })

      // Mock assignments query
      const mockSelectAssignments = vi.fn().mockReturnThis()
      const mockEqAssignments = vi.fn().mockResolvedValue({
        data: assignments,
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })
        .mockReturnValueOnce({
          select: mockSelectAssignments,
          eq: mockEqAssignments,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}/photos`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photo_ids).toEqual(['photo-1', 'photo-2'])
    })

    it('should allow access for public albums', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
        user_id: 'other-user',
        is_public: true,
      }
      const group = {
        id: groupId,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: group,
        error: null,
      })

      // Mock assignments query
      const mockSelectAssignments = vi.fn().mockReturnThis()
      const mockEqAssignments = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })
        .mockReturnValueOnce({
          select: mockSelectAssignments,
          eq: mockEqAssignments,
        })

      // User not logged in
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}/photos`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photo_ids).toEqual([])
    })

    it('should return 403 for private albums without access', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
        user_id: 'other-user',
        is_public: false,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      mockDb.from.mockReturnValue({
        select: mockSelectAlbum,
        eq: mockEqAlbum,
        single: mockSingleAlbum,
      })

      // User not logged in
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}/photos`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })
})

describe('POST /api/admin/albums/[id]/groups/[groupId]/photos', () => {
  let mockDb: any
  let mockAdminDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    mockAdminDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminDb)
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
        'http://localhost:3000/api/admin/albums/album-123/groups/group-123/photos',
        {
          method: 'POST',
          body: {
            photo_ids: ['photo-1'],
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: 'album-123', groupId: 'group-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid photo_ids', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}/photos`,
        {
          method: 'POST',
          body: {
            photo_ids: [],
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('photo assignment', () => {
    it('should successfully assign photos to group', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const photoIds = ['photo-1', 'photo-2']

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: albumId },
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: { id: groupId },
        error: null,
      })

      // Mock photos exist
      const mockSelectPhotos = vi.fn().mockReturnThis()
      const mockEqPhotos = vi.fn().mockReturnThis()
      const mockInPhotos = vi.fn().mockResolvedValue({
        data: photoIds.map(id => ({ id })),
        error: null,
      })

      // Mock existing assignments (empty)
      const mockSelectExisting = vi.fn().mockReturnThis()
      const mockEqExisting = vi.fn().mockReturnThis()
      const mockInExisting = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      // Mock insert
      mockAdminDb.insert.mockResolvedValue({
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
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })
        .mockReturnValueOnce({
          select: mockSelectPhotos,
          eq: mockEqPhotos,
          in: mockInPhotos,
        })

      mockAdminDb.from.mockReturnValue({
        select: mockSelectExisting,
        eq: mockEqExisting,
        in: mockInExisting,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}/photos`,
        {
          method: 'POST',
          body: {
            photo_ids: photoIds,
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.assigned_count).toBe(2)
    })
  })
})

describe('DELETE /api/admin/albums/[id]/groups/[groupId]/photos', () => {
  let mockDb: any
  let mockAdminDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    mockAdminDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminDb)
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
        'http://localhost:3000/api/admin/albums/album-123/groups/group-123/photos',
        {
          method: 'DELETE',
          body: {
            photo_ids: ['photo-1'],
          },
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'album-123', groupId: 'group-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('photo removal', () => {
    it('should successfully remove photos from group', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const photoIds = ['photo-1', 'photo-2']

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: albumId },
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: { id: groupId },
        error: null,
      })

      // Mock delete
      mockAdminDb.delete.mockResolvedValue({
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
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}/photos`,
        {
          method: 'DELETE',
          body: {
            photo_ids: photoIds,
          },
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.removed_count).toBe(2)
    })
  })
})
