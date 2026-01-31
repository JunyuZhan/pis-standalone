/**
 * 数据库适配器工厂
 * 
 * 根据 DATABASE_TYPE 环境变量选择使用 Supabase 或 PostgreSQL
 * 提供统一的 API 接口，方便切换数据库后端
 */
import type { DatabaseClientInterface } from './types'

// 类型定义：兼容 Supabase Client 和 PostgreSQL Client
// 注意：由于两种客户端的 API 不完全一致，使用 `unknown` 作为基础类型
// 实际使用时，客户端会实现 DatabaseClientInterface 接口的方法
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DatabaseClient = DatabaseClientInterface & Record<string, any>

/**
 * 获取数据库类型
 */
function getDatabaseType(): 'supabase' | 'postgresql' {
  const dbType = (process.env.DATABASE_TYPE || 'postgresql').toLowerCase()
  return dbType === 'supabase' ? 'supabase' : 'postgresql'
}

/**
 * 创建数据库客户端（用于 Server Components）
 * 
 * 根据 DATABASE_TYPE 环境变量返回 Supabase 或 PostgreSQL 客户端
 */
export async function createClient(): Promise<DatabaseClient> {
  const dbType = getDatabaseType()
  
  if (dbType === 'postgresql') {
    const { createPostgreSQLClient } = await import('./postgresql-client')
    return createPostgreSQLClient()
  } else {
    // Supabase 模式（向后兼容）
    const { createClient: createSupabaseClient } = await import('../supabase/server')
    return createSupabaseClient()
  }
}

import type { NextRequest, NextResponse } from 'next/server'

/**
 * 从 NextRequest 创建数据库客户端（用于 API Routes）
 */
export async function createClientFromRequest(
  request: NextRequest,
  response?: NextResponse
): Promise<DatabaseClient> {
  const dbType = getDatabaseType()
  
  if (dbType === 'postgresql') {
    const { createPostgreSQLClient } = await import('./postgresql-client')
    return createPostgreSQLClient()
  } else {
    // Supabase 模式（向后兼容）
    const { createClientFromRequest: createSupabaseClientFromRequest } = await import('../supabase/server')
    return createSupabaseClientFromRequest(request, response)
  }
}

/**
 * 创建 Admin 客户端（绕过权限检查）
 */
export async function createAdminClient(): Promise<DatabaseClient> {
  const dbType = getDatabaseType()
  
  if (dbType === 'postgresql') {
    const { createPostgreSQLAdminClient } = await import('./postgresql-client')
    return createPostgreSQLAdminClient()
  } else {
    // Supabase 模式（向后兼容）
    const { createAdminClient: createSupabaseAdminClient } = await import('../supabase/server')
    return createSupabaseAdminClient()
  }
}
