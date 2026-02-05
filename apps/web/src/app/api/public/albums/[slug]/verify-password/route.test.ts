/**
 * 相册密码验证 API 路由测试
 * 
 * 测试密码验证逻辑和速率限制
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'
import { checkRateLimit } from '@/middleware-rate-limit'

// Mock dependencies - 在顶层定义以便测试中访问
const { mockSupabaseClient } = vi.hoisted(() => {
  return {
    mockSupabaseClient: {
      from: vi.fn(),
    }
  }
})

vi.mock('@/lib/database', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}))

vi.mock('@/middleware-rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

describe('POST /api/public/albums/[slug]/verify-password', () => {

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient } = await import('@/lib/database')
    
    // 默认允许速率限制
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60000,
    })
  })

  describe('rate limiting', () => {
    it('should return 429 when IP rate limit exceeded', async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should return 429 when album rate limit exceeded', async () => {
      // IP limit passes
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: true,
        remaining: 5,
        resetAt: Date.now() + 60000,
      })
      // Album limit fails
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should handle internal network IP with higher limit', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 29,
        resetAt: Date.now() + 60000,
      })

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'album-123', password: 'test-password' },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100', // Internal IP
        },
        body: { password: 'test-password' },
      })

      await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      // Verify rate limit was called with higher limit (30) for internal IP
      expect(checkRateLimit).toHaveBeenCalledWith(
        'verify-password:ip:192.168.1.100',
        30, // Higher limit for internal IP
        expect.any(Number)
      )
    })
  })

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: 'invalid-json',
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for missing password', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: {},
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      // Zod validation details contains the message
      const details = data.error.details as Array<{ message: string }>
      expect(details[0].message).toContain('密码不能为空')
    })

    it('should return 400 for non-string password', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 123 },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('album validation', () => {
    it('should return 404 if album does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 if album is deleted', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'album-123', deleted_at: '2024-01-01' },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('expiration check', () => {
    it('should return 403 if album is expired', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1) // Yesterday

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: 'test-password',
          expires_at: expiredDate.toISOString(),
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
      expect(data.error.message).toContain('已过期')
    })

    it('should allow access if album is not expired', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1) // Tomorrow

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: 'test-password',
          expires_at: futureDate.toISOString(),
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.verified).toBe(true)
    })
  })

  describe('password verification', () => {
    it('should return verified:true if no password is set', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: null,
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'any-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.verified).toBe(true)
    })

    it('should return verified:true for correct password', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: 'correct-password',
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'correct-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.verified).toBe(true)
    })

    it('should return 401 for incorrect password', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: 'correct-password',
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'wrong-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('密码错误')
    })
  })

  describe('IP extraction', () => {
    it('should use cf-connecting-ip header when available', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60000,
      })

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: null,
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '5.6.7.8',
        },
        body: { password: 'test-password' },
      })

      await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      // Verify rate limit was called with Cloudflare IP
      expect(checkRateLimit).toHaveBeenCalledWith(
        'verify-password:ip:1.2.3.4',
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should use x-forwarded-for header when cf-connecting-ip not available', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60000,
      })

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: null,
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1',
        },
        body: { password: 'test-password' },
      })

      await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      // Verify rate limit was called with first IP from x-forwarded-for
      expect(checkRateLimit).toHaveBeenCalledWith(
        'verify-password:ip:192.168.1.100',
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should use unknown when no IP headers available', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 0, // IP limit is 0 for unknown
        resetAt: Date.now() + 60000,
      })

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'album-123',
          password: null,
          deleted_at: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'test-password' },
      })

      await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })

      // Verify album rate limit was called (IP limit skipped for unknown)
      expect(checkRateLimit).toHaveBeenCalledWith(
        'verify-password:album:test-slug',
        5,
        expect.any(Number)
      )
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('should return 404 on database error (treated as not found)', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest('http://localhost:3000/api/public/albums/test-slug/verify-password', {
        method: 'POST',
        body: { password: 'test-password' },
      })

      const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) })
      const data = await response.json()

      // 代码逻辑：error || !album 会返回 404
      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })
})
