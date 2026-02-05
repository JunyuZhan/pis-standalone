import { NextRequest, NextResponse } from 'next/server'
import { vi } from 'vitest'

/**
 * 创建模拟的 NextRequest
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
    cookies?: Record<string, string>
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body, cookies = {} } = options

  const requestInit: {
    method?: string
    headers?: Headers
    body?: string
  } = {
    method,
    headers: new Headers(headers),
  }

  if (body) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
    if (!headers['Content-Type']) {
      requestInit.headers = new Headers({
        ...headers,
        'Content-Type': 'application/json',
      })
    }
  }

  // 使用 NextRequest 构造函数，避免类型不兼容
  return new NextRequest(url, {
    method: requestInit.method,
    headers: requestInit.headers,
    body: requestInit.body,
  })
}

/**
 * 创建带有认证 cookie 的 mock NextRequest
 * 
 * @param url - 请求 URL
 * @param userId - 用户 ID
 * @param email - 用户邮箱
 * @param options - 其他选项
 */
export function createAuthenticatedRequest(
  url: string,
  userId: string,
  email: string,
  options: {
    method?: string
    headers?: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
    cookieName?: string
    cookieValue?: string
  } = {}
): NextRequest {
  // 使用测试密钥生成 token（确保与测试环境一致）
  const jwtSecret = new TextEncoder().encode(
    process.env.AUTH_JWT_SECRET || 'test-secret-key-minimum-32-characters-long!'
  )
  
  // 创建 mock token（这里简化处理，实际需要 jose 库生成）
  // 测试中我们直接设置 cookie 值，由 mock 的 verifyToken 处理
  const { method = 'POST', headers = {}, body, cookieName = 'pis-auth-token', cookieValue } = options

  const requestInit: {
    method: string
    headers: Headers
    body?: string
  } = {
    method,
    headers: new Headers(headers),
  }

  if (body) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
    if (!headers['Content-Type']) {
      requestInit.headers = new Headers({
        ...headers,
        'Content-Type': 'application/json',
      })
    }
  }

  // 创建 request，然后设置 cookie
  const request = new NextRequest(url, {
    method: requestInit.method,
    headers: requestInit.headers,
    body: requestInit.body,
  })

  // 设置认证 cookie
  if (cookieValue) {
    // 使用 Headers 方法设置 cookie
    const currentCookies = request.headers.get('cookie') || ''
    request.headers.set('cookie', `${cookieName}=${cookieValue}; ${currentCookies}`)
  }

  return request
}

/**
 * 创建模拟的 Supabase 客户端（向后兼容）
 * @deprecated 使用 createMockDatabaseClient 代替
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockSupabaseClient(overrides: Record<string, any> = {}) {
  return createMockDatabaseClient(overrides)
}

/**
 * 创建模拟的数据库客户端（PostgreSQL 或 Supabase）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockDatabaseClient(overrides: Record<string, any> = {}) {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: overrides.selectData || null,
      error: overrides.selectError || null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: overrides.selectData || null,
      error: overrides.selectError || null,
    }),
    execute: vi.fn().mockResolvedValue({
      data: overrides.selectData || [],
      error: overrides.selectError || null,
      count: overrides.count || (overrides.selectData ? (Array.isArray(overrides.selectData) ? overrides.selectData.length : 1) : 0),
    }),
  }

  return {
    // 兼容 Supabase auth API
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.user || null },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: overrides.signInUser || null,
          session: overrides.session || null,
        },
        error: overrides.signInError || null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({
        data: { user: overrides.user || null },
        error: null,
      }),
    },
    // 数据库查询 API（兼容 Supabase 和 PostgreSQL）
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    // PostgreSQL 特定 API
    insert: vi.fn().mockResolvedValue({
      data: overrides.insertData || null,
      error: overrides.insertError || null,
    }),
    update: vi.fn().mockResolvedValue({
      data: overrides.updateData || null,
      error: overrides.updateError || null,
    }),
    delete: vi.fn().mockResolvedValue({
      data: overrides.deleteData || null,
      error: overrides.deleteError || null,
    }),
    rpc: vi.fn().mockResolvedValue({
      data: overrides.rpcData || null,
      error: overrides.rpcError || null,
    }),
    ...overrides,
  }
}
