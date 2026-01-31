/**
 * 分组详情 API 路由测试
 * 
 * 测试 GET、PATCH、DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/albums/[id]/groups/[groupId]', () => {
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
        'http://localhost:3000/api/admin/albums/album-123/groups/group-123'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'album-123', groupId: 'group-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid album ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/invalid-id/groups/group-123'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id', groupId: 'group-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('group retrieval', () => {
    it('should return group details with photo count', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
      }
      const group = {
        id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        album_id: albumId,
      }
      const assignments = [
        { photo_id: 'photo-1' },
        { photo_id: 'photo-2' },
      ]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
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
        count: 2,
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
          select: mockSelectAssignments,
          eq: mockEqAssignments,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.group.id).toBe(groupId)
      expect(data.data.group.name).toBe('Test Group')
      expect(data.data.group.photo_count).toBe(2)
    })

    it('should return 404 if group does not exist', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock group not found
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
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
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})

describe('PATCH /api/admin/albums/[id]/groups/[groupId]', () => {
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
        'http://localhost:3000/api/admin/albums/album-123/groups/group-123',
        {
          method: 'PATCH',
          body: {
            name: 'Updated Group',
          },
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'album-123', groupId: 'group-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('group update', () => {
    it('should successfully update group name', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
      }
      const group = {
        id: groupId,
        name: 'Old Name',
        album_id: albumId,
      }
      const updatedGroup = {
        ...group,
        name: 'Updated Name',
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
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

      // Mock no duplicate name
      const mockSelectExisting = vi.fn().mockReturnThis()
      const mockEqExisting = vi.fn().mockReturnThis()
      const mockNeqExisting = vi.fn().mockReturnThis()
      const mockSingleExisting = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      // Mock update
      mockAdminDb.update.mockResolvedValue({
        data: [updatedGroup],
        error: null,
      })

      // Mock assignments count
      const mockSelectAssignments = vi.fn().mockReturnThis()
      const mockEqAssignments = vi.fn().mockResolvedValue({
        data: [],
        count: 0,
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
          select: mockSelectExisting,
          eq: mockEqExisting,
          neq: mockNeqExisting,
          single: mockSingleExisting,
        })
        .mockReturnValueOnce({
          select: mockSelectAssignments,
          eq: mockEqAssignments,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}`,
        {
          method: 'PATCH',
          body: {
            name: 'Updated Name',
          },
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.group.name).toBe('Updated Name')
    })

    it('should return 409 if new name conflicts with existing group', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
      }
      const group = {
        id: groupId,
        name: 'Old Name',
        album_id: albumId,
      }
      const conflictingGroup = {
        id: 'other-group-id',
        name: 'Conflicting Name',
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
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

      // Mock duplicate name found
      const mockSelectExisting = vi.fn().mockReturnThis()
      const mockEqExisting = vi.fn().mockReturnThis()
      const mockNeqExisting = vi.fn().mockReturnThis()
      const mockSingleExisting = vi.fn().mockResolvedValue({
        data: conflictingGroup,
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
          select: mockSelectExisting,
          eq: mockEqExisting,
          neq: mockNeqExisting,
          single: mockSingleExisting,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}`,
        {
          method: 'PATCH',
          body: {
            name: 'Conflicting Name',
          },
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error.code).toBe('DUPLICATE_SLUG')
    })
  })
})

describe('DELETE /api/admin/albums/[id]/groups/[groupId]', () => {
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
        'http://localhost:3000/api/admin/albums/album-123/groups/group-123',
        {
          method: 'DELETE',
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

  describe('group deletion', () => {
    it('should successfully delete group', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
      }
      const group = {
        id: groupId,
        album_id: albumId,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
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
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}`,
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
    })

    it('should return 404 if group does not exist', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const groupId = '550e8400-e29b-41d4-a716-446655440001'
      const album = {
        id: albumId,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock group not found
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
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
        `http://localhost:3000/api/admin/albums/${albumId}/groups/${groupId}`,
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: albumId, groupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})
