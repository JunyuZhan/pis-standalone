/**
 * 登录 API 路由测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'
import { checkRateLimit } from '@/middleware-rate-limit'

// Mock dependencies
vi.mock('@/lib/database', () => {
  const { createMockDatabaseClient } = require('@/test/test-utils')
  return {
    createClient: vi.fn().mockResolvedValue(createMockDatabaseClient()),
  }
})

vi.mock('@/lib/auth', () => ({
  getAuthDatabase: vi.fn(),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
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
    expect(data.error.code).toBe('INVALID_REQUEST')
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
    const { getAuthDatabase, verifyPassword, createSession } = await import('@/lib/auth')
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
    const { getAuthDatabase, verifyPassword } = await import('@/lib/auth')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue(null),
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

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
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })

  it('should handle short email in error logging', async () => {
    const { getAuthDatabase } = await import('@/lib/auth')
    const { verifyPassword } = await import('@/lib/auth/password')
    vi.mocked(getAuthDatabase).mockReturnValue({
      findUserByEmail: vi.fn().mockResolvedValue(null),
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: 'ab@c.com', // 长度 7，大于 3，应该显示 'ab@***'
        password: 'wrongpassword',
      },
    })

    await POST(request)

    // 验证短邮箱被正确处理
    expect(consoleSpy).toHaveBeenCalled()
    const logCall = consoleSpy.mock.calls[0][0]
    const logData = JSON.parse(logCall)
    expect(logData.email).toBe('ab@***') // 长度 > 3，显示前3个字符 + ***
    
    consoleSpy.mockRestore()
  })

  it('should handle short email in success logging', async () => {
    const { createClient } = await import('@/lib/database')
    const mockClient = await createClient()
    vi.mocked(mockClient.auth.signInWithPassword).mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'a@b.c' }, // 有效但很短的邮箱
        session: { access_token: 'token' },
      },
      error: null,
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const request = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: 'a@b.c', // 有效但很短的邮箱
        password: 'password123',
      },
    })

    await POST(request)

    // 验证成功登录时也记录了邮箱（会被掩码）
    expect(consoleSpy).toHaveBeenCalled()
    const logCall = consoleSpy.mock.calls[0][0]
    const logData = JSON.parse(logCall)
    expect(logData.success).toBe(true)
    // 短邮箱会被掩码处理
    expect(logData.email).toBeDefined()
    
    consoleSpy.mockRestore()
  })

  it('should handle internal errors', async () => {
    const { createClient } = await import('@/lib/database')
    const mockClient = await createClient()
    vi.mocked(mockClient.auth.signInWithPassword).mockRejectedValue(
      new Error('Database connection failed')
    )

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

    expect(response.status).toBe(500)
    expect(data.error.code).toBe('INTERNAL_ERROR')
    expect(data.error.message).toBe('登录失败，请重试')
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    consoleErrorSpy.mockRestore()
  })

  it('should return success response with user data', async () => {
    const { createClient } = await import('@/lib/database')
    const mockClient = await createClient()
    vi.mocked(mockClient.auth.signInWithPassword).mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token' },
      },
      error: null,
    })

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

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
    expect(data.user.id).toBe('user-123')
    expect(data.user.email).toBe('test@example.com')
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })
})
