/**
 * 分组列表 API 路由测试
 * 
 * 测试 GET 和 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/albums/[id]/groups', () => {
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
        'http://localhost:3000/api/admin/albums/album-123/groups'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'album-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid album ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/invalid-id/groups'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('group retrieval', () => {
    it('should return groups list with photo counts', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
      }
      const groups = [
        { id: 'group-1', name: 'Group 1', album_id: albumId },
        { id: 'group-2', name: 'Group 2', album_id: albumId },
      ]
      const assignments1 = [{ photo_id: 'photo-1' }, { photo_id: 'photo-2' }]
      const assignments2 = [{ photo_id: 'photo-3' }]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock groups query
      const mockSelectGroups = vi.fn().mockReturnThis()
      const mockEqGroups = vi.fn().mockReturnThis()
      const mockOrderGroups = vi.fn().mockResolvedValue({
        data: groups,
        error: null,
      })

      // Mock assignments queries
      const mockSelectAssignments1 = vi.fn().mockReturnThis()
      const mockEqAssignments1 = vi.fn().mockResolvedValue({
        data: assignments1,
        count: 2,
        error: null,
      })

      const mockSelectAssignments2 = vi.fn().mockReturnThis()
      const mockEqAssignments2 = vi.fn().mockResolvedValue({
        data: assignments2,
        count: 1,
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
          select: mockSelectGroups,
          eq: mockEqGroups,
          order: mockOrderGroups,
        })
        .mockReturnValueOnce({
          select: mockSelectAssignments1,
          eq: mockEqAssignments1,
        })
        .mockReturnValueOnce({
          select: mockSelectAssignments2,
          eq: mockEqAssignments2,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.groups).toBeDefined()
      expect(data.data.groups.length).toBe(2)
      expect(data.data.groups[0].photo_count).toBe(2)
      expect(data.data.groups[1].photo_count).toBe(1)
    })

    it('should return 404 if album does not exist', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      
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
        `http://localhost:3000/api/admin/albums/${albumId}/groups`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})

describe('POST /api/admin/albums/[id]/groups', () => {
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
        'http://localhost:3000/api/admin/albums/album-123/groups',
        {
          method: 'POST',
          body: {
            name: 'New Group',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: 'album-123' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid album ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/invalid-id/groups',
        {
          method: 'POST',
          body: {
            name: 'New Group',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for empty name', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups`,
        {
          method: 'POST',
          body: {
            name: '',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('group creation', () => {
    it('should successfully create group', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
      }
      const newGroup = {
        id: 'new-group-id',
        album_id: albumId,
        name: 'New Group',
        description: 'Group description',
        sort_order: 0,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock no existing group with same name
      const mockSelectExisting = vi.fn().mockReturnThis()
      const mockEqExisting = vi.fn().mockReturnThis()
      const mockSingleExisting = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      // Mock insert
      mockAdminDb.insert.mockResolvedValue({
        data: [newGroup],
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
          select: mockSelectExisting,
          eq: mockEqExisting,
          single: mockSingleExisting,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups`,
        {
          method: 'POST',
          body: {
            name: 'New Group',
            description: 'Group description',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.group.id).toBe(newGroup.id)
      expect(data.data.group.name).toBe('New Group')
      expect(data.data.group.photo_count).toBe(0)
    })

    it('should return 409 if group name already exists', async () => {
      const albumId = '550e8400-e29b-41d4-a716-446655440000'
      const album = {
        id: albumId,
      }
      const existingGroup = {
        id: 'existing-group-id',
        name: 'Existing Group',
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock existing group found
      const mockSelectExisting = vi.fn().mockReturnThis()
      const mockEqExisting = vi.fn().mockReturnThis()
      const mockSingleExisting = vi.fn().mockResolvedValue({
        data: existingGroup,
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
          select: mockSelectExisting,
          eq: mockEqExisting,
          single: mockSingleExisting,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${albumId}/groups`,
        {
          method: 'POST',
          body: {
            name: 'Existing Group',
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: albumId }),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error.code).toBe('DUPLICATE_SLUG')
    })
  })
})
