/**
 * 数据库客户端类型定义
 * 
 * 用于替换 `any` 类型，提供更好的类型安全
 */

/**
 * 数据库查询值类型
 * 支持 PostgreSQL 支持的所有基本类型
 */
export type DatabaseValue =
  | string
  | number
  | boolean
  | null
  | Date
  | string[] // 用于 IN 查询
  | undefined

/**
 * 数据库查询过滤器
 * 键为列名，值为查询值
 */
export type DatabaseFilters = Record<string, DatabaseValue>

/**
 * 数据库查询参数值数组
 */
export type QueryParameterValue = string | number | boolean | null | Date | string[]

/**
 * RPC 函数参数
 */
export type RpcParams = Record<string, DatabaseValue>

/**
 * 查询构建器接口（兼容 Supabase 和 PostgreSQL）
 */
export interface QueryBuilder<T = unknown> {
  select(columns: string, options?: { count?: 'exact' | 'estimated'; head?: boolean }): this
  eq(column: string, value: QueryParameterValue): this
  neq(column: string, value: QueryParameterValue): this
  gt(column: string, value: QueryParameterValue): this
  gte(column: string, value: QueryParameterValue): this
  lt(column: string, value: QueryParameterValue): this
  lte(column: string, value: QueryParameterValue): this
  like(column: string, pattern: string): this
  ilike(column: string, pattern: string): this
  in(column: string, values: string[] | number[]): this
  is(column: string, value: QueryParameterValue): this
  not(column: string, operator: string, value: QueryParameterValue): this
  order(column: string, options?: { ascending?: boolean }): this
  limit(count: number): this
  offset(count: number): this
  range(from: number, to: number): this
  single(): Promise<{ data: T | null; error: Error | null }>
  maybeSingle(): Promise<{ data: T | null; error: Error | null }>
  delete(): this
  execute<TResult = T>(): Promise<{ data: TResult[] | null; error: Error | null; count?: number }>
  // Promise-like 接口（兼容 Supabase）
  then<TResult1 = { data: T[] | null; error: Error | null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[] | null; error: Error | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>
}

/**
 * 数据库客户端接口（兼容 Supabase 和 PostgreSQL）
 * 
 * 注意：由于 Supabase 和 PostgreSQL 客户端的 API 不完全一致，
 * 这里使用 `unknown` 作为基础类型，实际使用时需要根据具体实现进行类型断言。
 * 
 * 主要方法：
 * - `from<T>(table: string): QueryBuilder<T>` - 查询构建器
 * - `insert<T>(table: string, data: T | T[]): Promise<{ data: T[] | null; error: Error | null }>` - 插入数据
 * - `update<T>(table: string, data: Partial<T>, filters: DatabaseFilters): Promise<{ data: T[] | null; error: Error | null }>` - 更新数据
 * - `delete(table: string, filters: DatabaseFilters): Promise<{ data: unknown[] | null; error: Error | null }>` - 删除数据
 * - `rpc(functionName: string, params?: RpcParams): Promise<{ data: unknown; error: Error | null }>` - 调用 RPC
 */
export interface DatabaseClientInterface {
  from<T = unknown>(table: string): QueryBuilder<T>
  insert<T = unknown>(table: string, data: T | T[]): Promise<{ data: T[] | null; error: Error | null }>
  upsert<T = unknown>(table: string, data: T | T[], onConflict?: string): Promise<{ data: T[] | null; error: Error | null }>
  updateBatch<T = unknown>(table: string, data: T[], keyColumn?: string): Promise<{ data: T[] | null; error: Error | null }>
  update<T = unknown>(table: string, data: Partial<T>, filters: DatabaseFilters): Promise<{ data: T[] | null; error: Error | null }>
  delete(table: string, filters: DatabaseFilters): Promise<{ data: unknown[] | null; error: Error | null }>
  rpc(functionName: string, params?: RpcParams): Promise<{ data: unknown; error: Error | null }>
  close?(): Promise<void>
}
