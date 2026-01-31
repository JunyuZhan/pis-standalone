/**
 * PostgreSQL 兼容层
 * 
 * 提供与 Supabase Client 类似的 API 接口，用于 PostgreSQL 自托管模式
 */
import { PostgreSQLAdapter } from './postgresql-adapter.js';
import { createDatabaseAdapter } from './index.js';

/**
 * PostgreSQL 兼容客户端
 * 提供与 Supabase Client 类似的 API 接口
 */
export class PostgreSQLCompatClient {
  private adapter: PostgreSQLAdapter;

  constructor(adapter: PostgreSQLAdapter) {
    this.adapter = adapter;
  }

  /**
   * 查询构建器（模拟 Supabase 的 from 方法）
   */
  from<T = any>(table: string): PostgresQueryBuilder<T> {
    return new PostgresQueryBuilder<T>(this.adapter, table);
  }

  /**
   * 调用数据库函数 (RPC)
   * PostgreSQL 使用 CALL 或 SELECT function_name()
   */
  async rpc(functionName: string, params?: Record<string, any>): Promise<{ data: any; error: Error | null }> {
    try {
      // 构建参数化查询
      const paramNames = params ? Object.keys(params) : [];
      const paramValues = params ? Object.values(params) : [];
      const paramPlaceholders = paramValues.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = paramNames.length > 0
        ? `SELECT ${functionName}(${paramPlaceholders})`
        : `SELECT ${functionName}()`;
      
      // 使用 adapter 执行查询（需要访问 adapter 的内部方法）
      const result = await (this.adapter as any).pool.query(query, paramValues);
      
      return {
        data: result.rows.length > 0 ? result.rows[0][functionName] : null,
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err,
      };
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.adapter.close();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.adapter.findOne('albums', { id: '00000000-0000-0000-0000-000000000000' });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}

/**
 * PostgreSQL 查询构建器（模拟 Supabase 查询构建器）
 */
class PostgresQueryBuilder<T = any> {
  private adapter: PostgreSQLAdapter;
  private table: string;
  private filters: Record<string, any> = {};
  private orderBy: { column: string; direction: 'asc' | 'desc' }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectColumns?: string[];

  constructor(adapter: PostgreSQLAdapter, table: string) {
    this.adapter = adapter;
    this.table = table;
  }

  eq(column: string, value: any): this {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: any): this {
    // PostgreSQL 不支持 neq，使用 NOT (column = value)
    this.filters[`!${column}`] = value;
    return this;
  }

  gt(column: string, value: any): this {
    this.filters[`${column}>`] = value;
    return this;
  }

  gte(column: string, value: any): this {
    this.filters[`${column}>=`] = value;
    return this;
  }

  lt(column: string, value: any): this {
    this.filters[`${column}<`] = value;
    return this;
  }

  lte(column: string, value: any): this {
    this.filters[`${column}<=`] = value;
    return this;
  }

  like(column: string, pattern: string): this {
    this.filters[`${column}~`] = pattern;
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters[`${column}~~`] = pattern;
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters[`${column}[]`] = values;
    return this;
  }

  is(column: string, value: any): this {
    this.filters[`${column}?`] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy.push({
      column,
      direction: options?.ascending === false ? 'desc' : 'asc',
    });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  select(columns: string, options?: { count?: 'exact' | 'estimated'; head?: boolean }): this {
    if (options?.count && options?.head) {
      // 这是 count 查询，标记为 count 操作
      (this as any).isCount = true;
      (this as any).countType = options.count;
    } else {
      this.selectColumns = columns.split(',').map((c) => c.trim());
    }
    return this;
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    // 检查是否是更新操作
    if ((this as any).updateData) {
      const result = await this.executeUpdate();
      return {
        data: result.data && result.data.length > 0 ? result.data[0] : null,
        error: result.error,
      };
    }
    
    // 检查是否是删除操作
    if ((this as any).isDelete) {
      const result = await this.executeDelete();
      return {
        data: null,
        error: result.error,
      };
    }
    
    // 检查是否是插入操作
    if ((this as any).insertData) {
      const result = await this.executeInsert();
      return {
        data: result.data && result.data.length > 0 ? result.data[0] : null,
        error: result.error,
      };
    }
    
    // 默认查询操作
    this.limitValue = 1;
    const result = await this.adapter.findMany<T>(
      this.table,
      this.filters,
      {
        select: this.selectColumns,
        limit: this.limitValue,
        offset: this.offsetValue,
        orderBy: this.orderBy.length > 0 ? this.orderBy : undefined,
      }
    );
    
    return {
      data: result.data && result.data.length > 0 ? result.data[0] : null,
      error: result.error,
    };
  }

  /**
   * 更新记录
   */
  update(data: Partial<T>): this {
    (this as any).updateData = data;
    return this;
  }

  /**
   * 删除记录
   */
  delete(): this {
    (this as any).isDelete = true;
    return this;
  }

  /**
   * 插入记录
   */
  insert(data: T | T[]): this {
    (this as any).insertData = data;
    return this;
  }

  /**
   * 执行更新操作
   */
  async executeUpdate(): Promise<{ data: T[] | null; error: Error | null }> {
    const updateData = (this as any).updateData;
    if (!updateData) {
      return { data: null, error: new Error('No data provided for update') };
    }
    
    const result = await this.adapter.update<T>(
      this.table,
      this.filters,
      updateData
    );
    
    // 如果有 select 列，需要重新查询
    if (this.selectColumns && result.data) {
      const selectResult = await this.adapter.findMany<T>(
        this.table,
        this.filters,
        {
          select: this.selectColumns,
          limit: this.limitValue,
          offset: this.offsetValue,
          orderBy: this.orderBy.length > 0 ? this.orderBy : undefined,
        }
      );
      return selectResult;
    }
    
    return result;
  }

  /**
   * 执行删除操作
   */
  async executeDelete(): Promise<{ error: Error | null }> {
    return await this.adapter.delete(this.table, this.filters);
  }

  /**
   * 执行插入操作
   */
  async executeInsert(): Promise<{ data: T[] | null; error: Error | null }> {
    const insertData = (this as any).insertData;
    if (!insertData) {
      return { data: null, error: new Error('No data provided for insert') };
    }
    
    return await this.adapter.insert<T>(this.table, insertData);
  }

  /**
   * 支持链式调用的 then 方法（用于查询）
   */
  async then<TResult1 = { data: T[] | null; error: Error | null; count?: number | null } | { count: number | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    // 检查是否是 count 查询
    if ((this as any).isCount) {
      const countResult = await this.count();
      const countResponse = { count: countResult.data, error: countResult.error };
      if (countResult.error && onrejected) {
        return onrejected(countResult.error);
      }
      if (onfulfilled) {
        return onfulfilled(countResponse);
      }
      return countResponse as TResult1;
    }
    
    // 检查是否是更新操作
    if ((this as any).updateData) {
      const result = await this.executeUpdate();
      if (result.error && onrejected) {
        return onrejected(result.error);
      }
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as TResult1;
    }
    
    // 检查是否是删除操作
    if ((this as any).isDelete) {
      const result = await this.executeDelete();
      if (result.error && onrejected) {
        return onrejected(result.error);
      }
      // 删除操作返回 { error: null }，需要转换为标准格式
      const deleteResult = { data: null, error: result.error };
      if (onfulfilled) {
        return onfulfilled(deleteResult);
      }
      return deleteResult as TResult1;
    }
    
    // 检查是否是插入操作
    if ((this as any).insertData) {
      const result = await this.executeInsert();
      if (result.error && onrejected) {
        return onrejected(result.error);
      }
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as TResult1;
    }
    
    // 默认查询操作
    const result = await this.adapter.findMany<T>(
      this.table,
      this.filters,
      {
        select: this.selectColumns,
        limit: this.limitValue,
        offset: this.offsetValue,
        orderBy: this.orderBy.length > 0 ? this.orderBy : undefined,
      }
    );
    
    if (result.error && onrejected) {
      return onrejected(result.error);
    }
    
    if (onfulfilled) {
      return onfulfilled(result);
    }
    
    return result as TResult1;
  }

  /**
   * not 方法（用于过滤条件）
   */
  not(column: string, operator: string, value: any): this {
    // PostgreSQL 的 NOT 操作
    this.filters[`!${column}:${operator}`] = value;
    return this;
  }

  /**
   * count 方法（用于计数）
   */
  async count(): Promise<{ data: number | null; error: Error | null }> {
    try {
      const count = await this.adapter.count(this.table, this.filters);
      return { data: count, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
}

/**
 * 从环境变量创建 PostgreSQL 兼容客户端
 */
export function createPostgreSQLCompatClient(): PostgreSQLCompatClient {
  const adapter = createDatabaseAdapter() as PostgreSQLAdapter;
  return new PostgreSQLCompatClient(adapter);
}
