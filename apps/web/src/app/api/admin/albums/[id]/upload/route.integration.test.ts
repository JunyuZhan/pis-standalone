/**
 * 上传凭证 API 集成测试
 * 
 * 这些测试使用真实的依赖（如数据库客户端），测试多个模块的协作。
 * 
 * 注意：集成测试需要真实的环境配置，通常需要：
 * - 测试数据库实例（PostgreSQL 或 Supabase）
 * - 测试 MinIO 实例
 * 
 * 运行集成测试：
 * ```bash
 * # 设置测试环境变量
 * export RUN_INTEGRATION_TESTS=true
 * export DATABASE_TYPE=postgresql  # 或 supabase
 * export DATABASE_HOST=localhost
 * export DATABASE_PORT=5432
 * export DATABASE_NAME=test_pis
 * export DATABASE_USER=test_user
 * export DATABASE_PASSWORD=test_password
 * 
 * # 运行集成测试
 * pnpm test -- route.integration.test.ts
 * ```
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { createMockRequest } from '@/test/test-utils'
import { createAdminClient } from '@/lib/database'
import { createTestAlbum, deleteTestAlbum, deleteTestPhotos } from '@/test/integration-helpers'

// 标记为集成测试，可以通过环境变量控制是否运行
const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true'

// Mock presign API
vi.mock('@/middleware-rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 19,
    resetAt: Date.now() + 60000,
  }),
}))

// Mock global fetch for presign API
global.fetch = vi.fn()

describe.skipIf(!shouldRunIntegrationTests)('POST /api/admin/albums/[id]/upload (Integration)', () => {
  let testAlbumId: string
  let testUserId: string
  let adminClient: Awaited<ReturnType<typeof createAdminClient>>
  const createdPhotoIds: string[] = []

  beforeAll(async () => {
    adminClient = await createAdminClient()
    
    // 使用辅助函数创建测试相册
    const album = await createTestAlbum({
      title: `Integration Test Album ${Date.now()}`,
    })
    testAlbumId = album.id

    // 创建测试用户（如果需要）
    // 注意：实际实现需要根据你的认证系统配置
    testUserId = 'test-user-id'
  })

  afterAll(async () => {
    // 使用辅助函数清理所有创建的测试数据
    if (createdPhotoIds.length > 0) {
      await deleteTestPhotos(createdPhotoIds)
    }
    
    if (testAlbumId) {
      await deleteTestAlbum(testAlbumId)
    }
  })

  beforeEach(() => {
    // 重置 fetch mock
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ url: 'https://example.com/presigned-url' }),
    } as any)
  })

  it('should create photo record in database when upload succeeds', async () => {
    // 集成测试：验证照片记录确实被创建到数据库中
    const request = createMockRequest(`http://localhost:3000/api/admin/albums/${testAlbumId}/upload`, {
      method: 'POST',
      headers: {
        cookie: 'test-cookie=value',
      },
      body: {
        filename: 'test-integration.jpg',
        contentType: 'image/jpeg',
        fileSize: 1024,
      },
    })

    // Mock 认证
    vi.spyOn(await import('@/lib/database'), 'createClientFromRequest').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: testUserId, email: 'test@example.com' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: testAlbumId },
          error: null,
        }),
      }),
    } as any)

    const response = await POST(request, { params: Promise.resolve({ id: testAlbumId }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.photoId).toBeDefined()
    expect(data.uploadUrl).toBeDefined()
    expect(data.albumId).toBe(testAlbumId)

    // 验证数据库中的记录
    const { data: photo, error } = await adminClient
      .from('photos')
      .select('*')
      .eq('id', data.photoId)
      .single()

    expect(error).toBeNull()
    expect(photo).toBeDefined()
    expect(photo?.album_id).toBe(testAlbumId)
    expect(photo?.status).toBe('pending')
    expect(photo?.filename).toBe('test-integration.jpg')
    expect(photo?.mime_type).toBe('image/jpeg')

    // 记录创建的 photo ID 以便清理
    createdPhotoIds.push(data.photoId)
  })

  it('should cleanup photo record when presign fails', async () => {
    // 集成测试：验证当 presign 失败时，照片记录被正确清理
    const request = createMockRequest(`http://localhost:3000/api/admin/albums/${testAlbumId}/upload`, {
      method: 'POST',
      body: {
        filename: 'test-cleanup.jpg',
        contentType: 'image/jpeg',
      },
    })

    // Mock presign API 失败
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    // Mock 认证和相册查询
    vi.spyOn(await import('@/lib/supabase/server'), 'createClientFromRequest').mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: testUserId, email: 'test@example.com' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: testAlbumId },
          error: null,
        }),
      }),
    } as any)

    const response = await POST(request, { params: Promise.resolve({ id: testAlbumId }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.code).toBe('PRESIGN_FETCH_ERROR')
    expect(data.photoId).toBeDefined()

    // 等待一下确保清理操作完成
    await new Promise(resolve => setTimeout(resolve, 100))

    // 验证数据库中的记录已被删除
    const { data: photo, error } = await adminClient
      .from('photos')
      .select('*')
      .eq('id', data.photoId)
      .single()

    // 记录应该不存在或已被删除
    expect(photo).toBeNull()
  })

  it('should validate file type restrictions', async () => {
    // 集成测试：验证文件类型限制
    const request = createMockRequest(`http://localhost:3000/api/admin/albums/${testAlbumId}/upload`, {
      method: 'POST',
      body: {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      },
    })

    // Mock 认证
    vi.spyOn(await import('@/lib/database'), 'createClientFromRequest').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: testUserId, email: 'test@example.com' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: testAlbumId },
          error: null,
        }),
      }),
    } as any)

    const response = await POST(request, { params: Promise.resolve({ id: testAlbumId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('INVALID_FILE_TYPE')
  })

  it('should validate file size limits', async () => {
    // 集成测试：验证文件大小限制
    const request = createMockRequest(`http://localhost:3000/api/admin/albums/${testAlbumId}/upload`, {
      method: 'POST',
      body: {
        filename: 'large-file.jpg',
        contentType: 'image/jpeg',
        fileSize: 101 * 1024 * 1024, // 101MB，超过限制
      },
    })

    // Mock 认证
    vi.spyOn(await import('@/lib/database'), 'createClientFromRequest').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: testUserId, email: 'test@example.com' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: testAlbumId },
          error: null,
        }),
      }),
    } as any)

    const response = await POST(request, { params: Promise.resolve({ id: testAlbumId }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('FILE_TOO_LARGE')
  })
})
