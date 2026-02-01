/**
 * PIS Web - 数据库适配器工厂
 *
 * 根据 DATABASE_TYPE 环境变量选择使用 Supabase 或 PostgreSQL
 * 提供统一的 API 接口，方便切换数据库后端
 *
 * @author PIS Contributors
 * @license MIT
 *
 * @description
 * 支持两种数据库模式：
 * - `supabase`: 使用 Supabase 客户端（向后兼容）
 * - `postgresql`: 使用原生 PostgreSQL 客户端（自托管模式）
 *
 * @example
 * ```typescript
 * import { createClient, createAdminClient } from '@/lib/database'
 *
 * // 在 Server Components 中
 * const db = await createClient()
 * const { data } = await db.from('albums').select('*')
 *
 * // 在需要绕过权限检查时
 * const adminDb = await createAdminClient()
 * ```
 */
import type { DatabaseClientInterface } from './types'

/**
 * 数据库客户端类型
 *
 * @description
 * 兼容 Supabase Client 和 PostgreSQL Client 的统一类型
 * 由于两种客户端的 API 不完全一致，使用 `unknown` 作为基础类型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DatabaseClient = DatabaseClientInterface & Record<string, any>

/**
 * 获取数据库类型
 *
 * @returns 数据库类型（'supabase' 或 'postgresql'）
 *
 * @internal
 */
function getDatabaseType(): 'supabase' | 'postgresql' {
  const dbType = (process.env.DATABASE_TYPE || 'postgresql').toLowerCase()
  return dbType === 'supabase' ? 'supabase' : 'postgresql'
}

/**
 * 创建数据库客户端（用于 Server Components）
 *
 * @description
 * 根据 DATABASE_TYPE 环境变量返回 Supabase 或 PostgreSQL 客户端
 *
 * @returns 数据库客户端实例
 *
 * @example
 * ```typescript
 * // 在 Server Component 中
 * import { createClient } from '@/lib/database'
 *
 * export default async function Page() {
 *   const db = await createClient()
 *   const { data } = await db.from('albums').select('*')
 *   return <div>{JSON.stringify(data)}</div>
 * }
 * ```
 */
export async function createClient(): Promise<DatabaseClient> {
  const dbType = getDatabaseType()

  if (dbType === 'postgresql') {
    const { createPostgreSQLClient } = await import('./postgresql-client')
    return createPostgreSQLClient() as unknown as DatabaseClient
  } else {
    // Supabase 模式（向后兼容）
    const { createClient: createSupabaseClient } = await import('../supabase/server')
    return (await createSupabaseClient()) as unknown as DatabaseClient
  }
}

import type { NextRequest, NextResponse } from 'next/server'

/**
 * 从 NextRequest 创建数据库客户端（用于 API Routes）
 *
 * @param request - Next.js 请求对象
 * @param response - Next.js 响应对象（可选）
 * @returns 数据库客户端实例
 *
 * @example
 * ```typescript
 * import { createClientFromRequest } from '@/lib/database'
 * import { NextRequest } from 'next/server'
 *
 * export async function GET(request: NextRequest) {
 *   const db = await createClientFromRequest(request)
 *   const { data } = await db.from('albums').select('*')
 *   return Response.json(data)
 * }
 * ```
 */
export async function createClientFromRequest(
  request: NextRequest,
  response?: NextResponse
): Promise<DatabaseClient> {
  const dbType = getDatabaseType()

  if (dbType === 'postgresql') {
    const { createPostgreSQLClient } = await import('./postgresql-client')
    return createPostgreSQLClient() as unknown as DatabaseClient
  } else {
    // Supabase 模式（向后兼容）
    const { createClientFromRequest: createSupabaseClientFromRequest } = await import('../supabase/server')
    return createSupabaseClientFromRequest(request, response) as unknown as DatabaseClient
  }
}

/**
 * 创建 Admin 客户端（绕过权限检查）
 *
 * @description
 * 返回具有管理员权限的数据库客户端，可以绕过 RLS 策略
 *
 * @returns 数据库客户端实例
 *
 * @example
 * ```typescript
 * import { createAdminClient } from '@/lib/database'
 *
 * // 在 API Route 中
 * const db = await createAdminClient()
 * const { data } = await db.from('users').select('*')
 * ```
 */
export async function createAdminClient(): Promise<DatabaseClient> {
  const dbType = getDatabaseType()

  if (dbType === 'postgresql') {
    const { createPostgreSQLAdminClient } = await import('./postgresql-client')
    return createPostgreSQLAdminClient() as unknown as DatabaseClient
  } else {
    // Supabase 模式（向后兼容）
    const { createAdminClient: createSupabaseAdminClient } = await import('../supabase/server')
    return (await createSupabaseAdminClient()) as unknown as DatabaseClient
  }
}
