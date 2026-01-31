import { NextRequest } from 'next/server'
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
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options

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
