/**
 * 模板详情 API 路由测试
 * 
 * 测试 GET、PATCH 和 DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/templates/[id]', () => {
  let mockDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/admin/templates/template-1')

      const response = await GET(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid template ID', async () => {
      const request = createMockRequest('http://localhost:3000/api/admin/templates/invalid-id')

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('template retrieval', () => {
    it('should return template details', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440000'
      const template = {
        id: templateId,
        name: 'Template 1',
        description: 'Description',
        is_public: false,
        layout: 'masonry',
        sort_rule: 'capture_desc',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: template,
          error: null,
        }),
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/templates/${templateId}`)

      const response = await GET(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(templateId)
      expect(data.data.name).toBe('Template 1')
    })

    it('should return 404 if template does not exist', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440000'

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/templates/${templateId}`)

      const response = await GET(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})

describe('PATCH /api/admin/templates/[id]', () => {
  let mockDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates/template-1',
        { method: 'PATCH', body: { name: 'Updated Template' } }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid template ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates/invalid-id',
        { method: 'PATCH', body: { name: 'Updated Template' } }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('template update', () => {
    it('should update template successfully', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440000'
      const updatedTemplate = {
        id: templateId,
        name: 'Updated Template',
        description: 'Updated Description',
        is_public: true,
        layout: 'grid',
        sort_rule: 'manual',
      }

      mockDb.update.mockResolvedValue({
        data: [updatedTemplate],
        error: null,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/templates/${templateId}`,
        {
          method: 'PATCH',
          body: {
            name: 'Updated Template',
            description: 'Updated Description',
            settings: {
              is_public: true,
              layout: 'grid',
              sort_rule: 'manual',
            },
          },
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Template')
    })

    it('should update only provided fields', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440000'
      const updatedTemplate = {
        id: templateId,
        name: 'Updated Template',
      }

      mockDb.update.mockResolvedValue({
        data: [updatedTemplate],
        error: null,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/templates/${templateId}`,
        {
          method: 'PATCH',
          body: {
            name: 'Updated Template',
          },
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle database errors', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440000'

      mockDb.update.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/templates/${templateId}`,
        {
          method: 'PATCH',
          body: {
            name: 'Updated Template',
          },
        }
      )

      const response = await PATCH(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('DELETE /api/admin/templates/[id]', () => {
  let mockDb: any
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates/template-1',
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid template ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates/invalid-id',
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('template deletion', () => {
    it('should delete template successfully', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440000'

      mockDb.delete.mockResolvedValue({
        data: null,
        error: null,
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/templates/${templateId}`,
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.success).toBe(true)
    })

    it('should handle database errors', async () => {
      const templateId = '550e8400-e29b-41d4-a716-446655440000'

      mockDb.delete.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/templates/${templateId}`,
        { method: 'DELETE' }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: templateId }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
