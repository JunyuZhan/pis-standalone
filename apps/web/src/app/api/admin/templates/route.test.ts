/**
 * 模板管理 API 路由测试
 * 
 * 测试 GET 和 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/templates', () => {
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

      const request = createMockRequest('http://localhost:3000/api/admin/templates')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('template retrieval', () => {
    it('should return templates list', async () => {
      const templates = [
        {
          id: 'template-1',
          name: 'Template 1',
          description: 'Description 1',
          is_public: false,
          layout: 'masonry',
          sort_rule: 'capture_desc',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'template-2',
          name: 'Template 2',
          description: 'Description 2',
          is_public: true,
          layout: 'grid',
          sort_rule: 'manual',
          created_at: '2024-01-02T00:00:00Z',
        },
      ]

      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: templates,
          error: null,
        }),
      })

      const request = createMockRequest('http://localhost:3000/api/admin/templates')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.templates).toHaveLength(2)
      expect(data.data.templates[0].name).toBe('Template 1')
    })

    it('should return empty array if no templates', async () => {
      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })

      const request = createMockRequest('http://localhost:3000/api/admin/templates')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.templates).toHaveLength(0)
    })

    it('should handle database errors', async () => {
      mockDb.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      })

      const request = createMockRequest('http://localhost:3000/api/admin/templates')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('POST /api/admin/templates', () => {
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
        'http://localhost:3000/api/admin/templates',
        {
          method: 'POST',
          body: {
            name: 'New Template',
            description: 'Description',
            settings: {},
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid request body', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates',
        { method: 'POST', body: {} }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if name is missing', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates',
        {
          method: 'POST',
          body: {
            description: 'Description',
            settings: {},
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('template creation', () => {
    it('should create template successfully', async () => {
      const newTemplate = {
        id: 'template-new',
        name: 'New Template',
        description: 'Description',
        is_public: false,
        layout: 'masonry',
        sort_rule: 'capture_desc',
        allow_download: false,
        allow_batch_download: true,
        show_exif: true,
        password: null,
        expires_at: null,
        watermark_enabled: false,
        watermark_type: null,
        watermark_config: {},
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDb.insert.mockResolvedValue({
        data: [newTemplate],
        error: null,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates',
        {
          method: 'POST',
          body: {
            name: 'New Template',
            description: 'Description',
            settings: {},
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('New Template')
    })

    it('should create template with settings', async () => {
      const newTemplate = {
        id: 'template-new',
        name: 'New Template',
        is_public: true,
        layout: 'grid',
        sort_rule: 'manual',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockDb.insert.mockResolvedValue({
        data: [newTemplate],
        error: null,
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates',
        {
          method: 'POST',
          body: {
            name: 'New Template',
            settings: {
              is_public: true,
              layout: 'grid',
              sort_rule: 'manual',
            },
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle database errors', async () => {
      mockDb.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const request = createMockRequest(
        'http://localhost:3000/api/admin/templates',
        {
          method: 'POST',
          body: {
            name: 'New Template',
            settings: {},
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
