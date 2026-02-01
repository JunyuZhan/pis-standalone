/**
 * @fileoverview 数据库适配器工厂
 *
 * 根据配置自动选择并创建数据库适配器实例。
 * PIS Standalone 支持两种数据库后端：
 * - Supabase (云端)
 * - PostgreSQL (自托管)
 *
 * @module lib/database/index
 *
 * @example
 * ```typescript
 * import {
 *   getDatabaseAdapter,
 *   createDatabaseAdapter,
 *   getSupabaseClient
 * } from '@/lib/database'
 *
 * // 使用环境变量配置
 * const db = getDatabaseAdapter()
 *
 * // 使用自定义配置
 * const db = createDatabaseAdapter({
 *   type: 'postgresql',
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'pis',
 *   user: 'pis',
 *   password: 'password'
 * })
 * ```
 */

import type { DatabaseAdapter, DatabaseConfig } from './types.js'
import { SupabaseAdapter } from './supabase-adapter.js'
import { PostgreSQLAdapter } from './postgresql-adapter.js'

let databaseAdapter: DatabaseAdapter | null = null

/**
 * 从环境变量创建数据库配置
 *
 * @description
 * 根据 DATABASE_TYPE 环境变量读取相应配置：
 *
 * PostgreSQL 模式读取：
 * - DATABASE_HOST / POSTGRES_HOST
 * - DATABASE_PORT / POSTGRES_PORT
 * - DATABASE_NAME / POSTGRES_DB
 * - DATABASE_USER / POSTGRES_USER
 * - DATABASE_PASSWORD / POSTGRES_PASSWORD
 * - DATABASE_SSL
 *
 * Supabase 模式读取：
 * - SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / DATABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY / DATABASE_KEY
 *
 * @returns {DatabaseConfig} 数据库配置对象
 */
function getDatabaseConfigFromEnv(): DatabaseConfig {
  const dbType = (
    process.env.DATABASE_TYPE || 'postgresql'
  ).toLowerCase()

  if (dbType === 'postgresql') {
    return {
      type: 'postgresql',
      host:
        process.env.DATABASE_HOST ||
        process.env.POSTGRES_HOST ||
        'localhost',
      port: parseInt(
        process.env.DATABASE_PORT ||
          process.env.POSTGRES_PORT ||
          '5432',
        10
      ),
      database:
        process.env.DATABASE_NAME ||
        process.env.POSTGRES_DB ||
        'pis',
      user:
        process.env.DATABASE_USER ||
        process.env.POSTGRES_USER ||
        'pis',
      password:
        process.env.DATABASE_PASSWORD ||
        process.env.POSTGRES_PASSWORD ||
        '',
      ssl: process.env.DATABASE_SSL === 'true',
    }
  }

  // Supabase 模式
  return {
    type: 'supabase',
    // 支持两种变量名 (兼容 monorepo 统一配置)
    supabaseUrl:
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.DATABASE_URL,
    supabaseKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.DATABASE_KEY,
  }
}

/**
 * 创建数据库适配器实例
 *
 * @param {DatabaseConfig} [config] - 可选的数据库配置，默认从环境变量读取
 * @returns {DatabaseAdapter} 数据库适配器实例
 * @throws {Error} 如果数据库类型不支持则抛出错误
 *
 * @example
 * ```typescript
 * // PostgreSQL
 * const db = createDatabaseAdapter({
 *   type: 'postgresql',
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'pis',
 *   user: 'pis',
 *   password: 'secret'
 * })
 *
 * // Supabase
 * const db = createDatabaseAdapter({
 *   type: 'supabase',
 *   supabaseUrl: 'https://xxx.supabase.co',
 *   supabaseKey: 'service-role-key'
 * })
 * ```
 */
export function createDatabaseAdapter(
  config?: DatabaseConfig
): DatabaseAdapter {
  const finalConfig = config || getDatabaseConfigFromEnv()

  if (finalConfig.type === 'supabase') {
    return new SupabaseAdapter(finalConfig)
  } else if (finalConfig.type === 'postgresql') {
    return new PostgreSQLAdapter(finalConfig)
  }

  throw new Error(
    `Unsupported database type: ${finalConfig.type}. Supported types: 'supabase', 'postgresql'`
  )
}

/**
 * 获取单例数据库适配器
 *
 * @description
 * 返回全局唯一的数据库适配器实例，首次调用时创建。
 *
 * @returns {DatabaseAdapter} 数据库适配器实例
 *
 * @example
 * ```typescript
 * const db = getDatabaseAdapter()
 * const result = await db.from('albums').select('*')
 * ```
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (!databaseAdapter) {
    databaseAdapter = createDatabaseAdapter()
  }
  return databaseAdapter
}

// ============================================
// 导出类型和适配器类
// ============================================

/**
 * 导出类型和适配器类（供高级用法）
 */
export * from './types.js'
export { SupabaseAdapter } from './supabase-adapter.js'
export { PostgreSQLAdapter } from './postgresql-adapter.js'

// ============================================
// Supabase 专用函数
// ============================================

/**
 * 获取 Supabase 客户端
 *
 * @description
 * 仅在使用 Supabase 适配器时可用。
 * 直接返回底层的 Supabase 客户端实例。
 *
 * @returns {*} Supabase 客户端实例
 * @throws {Error} 如果不是 Supabase 适配器则抛出错误
 *
 * @example
 * ```typescript
 * try {
 *   const supabase = getSupabaseClient()
 *   const { data } = await supabase.from('albums').select('*')
 * } catch (error) {
 *   console.error('Not using Supabase adapter')
 * }
 * ```
 */
export function getSupabaseClient() {
  const adapter = getDatabaseAdapter()
  if (adapter instanceof SupabaseAdapter) {
    return adapter.getClient()
  }
  throw new Error(
    'Supabase client is only available when using Supabase adapter'
  )
}
