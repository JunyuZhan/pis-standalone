/**
 * 修改密码 API 路由测试
 * 
 * 测试 POST 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock('@/lib/auth/database', () => ({
  initAuthDatabase: vi.fn(),
}))

describe('POST /api/auth/change-password', () => {
  let mockGetCurrentUser: any
  let mockGetAuthDatabase: any
  let mockHashPassword: any
  let mockVerifyPassword: any
  let mockAuthDb: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    const { getAuthDatabase } = await import('@/lib/auth')
    const { hashPassword, verifyPassword } = await import('@/lib/auth/password')
    
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    mockGetAuthDatabase = vi.mocked(getAuthDatabase)
    mockHashPassword = vi.mocked(hashPassword)
    mockVerifyPassword = vi.mocked(verifyPassword)
    
    // 默认用户已登录
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
    
    // 默认数据库已初始化
    mockAuthDb = {
      findUserByEmail: vi.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'current-hash',
      }),
      updateUserPassword: vi.fn().mockResolvedValue(undefined),
    }
    
    mockGetAuthDatabase.mockReturnValue(mockAuthDb)
    
    // 默认密码验证成功
    mockVerifyPassword.mockResolvedValue(true)
    
    // 默认哈希密码成功
    mockHashPassword.mockResolvedValue('hashed-password')
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      
      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        {
          method: 'POST',
          body: {
            currentPassword: 'old',
            newPassword: 'new',
            confirmPassword: 'new',
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
        'http://localhost:3000/api/auth/change-password',
        { method: 'POST', body: 'invalid json' }
      )
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if currentPassword is missing', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        {
          method: 'POST',
          body: {
            newPassword: 'new',
            confirmPassword: 'new',
          },
        }
      )
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 if newPassword is missing', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        {
          method: 'POST',
          body: {
            currentPassword: 'old',
            confirmPassword: 'new',
          },
        }
      )
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('password change', () => {
    it('should change password successfully', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        {
          method: 'POST',
          body: {
            currentPassword: 'old-password',
            newPassword: 'new-password',
            confirmPassword: 'new-password',
          },
        }
      )
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe('密码修改成功')
      expect(mockAuthDb.updateUserPassword).toHaveBeenCalledWith('user-123', 'hashed-password')
    })

    it('should return 404 if user does not exist', async () => {
      mockAuthDb.findUserByEmail.mockResolvedValue(null)
      
      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        {
          method: 'POST',
          body: {
            currentPassword: 'old-password',
            newPassword: 'new-password',
            confirmPassword: 'new-password',
          },
        }
      )
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(404)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 400 if current password is incorrect', async () => {
      mockVerifyPassword.mockResolvedValue(false)
      
      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        {
          method: 'POST',
          body: {
            currentPassword: 'wrong-password',
            newPassword: 'new-password',
            confirmPassword: 'new-password',
          },
        }
      )
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should handle database errors', async () => {
      mockAuthDb.updateUserPassword.mockRejectedValue(new Error('Database error'))
      
      const request = createMockRequest(
        'http://localhost:3000/api/auth/change-password',
        {
          method: 'POST',
          body: {
            currentPassword: 'old-password',
            newPassword: 'new-password',
            confirmPassword: 'new-password',
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
