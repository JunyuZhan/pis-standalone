/**
 * PostgreSQL 客户端
 * 
 * 提供与 Supabase Client 类似的 API 接口，用于 PostgreSQL 自托管模式
 * 适配 Next.js Server Components 和 API Routes
 */
import { Pool } from 'pg'
import type { DatabaseFilters, QueryParameterValue, RpcParams } from './types'

// 全局连接池（单例模式）
let pool: Pool | null = null

/**
 * 获取 PostgreSQL 连接池
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    
    if (!connectionString) {
      // 从环境变量构建连接字符串
      const host = process.env.DATABASE_HOST || process.env.POSTGRES_HOST || 'localhost'
      const port = parseInt(process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432', 10)
      const database = process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'pis'
      const user = process.env.DATABASE_USER || process.env.POSTGRES_USER || 'pis'
      const password = process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || ''
      const ssl = process.env.DATABASE_SSL === 'true'
      
      pool = new Pool({
        host,
        port,
        database,
        user,
        password,
        ssl: ssl ? { rejectUnauthorized: false } : false,
        max: 20, // 连接池最大连接数
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      })
      
      // 监听连接错误
      pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err)
      })
    } else {
      pool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      })
      
      pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err)
      })
    }
  }
  
  return pool
}

/**
 * PostgreSQL 查询构建器（模拟 Supabase 查询构建器）
 */
class PostgresQueryBuilder<T = unknown> {
  private pool: Pool
  private table: string
  private filters: DatabaseFilters = {}
  private orderBy: { column: string; direction: 'asc' | 'desc' }[] = []
  private limitValue?: number
  private offsetValue?: number
  private selectColumns?: string[]

  constructor(pool: Pool, table: string) {
    this.pool = pool
    this.table = table
  }

