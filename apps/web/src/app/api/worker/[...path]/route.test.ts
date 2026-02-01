/**
 * Worker API 代理路由测试
 * 
 * 测试 GET, POST, PUT, DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, PUT, DELETE } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/auth/api-helpers', () => {
  return {
    getCurrentUser: vi.fn(),
  }
})

// Mock global fetch
global.fetch = vi.fn()

describe('Worker API Proxy', () => {
  let mockGetCurrentUser: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    mockGetCurrentUser = getCurrentUser as any
    
    // 默认用户已登录
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })

    // 默认fetch成功
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ success: true }),
    })

    // 设置环境变量
    process.env.WORKER_URL = 'http://worker:3001'
    process.env.WORKER_API_KEY = 'test-api-key'
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated (non-health endpoint)', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should allow health endpoint without authentication', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/health', {
        method: 'GET',
      })

      const response = await GET(request, { params: Promise.resolve({ path: ['health'] }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('ok')
      // 不应该调用 getCurrentUser（health 端点不需要认证）
      expect(mockGetCurrentUser).not.toHaveBeenCalled()
    })
  })

  describe('path mapping', () => {
    it('should map health endpoint correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/health', {
        method: 'GET',
      })

      await GET(request, { params: Promise.resolve({ path: ['health'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://worker:3001/health',
        expect.any(Object)
      )
    })

    it('should map presign endpoint correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ url: 'https://example.com' }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/presign', {
        method: 'GET',
      })

      await GET(request, { params: Promise.resolve({ path: ['presign'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://worker:3001/api/presign',
        expect.any(Object)
      )
    })

    it('should map api/* endpoints correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/api/multipart/init', {
        method: 'POST',
        body: { uploadId: 'upload-123' },
      })

      await POST(request, { params: Promise.resolve({ path: ['api', 'multipart', 'init'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://worker:3001/api/multipart/init',
        expect.any(Object)
      )
    })

    it('should map other endpoints with /api prefix', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      await POST(request, { params: Promise.resolve({ path: ['process'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://worker:3001/api/process',
        expect.any(Object)
      )
    })

    it('should preserve query parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/presign?key=test.jpg', {
        method: 'GET',
      })

      await GET(request, { params: Promise.resolve({ path: ['presign'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://worker:3001/api/presign?key=test.jpg',
        expect.any(Object)
      )
    })
  })

  describe('request forwarding', () => {
    it('should forward GET request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ data: 'test' }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/health', {
        method: 'GET',
      })

      const response = await GET(request, { params: Promise.resolve({ path: ['health'] }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBe('test')
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should forward POST request with JSON body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123', albumId: 'album-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      const fetchCall = (global.fetch as any).mock.calls[0]
      const fetchOptions = fetchCall[1]
      expect(fetchOptions.method).toBe('POST')
      expect(fetchOptions.body).toBe(JSON.stringify({ photoId: 'photo-123', albumId: 'album-123' }))
    })

    it('should forward PUT request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/upload', {
        method: 'PUT',
        body: { data: 'binary' },
      })

      const response = await PUT(request, { params: Promise.resolve({ path: ['upload'] }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should forward DELETE request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/cleanup-file', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ path: ['cleanup-file'] }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should forward binary data correctly', async () => {
      const binaryData = new ArrayBuffer(8)
      const view = new Uint8Array(binaryData)
      view[0] = 0x42

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/octet-stream' }),
        arrayBuffer: async () => binaryData,
      })

      const request = createMockRequest('http://localhost:3000/api/worker/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: binaryData,
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['upload'] }) })
      const data = await response.arrayBuffer()

      expect(response.status).toBe(200)
      expect(new Uint8Array(data)).toEqual(new Uint8Array(binaryData))
    })
  })

  describe('API key authentication', () => {
    it('should add X-API-Key header when WORKER_API_KEY is set', async () => {
      process.env.WORKER_API_KEY = 'test-api-key'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      await POST(request, { params: Promise.resolve({ path: ['process'] }) })

      const fetchCall = (global.fetch as any).mock.calls[0]
      const fetchOptions = fetchCall[1]
      expect(fetchOptions.headers['X-API-Key']).toBe('test-api-key')
    })

    it('should work without API key if not configured', async () => {
      delete process.env.WORKER_API_KEY

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      await POST(request, { params: Promise.resolve({ path: ['process'] }) })

      const fetchCall = (global.fetch as any).mock.calls[0]
      const fetchOptions = fetchCall[1]
      expect(fetchOptions.headers['X-API-Key']).toBeUndefined()
    })
  })

  describe('response handling', () => {
    it('should handle JSON responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ data: 'test', count: 5 }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toBe('test')
      expect(data.count).toBe(5)
    })

    it('should handle binary responses', async () => {
      const binaryData = new ArrayBuffer(8)

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'image/jpeg' }),
        arrayBuffer: async () => binaryData,
      })

      const request = createMockRequest('http://localhost:3000/api/worker/image', {
        method: 'GET',
      })

      const response = await GET(request, { params: Promise.resolve({ path: ['image'] }) })
      const data = await response.arrayBuffer()

      expect(response.status).toBe(200)
      expect(new Uint8Array(data)).toEqual(new Uint8Array(binaryData))
    })

    it('should handle error responses with error format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: 'Missing required field',
          },
        }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toBe('Invalid request')
      expect(data.error.details).toBe('Missing required field')
    })

    it('should handle error responses with string error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          error: 'Internal server error',
        }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('WORKER_ERROR')
      expect(data.error.message).toBe('Internal server error')
    })
  })

  describe('error handling', () => {
    it('should handle connection errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error.code).toBe('WORKER_UNAVAILABLE')
      expect(data.error.message).toBe('Worker 服务不可用')
    })

    it('should handle fetch failed errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'))

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error.code).toBe('WORKER_UNAVAILABLE')
    })

    it('should handle other errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Unknown error'))

      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.resolve({ path: ['process'] }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PROXY_ERROR')
      expect(data.error.message).toBe('Unknown error')
    })

    it('should handle params error', async () => {
      const request = createMockRequest('http://localhost:3000/api/worker/process', {
        method: 'POST',
        body: { photoId: 'photo-123' },
      })

      const response = await POST(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('PROXY_ERROR')
      expect(data.error.message).toBe('Invalid params')
    })
  })

  describe('environment variable fallback', () => {
    it('should use WORKER_URL if set', async () => {
      process.env.WORKER_URL = 'http://custom-worker:3001'
      delete process.env.WORKER_API_URL
      delete process.env.NEXT_PUBLIC_WORKER_URL

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/health', {
        method: 'GET',
      })

      await GET(request, { params: Promise.resolve({ path: ['health'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://custom-worker:3001/health',
        expect.any(Object)
      )
    })

    it('should fallback to WORKER_API_URL', async () => {
      delete process.env.WORKER_URL
      process.env.WORKER_API_URL = 'http://api-worker:3001'
      delete process.env.NEXT_PUBLIC_WORKER_URL

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/health', {
        method: 'GET',
      })

      await GET(request, { params: Promise.resolve({ path: ['health'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://api-worker:3001/health',
        expect.any(Object)
      )
    })

    it('should fallback to NEXT_PUBLIC_WORKER_URL', async () => {
      delete process.env.WORKER_URL
      delete process.env.WORKER_API_URL
      process.env.NEXT_PUBLIC_WORKER_URL = 'http://public-worker:3001'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/health', {
        method: 'GET',
      })

      await GET(request, { params: Promise.resolve({ path: ['health'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://public-worker:3001/health',
        expect.any(Object)
      )
    })

    it('should fallback to default localhost:3001', async () => {
      delete process.env.WORKER_URL
      delete process.env.WORKER_API_URL
      delete process.env.NEXT_PUBLIC_WORKER_URL

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true }),
      })

      const request = createMockRequest('http://localhost:3000/api/worker/health', {
        method: 'GET',
      })

      await GET(request, { params: Promise.resolve({ path: ['health'] }) })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/health',
        expect.any(Object)
      )
    })
  })
})
