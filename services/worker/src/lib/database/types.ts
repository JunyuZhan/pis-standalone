/**
 * @fileoverview 数据库适配器类型定义
 *
 * 定义数据库适配器的统一接口，支持两种数据库后端：
 * - Supabase（云端）
 * - PostgreSQL（自托管）
 *
 * @module lib/database/types
 *
 * @example
 * ```typescript
 * import { createDatabaseAdapter, type DatabaseAdapter } from './database'
 *
 * const db: DatabaseAdapter = createDatabaseAdapter({
 *   type: 'postgresql',
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'pis',
 *   user: 'pis',
 *   password: 'password'
 * })
 *
 * const result = await db.findMany('albums', { deleted_at: null })
 * ```
 */

/**
 * 数据库配置接口
 *
 * @interface
 * @description
 * 根据 type 字段选择使用 Supabase 或 PostgreSQL 配置。
 *
 * @property {'supabase' | 'postgresql'} type - 数据库类型
 * @property {string} [supabaseUrl] - Supabase 项目 URL
 * @property {string} [supabaseKey] - Supabase 服务密钥
 * @property {string} [host] - PostgreSQL 主机地址
 * @property {number} [port] - PostgreSQL 端口
 * @property {string} [database] - 数据库名称
 * @property {string} [user] - 数据库用户
 * @property {string} [password] - 数据库密码
 * @property {boolean} [ssl] - 是否使用 SSL
 *
 * @example
 * ```typescript
 * // PostgreSQL 配置
 * const pgConfig: DatabaseConfig = {
 *   type: 'postgresql',
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'pis',
 *   user: 'pis',
 *   password: 'secret',
 *   ssl: false
 * }
 *
 * // Supabase 配置
 * const sbConfig: DatabaseConfig = {
 *   type: 'supabase',
 *   supabaseUrl: 'https://xxx.supabase.co',
 *   supabaseKey: 'service-role-key'
 * }
 * ```
 */
export interface DatabaseConfig {
  /** 数据库类型 */
  type: 'supabase' | 'postgresql'
  /** Supabase 配置（当 type='supabase' 时使用） */
  supabaseUrl?: string
  supabaseKey?: string
  /** PostgreSQL 配置（当 type='postgresql' 时使用） */
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
}

/**
 * 数据库查询结果接口
 *
 * @interface
 * @template T - 结果数据类型
 * @property {T[] | null} data - 查询返回的数据，失败时为 null
 * @property {Error | null} error - 错误对象，成功时为 null
 * @property {number} [count] - 匹配的记录总数
 */
export interface QueryResult<T = unknown> {
  data: T[] | null
  error: Error | null
  count?: number
}

/**
 * 数据库适配器接口
 *
 * @interface
 * @description
 * 定义所有数据库后端必须实现的统一方法。
 * 实现此接口以支持新的数据库服务。
 */
export interface DatabaseAdapter {
  /**
   * 查询单条记录
   *
   * @template T - 返回数据类型
   * @param {string} table - 表名
   * @param {Record<string, *>} filters - 过滤条件
   * @returns {Promise<{ data: T | null; error: Error | null }>} 查询结果
   *
   * @example
   * ```typescript
   * const { data, error } = await db.findOne('albums', { id: 'abc-123' })
   * if (data) {
   *   console.log('相册名称:', data.name)
   * }
   * ```
   */
  findOne<T = unknown>(
    table: string,
    filters: Record<string, unknown>
  ): Promise<{ data: T | null; error: Error | null }>

  /**
   * 查询多条记录
   *
   * @template T - 返回数据类型
   * @param {string} table - 表名
   * @param {Record<string, *>} [filters] - 过滤条件
   * @param {Object} [options] - 查询选项
   * @param {string[]} [options.select] - 选择指定列
   * @param {number} [options.limit] - 限制返回数量
   * @param {number} [options.offset] - 偏移量
   * @param {Array<{ column: string; direction: 'asc' | 'desc' }>} [options.orderBy] - 排序规则
   * @returns {Promise<QueryResult<T>>} 查询结果
   *
   * @example
   * ```typescript
   * const { data, count } = await db.findMany('photos',
   *   { album_id: 'abc-123' },
   *   { limit: 20, offset: 0, orderBy: [{ column: 'created_at', direction: 'desc' }] }
   * )
   * ```
   */
  findMany<T = unknown>(
    table: string,
    filters?: Record<string, unknown>,
    options?: {
      select?: string[]
      limit?: number
      offset?: number
      orderBy?: { column: string; direction: 'asc' | 'desc' }[]
    }
  ): Promise<QueryResult<T>>

  /**
   * 插入记录
   *
   * @template T - 插入数据类型
   * @param {string} table - 表名
   * @param {T | T[]} data - 单条或多条记录数据
   * @returns {Promise<{ data: T[] | null; error: Error | null }>} 插入结果
   *
   * @example
   * ```typescript
   * // 插入单条记录
   * const { data } = await db.insert('albums', {
   *   name: '我的相册',
   *   slug: 'my-album'
   * })
   *
   * // 批量插入
   * const { data } = await db.insert('photos', [
   *   { title: '照片1', url: '...' },
   *   { title: '照片2', url: '...' }
   * ])
   * ```
   */
  insert<T = unknown>(
    table: string,
    data: T | T[]
  ): Promise<{ data: T[] | null; error: Error | null }>

  /**
   * 更新记录
   *
   * @template T - 更新数据类型
   * @param {string} table - 表名
   * @param {Record<string, *>} filters - 过滤条件
   * @param {Partial<T>} data - 要更新的字段
   * @returns {Promise<{ data: T[] | null; error: Error | null }>} 更新结果
   *
   * @example
   * ```typescript
   * const { data } = await db.update('albums',
   *   { id: 'abc-123' },
   *   { name: '新名称', updated_at: new Date() }
   * )
   * ```
   */
  update<T = unknown>(
    table: string,
    filters: Record<string, unknown>,
    data: Partial<T>
  ): Promise<{ data: T[] | null; error: Error | null }>

  /**
   * 删除记录
   *
   * @param {string} table - 表名
   * @param {Record<string, *>} filters - 过滤条件
   * @returns {Promise<{ error: Error | null }>} 删除结果
   *
   * @example
   * ```typescript
   * await db.delete('albums', { id: 'abc-123' })
   * ```
   */
  delete(
    table: string,
    filters: Record<string, unknown>
  ): Promise<{ error: Error | null }>

  /**
   * 计数
   *
   * @param {string} table - 表名
   * @param {Record<string, *>} [filters] - 过滤条件
   * @returns {Promise<number>} 匹配的记录数
   *
   * @example
   * ```typescript
   * const count = await db.count('photos', { album_id: 'abc-123' })
   * console.log('照片数量:', count)
   * ```
   */
  count(
    table: string,
    filters?: Record<string, unknown>
  ): Promise<number>
}
