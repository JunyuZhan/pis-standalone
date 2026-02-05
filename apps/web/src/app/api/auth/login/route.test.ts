/**
 * 登录 API 路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'
import { checkRateLimit } from '@/middleware-rate-limit'

// Mock dependencies
const { mockDatabaseClient } = vi.hoisted(() => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  
  return {
    mockDatabaseClient: {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    }
  }
})

vi.mock('@/lib/database', () => ({
  createClient: vi.fn().mockResolvedValue(mockDatabaseClient),
}))

vi.mock('@/lib/auth', () => ({
  getAuthDatabase: vi.fn(),
  createSession: vi.fn(),
}))

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: vi.fn(),
}))

vi.mock('@/middleware-rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认允许速率限制
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60000,
    })
  })

  it('should return 400 for invalid request body', async () => {
    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: 'invalid-json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    // Route returns plain error string for invalid JSON
    expect(data.error).toBeDefined()
  })

  it('should return 400 for missing email or password', async () => {
    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: '', password: '' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 400 for invalid email format', async () => {
    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'invalid-email', password: 'password123' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    })

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.168.1.1',
      },
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('should extract IP from Cloudflare header', async () => {
    const { getAuthDatabase, createSession } = await import('@/lib/auth')
    const { verifyPassword } = await import('@/lib/auth/password')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      }),
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: Date.now() + 3600,
      user: { id: '1', email: 'test@example.com' },
    })

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '1.2.3.4',
      },
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    })

    await POST(request)

    // 验证速率限制使用了正确的 IP
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('1.2.3.4'),
      expect.any(Number),
      expect.any(Number)
    )
  })

  it('should extract IP from x-forwarded-for header', async () => {
    const { getAuthDatabase, createSession } = await import('@/lib/auth')
    const { verifyPassword } = await import('@/lib/auth/password')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      }),
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: Date.now() + 3600,
      user: { id: '1', email: 'test@example.com' },
    })

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      },
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    })

    await POST(request)

    // 验证使用了第一个 IP
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('1.2.3.4'),
      expect.any(Number),
      expect.any(Number)
    )
  })

  it('should handle login failure', async () => {
    const { getAuthDatabase } = await import('@/lib/auth')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue(null),
    } as any)

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('AUTH_ERROR')
    expect(data.error.message).toBe('邮箱或密码错误')
  })

  it('should handle short email in error logging', async () => {
    const { getAuthDatabase } = await import('@/lib/auth')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue(null),
    } as any)

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: 'ab@c.com', // 长度 7，大于 3，应该显示 'ab@***'
        password: 'wrongpassword',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    // 验证返回了正确的错误响应
    expect(response.status).toBe(401)
    expect(data.error.code).toBe('AUTH_ERROR')
    expect(data.error.message).toBe('邮箱或密码错误')
  })

  it('should handle short email in success logging', async () => {
    const { getAuthDatabase, createSession } = await import('@/lib/auth')
    const { verifyPassword } = await import('@/lib/auth/password')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-123',
        email: 'a@b.c', // 有效但很短的邮箱
        password_hash: 'hashed-password',
      }),
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: Date.now() + 3600,
      user: { id: 'user-123', email: 'a@b.c' },
    })

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: 'a@b.c', // 有效但很短的邮箱
        password: 'password123',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    // 验证成功登录
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.user.id).toBe('user-123')
    expect(data.data.user.email).toBe('a@b.c')
  })

  it('should handle internal errors', async () => {
    const { getAuthDatabase } = await import('@/lib/auth')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockRejectedValue(
        new Error('Database connection failed')
      ),
    } as any)

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    // 内部错误应该返回统一的认证错误消息（防止信息泄露）
    expect(response.status).toBe(401)
    expect(data.error.code).toBe('AUTH_ERROR')
    expect(data.error.message).toBe('邮箱或密码错误')
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    consoleErrorSpy.mockRestore()
  })

  it('should return success response with user data', async () => {
    const { getAuthDatabase, createSession } = await import('@/lib/auth')
    const { verifyPassword } = await import('@/lib/auth/password')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      }),
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: Date.now() + 3600,
      user: { id: 'user-123', email: 'test@example.com' },
    })

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.user.id).toBe('user-123')
    expect(data.data.user.email).toBe('test@example.com')
  })
})