  /**
   * 转义标识符（表名、列名）
   */
  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }

  /**
   * 构建 WHERE 子句
   */
  private buildWhereClause(): { clause: string; values: QueryParameterValue[] } {
    const conditions: string[] = []
    const values: QueryParameterValue[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(this.filters)) {
      const escapedKey = this.escapeIdentifier(key.replace(/[!><=~?\[\]]+$/, ''))
      
      if (key.endsWith('>')) {
        conditions.push(`${escapedKey} > $${paramIndex++}`)
        values.push(value)
      } else if (key.endsWith('>=')) {
        conditions.push(`${escapedKey} >= $${paramIndex++}`)
        values.push(value)
      } else if (key.endsWith('<')) {
        conditions.push(`${escapedKey} < $${paramIndex++}`)
        values.push(value)
      } else if (key.endsWith('<=')) {
        conditions.push(`${escapedKey} <= $${paramIndex++}`)
        values.push(value)
      } else if (key.endsWith('~')) {
        conditions.push(`${escapedKey} LIKE $${paramIndex++}`)
        values.push(value)
      } else if (key.endsWith('~~')) {
        conditions.push(`${escapedKey} ILIKE $${paramIndex++}`)
        values.push(value)
      } else if (key.endsWith('[]')) {
        conditions.push(`${escapedKey} = ANY($${paramIndex++})`)
        values.push(value)
      } else if (key.endsWith('?')) {
        conditions.push(`${escapedKey} IS $${paramIndex++}`)
        values.push(value)
      } else if (key.startsWith('!')) {
        conditions.push(`${escapedKey} != $${paramIndex++}`)
        values.push(value)
      } else {
        conditions.push(`${escapedKey} = $${paramIndex++}`)
        values.push(value)
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    }
  }

  /**
   * 构建 ORDER BY 子句
   */
  private buildOrderByClause(): string {
    if (this.orderBy.length === 0) return ''
    
    const clauses = this.orderBy.map(({ column, direction }) => {
      const escapedColumn = this.escapeIdentifier(column)
      return `${escapedColumn} ${direction.toUpperCase()}`
    })
    
    return `ORDER BY ${clauses.join(', ')}`
  }

  eq(column: string, value: QueryParameterValue): this {
    this.filters[column] = value
    return this
  }

  neq(column: string, value: QueryParameterValue): this {
    this.filters[`!${column}`] = value
    return this
  }

  gt(column: string, value: QueryParameterValue): this {
    this.filters[`${column}>`] = value
    return this
  }

  gte(column: string, value: QueryParameterValue): this {
    this.filters[`${column}>=`] = value
    return this
  }

  lt(column: string, value: QueryParameterValue): this {
    this.filters[`${column}<`] = value
    return this
  }

  lte(column: string, value: QueryParameterValue): this {
    this.filters[`${column}<=`] = value
    return this
  }

  like(column: string, pattern: string): this {
    this.filters[`${column}~`] = pattern
    return this
  }

  ilike(column: string, pattern: string): this {
    this.filters[`${column}~~`] = pattern
    return this
  }

  in(column: string, values: string[] | number[]): this {
    this.filters[`${column}[]`] = values
    return this
  }

  is(column: string, value: QueryParameterValue): this {
    this.filters[`${column}?`] = value
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy.push({
      column,
      direction: options?.ascending === false ? 'desc' : 'asc',
    })
    return this
  }

  limit(count: number): this {
    this.limitValue = count
    return this
  }

  range(from: number, to: number): this {
    this.offsetValue = from
    this.limitValue = to - from + 1
    return this
  }

  select(columns: string, options?: { count?: 'exact' | 'estimated'; head?: boolean }): this {
    this.selectColumns = columns.split(',').map((c) => c.trim())
    // 注意：PostgreSQL 客户端暂不支持 count 选项，需要单独查询
    // options.count 和 options.head 会被忽略（保留参数以兼容 Supabase API）
    void options // 标记为已使用，避免 ESLint 警告
    return this
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    this.limitValue = 1
    const result = await this.execute<T>()
    return {
      data: result.data && result.data.length > 0 ? result.data[0] : null,
      error: result.error,
    }
  }

  async execute<TResult = T>(): Promise<{ data: TResult[] | null; error: Error | null; count?: number }> {
    try {
      const escapedTable = this.escapeIdentifier(this.table)
      const selectFields = this.selectColumns
        ? this.selectColumns.map((field) => this.escapeIdentifier(field)).join(', ')
        : '*'
      
      const { clause, values } = this.buildWhereClause()
      const orderByClause = this.buildOrderByClause()
      
      let query = `SELECT ${selectFields} FROM ${escapedTable} ${clause} ${orderByClause}`
      const queryValues = [...values]

      if (this.limitValue) {
        query += ` LIMIT $${queryValues.length + 1}`
        queryValues.push(this.limitValue)
      }

      if (this.offsetValue) {
        query += ` OFFSET $${queryValues.length + 1}`
        queryValues.push(this.offsetValue)
      }

      const result = await this.pool.query(query, queryValues)

      // 如果需要 count，执行单独的计数查询
      let count: number | undefined
      if (clause) {
        const countQuery = `SELECT COUNT(*) as count FROM ${escapedTable} ${clause}`
        const countResult = await this.pool.query(countQuery, values)
        count = parseInt(countResult.rows[0].count, 10)
      } else {
        count = result.rows.length
      }

      return {
        data: result.rows as TResult[],
        error: null,
        count,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  // 支持 Promise-like 接口（兼容 Supabase）
  async then<TResult1 = { data: T[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute<T>()
    
    if (result.error && onrejected) {
      return onrejected(result.error)
    }
    
    if (onfulfilled) {
      return onfulfilled(result)
    }
    
    return result as TResult1
  }
}

/**
 * PostgreSQL 客户端（模拟 Supabase Client API）
 */
export class PostgreSQLClient {
  private pool: Pool
  private isAdmin: boolean

  constructor(pool: Pool, isAdmin = false) {
    this.pool = pool
    this.isAdmin = isAdmin
  }

  /**
   * 查询构建器（模拟 Supabase 的 from 方法）
   */
  from<T = unknown>(table: string): PostgresQueryBuilder<T> {
    return new PostgresQueryBuilder<T>(this.pool, table)
  }

  /**
   * 调用数据库函数 (RPC)
   */
  async rpc(functionName: string, params?: RpcParams): Promise<{ data: unknown; error: Error | null }> {
    try {
      const paramValues = params ? Object.values(params) : []
      const paramPlaceholders = paramValues.map((_, i) => `$${i + 1}`).join(', ')
      
      const query = paramValues.length > 0
        ? `SELECT ${functionName}(${paramPlaceholders})`
        : `SELECT ${functionName}()`
      
      const result = await this.pool.query(query, paramValues)
      
      return {
        data: result.rows.length > 0 ? result.rows[0][functionName] : null,
        error: null,
      }
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }

  /**
   * 插入数据
   */
  async insert<T = unknown>(table: string, data: T | T[]): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const escapedTable = `"${table.replace(/"/g, '""')}"`
      const rows = Array.isArray(data) ? data : [data]
      
      if (rows.length === 0) {
        return { data: [], error: null }
      }

      const columns = Object.keys(rows[0] as Record<string, unknown>)
      const escapedColumns = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(', ')
      
      const values: QueryParameterValue[] = []
      const placeholders: string[] = []
      
      rows.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = []
        const rowRecord = row as Record<string, unknown>
        columns.forEach((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1
          rowPlaceholders.push(`$${paramIndex}`)
          values.push(rowRecord[col] as QueryParameterValue)
        })
        placeholders.push(`(${rowPlaceholders.join(', ')})`)
      })

      const query = `INSERT INTO ${escapedTable} (${escapedColumns}) VALUES ${placeholders.join(', ')} RETURNING *`
      const result = await this.pool.query(query, values)

      return {
        data: result.rows as T[],
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * 更新数据
   */
  async update<T = unknown>(table: string, data: Partial<T>, filters: DatabaseFilters): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const escapedTable = `"${table.replace(/"/g, '""')}"`
      const setClauses: string[] = []
      const values: QueryParameterValue[] = []
      let paramIndex = 1

      for (const [key, value] of Object.entries(data)) {
        const escapedKey = `"${key.replace(/"/g, '""')}"`
        setClauses.push(`${escapedKey} = $${paramIndex++}`)
        values.push(value as QueryParameterValue)
      }

      const whereClauses: string[] = []
      for (const [key, value] of Object.entries(filters)) {
        const escapedKey = `"${key.replace(/"/g, '""')}"`
        whereClauses.push(`${escapedKey} = $${paramIndex++}`)
        values.push(value as QueryParameterValue)
      }

      const query = `UPDATE ${escapedTable} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *`
      const result = await this.pool.query(query, values)

      return {
        data: result.rows as T[],
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * 删除数据
   */
  async delete(table: string, filters: DatabaseFilters): Promise<{ data: unknown[] | null; error: Error | null }> {
    try {
      const escapedTable = `"${table.replace(/"/g, '""')}"`
      const whereClauses: string[] = []
      const values: QueryParameterValue[] = []
      let paramIndex = 1

      for (const [key, value] of Object.entries(filters)) {
        const escapedKey = `"${key.replace(/"/g, '""')}"`
        whereClauses.push(`${escapedKey} = $${paramIndex++}`)
        values.push(value as QueryParameterValue)
      }

      const query = `DELETE FROM ${escapedTable} WHERE ${whereClauses.join(' AND ')} RETURNING *`
      const result = await this.pool.query(query, values)

      return {
        data: result.rows,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}

/**
 * 创建 PostgreSQL 客户端（用于 Server Components）
 */
export function createPostgreSQLClient(): PostgreSQLClient {
  const pool = getPool()
  return new PostgreSQLClient(pool, false)
}

/**
 * 创建 PostgreSQL Admin 客户端（绕过权限检查）
 */
export function createPostgreSQLAdminClient(): PostgreSQLClient {
  const pool = getPool()
  return new PostgreSQLClient(pool, true)
}
