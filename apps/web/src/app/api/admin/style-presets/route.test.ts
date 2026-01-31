/**
 * 风格预设 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/style-presets', () => {
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
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
        'http://localhost:3000/api/admin/style-presets'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('preset retrieval', () => {
    it('should return all presets when no category filter', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/style-presets'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.presets).toBeDefined()
      expect(Array.isArray(data.data.presets)).toBe(true)
      expect(data.data.presets.length).toBeGreaterThan(0)
      
      // 验证预设结构
      const preset = data.data.presets[0]
      expect(preset.id).toBeDefined()
      expect(preset.name).toBeDefined()
      expect(preset.category).toBeDefined()
      expect(preset.description).toBeDefined()
      expect(['portrait', 'landscape', 'general']).toContain(preset.category)
    })

    it('should return filtered presets by category', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/style-presets?category=portrait'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.presets).toBeDefined()
      expect(Array.isArray(data.data.presets)).toBe(true)
      
      // 验证所有预设都是 portrait 分类
      data.data.presets.forEach((preset: any) => {
        expect(preset.category).toBe('portrait')
      })
    })

    it('should return landscape presets when category is landscape', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/style-presets?category=landscape'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.presets.forEach((preset: any) => {
        expect(preset.category).toBe('landscape')
      })
    })

    it('should return general presets when category is general', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/style-presets?category=general'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.presets.forEach((preset: any) => {
        expect(preset.category).toBe('general')
      })
    })

    it('should return all presets when invalid category', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/style-presets?category=invalid'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.presets.length).toBeGreaterThan(0)
      // 应该返回所有预设，不进行过滤
    })

    it('should return presets in correct order', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/style-presets'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const presets = data.data.presets
      
      // 验证顺序：portrait -> landscape -> general
      let lastCategory = ''
      for (const preset of presets) {
        if (lastCategory === 'portrait' && preset.category === 'landscape') {
          lastCategory = 'landscape'
        } else if (lastCategory === 'landscape' && preset.category === 'general') {
          lastCategory = 'general'
        } else if (lastCategory === '') {
          lastCategory = preset.category
        }
        
        if (preset.category === 'portrait') {
          expect(['portrait']).toContain(lastCategory)
        } else if (preset.category === 'landscape') {
          expect(['portrait', 'landscape']).toContain(lastCategory)
        } else if (preset.category === 'general') {
          expect(['portrait', 'landscape', 'general']).toContain(lastCategory)
        }
      }
    })
  })
})
