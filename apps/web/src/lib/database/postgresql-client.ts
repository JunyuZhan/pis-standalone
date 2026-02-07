/**
 * PIS Web - PostgreSQL 客户端
 *
 * 提供与 Supabase Client 类似的 API 接口，用于 PostgreSQL 自托管模式
 * 适配 Next.js Server Components 和 API Routes
 *
 * @author junyuzhan
 * @license MIT
 *
 * @description
 * 核心功能：
 * - 连接池管理（单例模式）
 * - 链式查询构建器（模拟 Supabase API）
 * - CRUD 操作（insert, update, delete, select）
 * - RPC 函数调用
 *
 * @example
 * ```typescript
 * import { createPostgreSQLClient } from '@/lib/database/postgresql-client'
 *
 * const db = createPostgreSQLClient()
 *
 * // 查询
 * const { data } = await db.from('albums').select('*').eq('id', '123').single()
 *
 * // 插入
 * const { data: newAlbum } = await db.insert('albums', { title: 'My Album' })
 *
 * // 更新
 * const { data: updated } = await db.update('albums', { title: 'New Title' }, { id: '123' })
 *
 * // 删除
 * const { data: deleted } = await db.delete('albums', { id: '123' })
 * ```
 */
import { Pool } from "pg";
import type {
  DatabaseFilters,
  DatabaseValue,
  QueryParameterValue,
  RpcParams,
} from "./types";
import { config } from "dotenv";
import { resolve } from "path";

// 手动加载环境变量（确保在 monorepo 结构中正确加载项目根目录的 .env.local）
// Next.js 通常会自动加载，但在某些情况下（如 Turbopack 模式）可能不会加载
if (typeof process !== "undefined" && process.env) {
  // 只在环境变量未设置时尝试加载（避免重复加载）
  if (
    !process.env.DATABASE_PASSWORD &&
    !process.env.POSTGRES_PASSWORD &&
    !process.env.DATABASE_URL
  ) {
    try {
      const cwd = process.cwd();
      // 尝试多个可能的路径
      const possiblePaths = [
        resolve(cwd, "../../.env.local"), // 从 apps/web 向上到项目根目录
        resolve(cwd, "../../../.env.local"), // 从 apps/web/.next 向上到项目根目录
        resolve(cwd, ".env.local"), // 当前目录
        resolve(cwd, "../.env.local"), // 上一级目录
      ];

      let loaded = false;
      for (const envPath of possiblePaths) {
        try {
          const result = config({ path: envPath });
          if (!result.error) {
            // 检查是否成功加载了环境变量
            if (
              process.env.DATABASE_PASSWORD ||
              process.env.POSTGRES_PASSWORD ||
              process.env.DATABASE_URL
            ) {
              if (process.env.NODE_ENV === "development") {
                console.log(
                  "[PostgreSQL] Successfully loaded .env.local from:",
                  envPath,
                );
              }
              loaded = true;
              break;
            }
          }
        } catch {
          // 继续尝试下一个路径
          continue;
        }
      }

      if (!loaded && process.env.NODE_ENV === "development") {
        console.warn(
          "[PostgreSQL] Could not find .env.local in any of these paths:",
          possiblePaths,
        );
        console.warn("[PostgreSQL] Current working directory:", cwd);
      }
    } catch (error) {
      // 忽略加载错误（可能文件不存在，Next.js 会处理）
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[PostgreSQL] Failed to load .env.local manually:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }
}

/** 全局连接池（单例模式） */
let pool: Pool | null = null;

/**
 * 重置连接池（用于环境变量更新后重新创建连接）
 */
export function resetPool(): void {
  if (pool) {
    pool.end().catch((err) => {
      console.error("Error closing pool:", err);
    });
    pool = null;
  }
}

function isTruthyEnv(value?: string): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "y", "on"].includes(value.toLowerCase());
}

function shouldEnableSsl(connectionString?: string): boolean {
  const sslEnv = process.env.DATABASE_SSL;
  if (sslEnv !== undefined) {
    return isTruthyEnv(sslEnv);
  }
  if (!connectionString) return false;
  return /(sslmode=require|ssl=true|ssl=1)/i.test(connectionString);
}

/**
 * 获取 PostgreSQL 连接池
 *
 * @description
 * - 首次调用时创建连接池
 * - 支持从 DATABASE_URL 或独立环境变量构建连接字符串
 * - 最大连接数：20
 * - 空闲超时：30秒
 * - 连接超时：2秒
 *
 * @returns PostgreSQL 连接池实例
 *
 * @internal
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const enableSsl = shouldEnableSsl(connectionString);

    if (!connectionString) {
      // 从环境变量构建连接字符串
      const host =
        process.env.DATABASE_HOST || process.env.POSTGRES_HOST || "localhost";
      const port = parseInt(
        process.env.DATABASE_PORT || process.env.POSTGRES_PORT || "5432",
        10,
      );
      const database =
        process.env.DATABASE_NAME || process.env.POSTGRES_DB || "pis";
      const user =
        process.env.DATABASE_USER || process.env.POSTGRES_USER || "pis";
      // 优先使用 DATABASE_PASSWORD，如果未设置则使用 POSTGRES_PASSWORD
      // 确保密码始终是字符串类型（不能是 undefined 或 null）
      const passwordRaw =
        process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD;
      const password = passwordRaw != null ? String(passwordRaw) : "";
      const ssl = enableSsl;

      // 验证必需的连接参数
      if (!host || !database || !user) {
        throw new Error(
          "Missing required database configuration: DATABASE_HOST, DATABASE_NAME, and DATABASE_USER are required",
        );
      }

      // 验证密码是否设置（PostgreSQL SCRAM 认证需要密码）
      if (!password || password.length === 0) {
        const errorMsg =
          "DATABASE_PASSWORD or POSTGRES_PASSWORD environment variable is required but not set. " +
          "Please check your .env.local file or environment configuration. " +
          "Make sure to restart the Next.js dev server after updating .env.local.";
        console.error("[PostgreSQL]", errorMsg);
        console.error("[PostgreSQL] Available env vars:", {
          DATABASE_PASSWORD: process.env.DATABASE_PASSWORD
            ? `SET (length: ${process.env.DATABASE_PASSWORD.length})`
            : "NOT SET",
          POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD
            ? `SET (length: ${process.env.POSTGRES_PASSWORD.length})`
            : "NOT SET",
          DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
          NODE_ENV: process.env.NODE_ENV,
          // 列出所有 DATABASE_ 相关的环境变量（不显示值）
          allDatabaseEnvVars: Object.keys(process.env).filter(
            (key) => key.startsWith("DATABASE_") || key.startsWith("POSTGRES_"),
          ),
        });
        throw new Error(errorMsg);
      }

      // 调试日志（仅在开发环境）
      if (process.env.NODE_ENV === "development") {
        console.log("[PostgreSQL] Connection config:", {
          host,
          port,
          database,
          user,
          passwordSet: !!passwordRaw,
          passwordLength: password.length,
          ssl,
        });
      }

      pool = new Pool({
        host,
        port,
        database,
        user,
        password, // PostgreSQL 要求密码必须是字符串类型
        ssl: ssl ? { rejectUnauthorized: false } : false,
        max: 20, // 连接池最大连接数
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // 监听连接错误
      pool.on("error", (err) => {
        console.error("Unexpected error on idle PostgreSQL client", err);
      });
    } else {
      pool = new Pool({
        connectionString,
        ssl: enableSsl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      pool.on("error", (err) => {
        console.error("Unexpected error on idle PostgreSQL client", err);
      });
    }
  }

  return pool;
}

/**
 * PostgreSQL 查询构建器
 *
 * @description
 * 模拟 Supabase 查询构建器 API，支持链式调用
 *
 * @template T - 返回数据类型
 *
 * @internal
 */
class PostgresQueryBuilder<T = unknown> {
  private pool: Pool;
  private table: string;
  private filters: DatabaseFilters = {};
  private orderBy: { column: string; direction: "asc" | "desc" }[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectColumns?: string[];
  private isDeleteOperation = false;

  constructor(pool: Pool, table: string) {
    this.pool = pool;
    this.table = table;
  }

  /**
   * 转义标识符（表名、列名）
   */
  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * 构建 WHERE 子句
   */
  private buildWhereClause(): {
    clause: string;
    values: QueryParameterValue[];
  } {
    const conditions: string[] = [];
    const values: QueryParameterValue[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(this.filters)) {
      // 移除开头的 ! (用于 neq/not) 和结尾的操作符
      const escapedKey = this.escapeIdentifier(
        key.replace(/^!/, "").replace(/[!><=~?\[\]]+$/, ""),
      );

      if (key.endsWith(">")) {
        conditions.push(`${escapedKey} > $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      } else if (key.endsWith(">=")) {
        conditions.push(`${escapedKey} >= $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      } else if (key.endsWith("<")) {
        conditions.push(`${escapedKey} < $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      } else if (key.endsWith("<=")) {
        conditions.push(`${escapedKey} <= $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      } else if (key.endsWith("~")) {
        conditions.push(`${escapedKey} LIKE $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      } else if (key.endsWith("~~")) {
        conditions.push(`${escapedKey} ILIKE $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      } else if (key.endsWith("[]")) {
        conditions.push(`${escapedKey} = ANY($${paramIndex++})`);
        values.push(value as QueryParameterValue);
      } else if (key.startsWith("!") && key.endsWith("?")) {
        // NOT IS 操作符：null 值使用 IS NOT NULL，非 null 值使用 != 操作符
        const columnName = key.slice(1, -1); // 移除开头的 ! 和结尾的 ?
        const escapedColumn = this.escapeIdentifier(columnName);
        if (value === null) {
          conditions.push(`${escapedColumn} IS NOT NULL`);
          // 不添加参数，因为 IS NOT NULL 不需要参数
        } else {
          conditions.push(`${escapedColumn} != $${paramIndex++}`);
          values.push(value as QueryParameterValue);
        }
      } else if (key.endsWith("?")) {
        // IS 操作符：null 值使用 IS NULL，非 null 值使用 = 操作符
        if (value === null) {
          conditions.push(`${escapedKey} IS NULL`);
          // 不添加参数，因为 IS NULL 不需要参数
        } else {
          conditions.push(`${escapedKey} = $${paramIndex++}`);
          values.push(value as QueryParameterValue);
        }
      } else if (key.startsWith("!")) {
        conditions.push(`${escapedKey} != $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      } else {
        conditions.push(`${escapedKey} = $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
      values,
    };
  }

  /**
   * 构建 ORDER BY 子句
   */
  private buildOrderByClause(): string {
    if (this.orderBy.length === 0) return "";

    const clauses = this.orderBy.map(({ column, direction }) => {
      const escapedColumn = this.escapeIdentifier(column);
      return `${escapedColumn} ${direction.toUpperCase()}`;
    });

    return `ORDER BY ${clauses.join(", ")}`;
  }

  eq(column: string, value: QueryParameterValue): this {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: QueryParameterValue): this {
    this.filters[`!${column}`] = value;
    return this;
  }

  gt(column: string, value: QueryParameterValue): this {
    this.filters[`${column}>`] = value;
    return this;
  }

  gte(column: string, value: QueryParameterValue): this {
    this.filters[`${column}>=`] = value;
    return this;
  }

  lt(column: string, value: QueryParameterValue): this {
    this.filters[`${column}<`] = value;
    return this;
  }

  lte(column: string, value: QueryParameterValue): this {
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

  in(column: string, values: string[] | number[]): this {
    this.filters[`${column}[]`] = values as DatabaseValue;
    return this;
  }

  is(column: string, value: QueryParameterValue): this {
    this.filters[`${column}?`] = value;
    return this;
  }

  not(column: string, operator: string, value: QueryParameterValue): this {
    // 实现 NOT 操作符
    if (operator === "is") {
      this.filters[`!${column}?`] = value;
    } else {
      // 其他操作符暂不支持 NOT
      this.filters[`!${column}`] = value;
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy.push({
      column,
      direction: options?.ascending === false ? "desc" : "asc",
    });
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  select(
    columns: string,
    options?: { count?: "exact" | "estimated"; head?: boolean },
  ): this {
    this.selectColumns = columns.split(",").map((c) => c.trim());
    // 注意：PostgreSQL 客户端暂不支持 count 选项，需要单独查询
    // options.count 和 options.head 会被忽略（保留参数以兼容 Supabase API）
    void options; // 标记为已使用，避免 ESLint 警告
    return this;
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    this.limitValue = 1;
    const result = await this.execute<T>();
    return {
      data: result.data && result.data.length > 0 ? result.data[0] : null,
      error: result.error,
    };
  }

  async maybeSingle(): Promise<{ data: T | null; error: Error | null }> {
    this.limitValue = 1;
    const result = await this.execute<T>();
    // maybeSingle 与 single 相同，但如果有多条记录会返回错误
    if (result.data && result.data.length > 1) {
      return {
        data: null,
        error: new Error("Multiple rows returned"),
      };
    }
    return {
      data: result.data && result.data.length > 0 ? result.data[0] : null,
      error: result.error,
    };
  }

  /**
   * 插入数据（兼容 Supabase API）
   * 支持 .from('table').insert(data).select() 链式调用
   */
  private insertData?: Record<string, unknown> | Record<string, unknown>[];
  private isInsertOperation = false;

  insert(
    data: Record<string, unknown> | Record<string, unknown>[],
  ): PostgresInsertBuilder<T> {
    this.insertData = data;
    this.isInsertOperation = true;
    return new PostgresInsertBuilder(this.pool, this.table, data);
  }

  /**
   * 更新数据（兼容 Supabase API）
   * 支持 .from('table').update(data).eq('id', id) 链式调用
   */
  private updateData?: Record<string, unknown>;
  private isUpdateOperation = false;

  update(data: Record<string, unknown>): PostgresUpdateBuilder<T> {
    this.updateData = data;
    this.isUpdateOperation = true;
    return new PostgresUpdateBuilder(this.pool, this.table, data);
  }

  /**
   * 删除数据（兼容 Supabase API）
   * 返回查询构建器以支持链式调用
   */
  delete(): this {
    this.isDeleteOperation = true;
    return this;
  }

  async execute<TResult = T>(): Promise<{
    data: TResult[] | null;
    error: Error | null;
    count?: number;
  }> {
    try {
      const escapedTable = this.escapeIdentifier(this.table);
      const { clause, values } = this.buildWhereClause();

      // 如果是删除操作
      if (this.isDeleteOperation) {
        if (!clause) {
          // 如果没有 WHERE 子句，不允许删除所有数据（安全考虑）
          return {
            data: null,
            error: new Error(
              "Delete operation requires at least one filter condition",
            ),
          };
        }

        let query = `DELETE FROM ${escapedTable} ${clause} RETURNING *`;
        const queryValues = [...values];

        if (this.limitValue) {
          query += ` LIMIT $${queryValues.length + 1}`;
          queryValues.push(this.limitValue);
        }

        const result = await this.pool.query(query, queryValues);

        return {
          data: result.rows as TResult[],
          error: null,
        };
      }

      // 正常的 SELECT 查询
      const selectFields = this.selectColumns
        ? this.selectColumns
            .map((field) => {
              // 如果是通配符 *，直接返回，不转义
              if (field === "*") return "*";
              return this.escapeIdentifier(field);
            })
            .join(", ")
        : "*";
      const orderByClause = this.buildOrderByClause();

      let query = `SELECT ${selectFields} FROM ${escapedTable} ${clause} ${orderByClause}`;
      const queryValues = [...values];

      if (this.limitValue) {
        query += ` LIMIT $${queryValues.length + 1}`;
        queryValues.push(this.limitValue);
      }

      if (this.offsetValue) {
        query += ` OFFSET $${queryValues.length + 1}`;
        queryValues.push(this.offsetValue);
      }

      const result = await this.pool.query(query, queryValues);

      // 如果需要 count，执行单独的计数查询
      let count: number | undefined;
      if (clause) {
        const countQuery = `SELECT COUNT(*) as count FROM ${escapedTable} ${clause}`;
        const countResult = await this.pool.query(countQuery, values);
        count = parseInt(countResult.rows[0].count, 10);
      } else {
        count = result.rows.length;
      }

      return {
        data: result.rows as TResult[],
        error: null,
        count,
      };
    } catch (error) {
      // 增强错误信息，帮助开发者排查连接问题
      let enhancedError =
        error instanceof Error ? error : new Error(String(error));

      // 检测常见的连接错误
      if (
        enhancedError.message.includes("ECONNREFUSED") ||
        enhancedError.name === "AggregateError"
      ) {
        console.error("Database connection failed. Is Docker running?");
        enhancedError = new Error(
          `Database connection failed: ${enhancedError.message}. Please ensure Docker containers are running (pnpm dev:services).`,
        );
      }

      return {
        data: null,
        error: enhancedError,
      };
    }
  }

  // 支持 Promise-like 接口（兼容 Supabase）
  async then<
    TResult1 = { data: T[] | null; error: Error | null; count?: number },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: T[] | null;
          error: Error | null;
          count?: number;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute<T>();

    if (result.error && onrejected) {
      return onrejected(result.error);
    }

    if (onfulfilled) {
      return onfulfilled(result);
    }

    return result as TResult1;
  }
}

/**
 * PostgreSQL 客户端（模拟 Supabase Client API）
 *
 * @description
 * 提供与 Supabase Client 兼容的接口，支持：
 * - 链式查询（from、select、where、order 等）
 * - CRUD 操作（insert、update、delete）
 * - RPC 函数调用
 */
export class PostgreSQLClient {
  private pool: Pool;
  private isAdmin: boolean;

  constructor(pool: Pool, isAdmin = false) {
    this.pool = pool;
    this.isAdmin = isAdmin;
  }

  /**
   * 创建查询构建器
   *
   * @param table - 表名
   * @returns 查询构建器实例
   *
   * @example
   * ```typescript
   * const query = db.from('albums')
   * const { data } = await query.select('*').eq('is_public', true)
   * ```
   */
  from<T = unknown>(table: string): PostgresQueryBuilder<T> {
    return new PostgresQueryBuilder<T>(this.pool, table);
  }

  /**
   * 调用数据库函数（RPC）
   *
   * @param functionName - 函数名
   * @param params - 函数参数（可选）
   * @returns 函数执行结果
   *
   * @example
   * ```typescript
   * const { data } = await db.rpc('increment_photo_count', { album_id: '123' })
   * ```
   */
  async rpc(
    functionName: string,
    params?: RpcParams,
  ): Promise<{ data: unknown; error: Error | null }> {
    try {
      const paramValues = params ? Object.values(params) : [];
      const paramPlaceholders = paramValues
        .map((_, i) => `$${i + 1}`)
        .join(", ");

      const query =
        paramValues.length > 0
          ? `SELECT ${functionName}(${paramPlaceholders})`
          : `SELECT ${functionName}()`;

      const result = await this.pool.query(query, paramValues);

      return {
        data: result.rows.length > 0 ? result.rows[0][functionName] : null,
        error: null,
      };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  /**
   * 执行原始 SQL 查询
   *
   * @param sql - SQL 语句
   * @param params - 查询参数（可选）
   * @returns 查询结果
   *
   * @example
   * ```typescript
   * const { data } = await db.query('SELECT * FROM albums WHERE id = $1', ['123'])
   * const { data } = await db.query('SELECT COUNT(*) FROM photos')
   * ```
   */
  async query<T = unknown>(
    sql: string,
    params?: QueryParameterValue[],
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const result = await this.pool.query(sql, params || []);
      return {
        data: result.rows as T[],
        error: null,
      };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  /**
   * 插入数据
   *
   * @param table - 表名
   * @param data - 要插入的数据（单条或数组）
   * @returns 插入结果
   *
   * @example
   * ```typescript
   * // 插入单条记录
   * const { data } = await db.insert('albums', { title: 'My Album', slug: 'my-album' })
   *
   * // 批量插入
   * const { data } = await db.insert('albums', [
   *   { title: 'Album 1', slug: 'album-1' },
   *   { title: 'Album 2', slug: 'album-2' }
   * ])
   * ```
   */
  async insert<T = unknown>(
    table: string,
    data: T | T[],
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const escapedTable = `"${table.replace(/"/g, '""')}"`;
      const rows = Array.isArray(data) ? data : [data];

      if (rows.length === 0) {
        return { data: [], error: null };
      }

      const columns = Object.keys(rows[0] as Record<string, unknown>);
      const escapedColumns = columns
        .map((col) => `"${col.replace(/"/g, '""')}"`)
        .join(", ");

      const values: QueryParameterValue[] = [];
      const placeholders: string[] = [];

      rows.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = [];
        const rowRecord = row as Record<string, unknown>;
        columns.forEach((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1;
          rowPlaceholders.push(`$${paramIndex}`);
          values.push(rowRecord[col] as QueryParameterValue);
        });
        placeholders.push(`(${rowPlaceholders.join(", ")})`);
      });

      const query = `INSERT INTO ${escapedTable} (${escapedColumns}) VALUES ${placeholders.join(", ")} RETURNING *`;
      const result = await this.pool.query(query, values);

      return {
        data: result.rows as T[],
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 插入或更新数据 (Upsert)
   *
   * @param table - 表名
   * @param data - 要插入或更新的数据
   * @param onConflict - 冲突字段 (默认为 'id')
   * @returns 结果
   */
  async upsert<T = unknown>(
    table: string,
    data: T | T[],
    onConflict: string = "id",
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const escapedTable = `"${table.replace(/"/g, '""')}"`;
      const rows = Array.isArray(data) ? data : [data];

      if (rows.length === 0) {
        return { data: [], error: null };
      }

      const columns = Object.keys(rows[0] as Record<string, unknown>);
      const escapedColumns = columns
        .map((col) => `"${col.replace(/"/g, '""')}"`)
        .join(", ");

      const values: QueryParameterValue[] = [];
      const placeholders: string[] = [];

      rows.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = [];
        const rowRecord = row as Record<string, unknown>;
        columns.forEach((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1;
          rowPlaceholders.push(`$${paramIndex}`);
          values.push(rowRecord[col] as QueryParameterValue);
        });
        placeholders.push(`(${rowPlaceholders.join(", ")})`);
      });

      // 构建 ON CONFLICT DO UPDATE 子句
      const escapedOnConflict = `"${onConflict.replace(/"/g, '""')}"`;
      const updateColumns = columns
        .filter((col) => col !== onConflict)
        .map((col) => {
          const escapedCol = `"${col.replace(/"/g, '""')}"`;
          return `${escapedCol} = EXCLUDED.${escapedCol}`;
        })
        .join(", ");

      const query = `INSERT INTO ${escapedTable} (${escapedColumns}) VALUES ${placeholders.join(", ")} 
                     ON CONFLICT (${escapedOnConflict}) DO UPDATE SET ${updateColumns} 
                     RETURNING *`;

      const result = await this.pool.query(query, values);

      return {
        data: result.rows as T[],
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 批量更新数据
   * 使用 UPDATE ... FROM (VALUES ...) 语法
   *
   * @param table - 表名
   * @param data - 要更新的数据数组
   * @param keyColumn - 主键列名（默认为 'id'）
   */
  async updateBatch<T = unknown>(
    table: string,
    data: T[],
    keyColumn: string = "id",
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      if (data.length === 0) {
        return { data: [], error: null };
      }

      const escapedTable = `"${table.replace(/"/g, '""')}"`;
      const escapedKey = `"${keyColumn.replace(/"/g, '""')}"`;

      const columns = Object.keys(data[0] as Record<string, unknown>);
      if (!columns.includes(keyColumn)) {
        return {
          data: null,
          error: new Error(`Key column '${keyColumn}' must be present in data`),
        };
      }

      const valueColumns = columns.filter((col) => col !== keyColumn);
      if (valueColumns.length === 0) {
        return { data: [], error: null };
      }

      const values: QueryParameterValue[] = [];
      const placeholders: string[] = [];

      data.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = [];
        const rowRecord = row as Record<string, unknown>;

        columns.forEach((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1;
          rowPlaceholders.push(`$${paramIndex}`);
          values.push(rowRecord[col] as QueryParameterValue);
        });
        placeholders.push(`(${rowPlaceholders.join(", ")})`);
      });

      const valuesAlias = `v(${columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ")})`;

      // 构建 SET 子句
      // 注意：这里假设列类型兼容，如果遇到 UUID = text 问题，可能需要显式转换
      // 对于 WHERE 子句，我们强制转换为 text 进行比较，以兼容 UUID
      const setClauses = valueColumns
        .map((col) => {
          const escapedCol = `"${col.replace(/"/g, '""')}"`;
          // 尝试处理常见的 UUID 列转换问题
          if (col.endsWith("_id") || col === "id") {
            return `${escapedCol} = v.${escapedCol}::text::uuid`;
          }
          // 对于其他列，尝试让数据库进行隐式转换
          // 如果是数字，v.col 应该是数字类型（因为参数是数字）
          return `${escapedCol} = v.${escapedCol}`;
        })
        .join(", ");

      const query = `UPDATE ${escapedTable} 
                     SET ${setClauses} 
                     FROM (VALUES ${placeholders.join(", ")}) AS ${valuesAlias} 
                     WHERE ${escapedTable}.${escapedKey}::text = v.${escapedKey}::text
                     RETURNING ${escapedTable}.*`;

      const result = await this.pool.query(query, values);

      return {
        data: result.rows as T[],
        error: null,
      };
    } catch (error) {
      // 如果出现类型转换错误，尝试回退到逐条更新（性能较差但安全）
      if (
        error instanceof Error &&
        (error.message.includes("type") || error.message.includes("operator"))
      ) {
        console.warn(
          "[Database] Batch update failed, falling back to sequential update:",
          error.message,
        );
        // Fallback implementation...
        // 但为了保持简单，这里直接返回错误，由调用者决定
      }
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 更新数据
   *
   * @param table - 表名
   * @param data - 要更新的字段
   * @param filters - 过滤条件（WHERE 子句）
   * @returns 更新结果
   *
   * @example
   * ```typescript
   * const { data } = await db.update(
   *   'albums',
   *   { title: 'New Title' },
   *   { id: '123' }
   * )
   * ```
   */
  async update<T = unknown>(
    table: string,
    data: Partial<T>,
    filters: DatabaseFilters,
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const escapedTable = `"${table.replace(/"/g, '""')}"`;
      const setClauses: string[] = [];
      const values: QueryParameterValue[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(data)) {
        const escapedKey = `"${key.replace(/"/g, '""')}"`;
        setClauses.push(`${escapedKey} = $${paramIndex++}`);
        values.push(value as QueryParameterValue);
      }

      const whereClauses: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (key.endsWith("[]") && Array.isArray(value)) {
          // 处理 IN 查询: id[] = ['1', '2'] -> id = ANY($N)
          const columnName = key.slice(0, -2);
          const escapedKey = `"${columnName.replace(/"/g, '""')}"`;
          whereClauses.push(`${escapedKey} = ANY($${paramIndex++})`);
          values.push(value as QueryParameterValue);
        } else if (value === null || value === undefined) {
          // 处理 NULL 值：使用 IS NULL（PostgreSQL 中 = NULL 永远不会匹配）
          const escapedKey = `"${key.replace(/"/g, '""')}"`;
          whereClauses.push(`${escapedKey} IS NULL`);
          // 不添加参数，因为 IS NULL 不需要参数
        } else {
          const escapedKey = `"${key.replace(/"/g, '""')}"`;
          whereClauses.push(`${escapedKey} = $${paramIndex++}`);
          values.push(value as QueryParameterValue);
        }
      }

      const query = `UPDATE ${escapedTable} SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")} RETURNING *`;
      const result = await this.pool.query(query, values);

      return {
        data: result.rows as T[],
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 删除数据
   *
   * @param table - 表名
   * @param filters - 过滤条件（WHERE 子句）
   * @returns 删除结果
   *
   * @example
   * ```typescript
   * const { data } = await db.delete('albums', { id: '123' })
   * ```
   */
  async delete(
    table: string,
    filters: DatabaseFilters,
  ): Promise<{ data: unknown[] | null; error: Error | null }> {
    try {
      const escapedTable = `"${table.replace(/"/g, '""')}"`;
      const whereClauses: string[] = [];
      const values: QueryParameterValue[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(filters)) {
        if (key.endsWith("[]") && Array.isArray(value)) {
          // 处理 IN 查询: id[] = ['1', '2'] -> id = ANY($N)
          const columnName = key.slice(0, -2);
          const escapedKey = `"${columnName.replace(/"/g, '""')}"`;
          whereClauses.push(`${escapedKey} = ANY($${paramIndex++})`);
          values.push(value as QueryParameterValue);
        } else {
          const escapedKey = `"${key.replace(/"/g, '""')}"`;
          whereClauses.push(`${escapedKey} = $${paramIndex++}`);
          values.push(value as QueryParameterValue);
        }
      }

      const query = `DELETE FROM ${escapedTable} WHERE ${whereClauses.join(" AND ")} RETURNING *`;
      const result = await this.pool.query(query, values);

      return {
        data: result.rows,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 关闭数据库连接
   *
   * @description
   * 关闭连接池，释放所有连接
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * 创建 PostgreSQL 客户端（用于 Server Components）
 *
 * @returns PostgreSQL 客户端实例
 *
 * @example
 * ```typescript
 * import { createPostgreSQLClient } from '@/lib/database/postgresql-client'
 *
 * const db = createPostgreSQLClient()
 * const { data } = await db.from('albums').select('*')
 * ```
 */
export function createPostgreSQLClient(): PostgreSQLClient {
  const pool = getPool();
  return new PostgreSQLClient(pool, false);
}

/**
 * 创建 PostgreSQL Admin 客户端（绕过权限检查）
 *
 * @description
 * Admin 客户端具有额外权限，可以绕过 RLS 策略
 *
 * @returns PostgreSQL Admin 客户端实例
 *
 * @example
 * ```typescript
 * import { createPostgreSQLAdminClient } from '@/lib/database/postgresql-client'
 *
 * const db = createPostgreSQLAdminClient()
 * const { data } = await db.from('users').select('*')
 * ```
 */
export function createPostgreSQLAdminClient(): PostgreSQLClient {
  const pool = getPool();
  return new PostgreSQLClient(pool, true);
}

/**
 * INSERT 操作构建器
 * 支持 .from('table').insert(data).select() 链式调用
 */
class PostgresInsertBuilder<T = unknown> {
  private pool: Pool;
  private table: string;
  private data: Record<string, unknown> | Record<string, unknown>[];
  private selectColumns?: string;
  private returningSingle = false;

  constructor(
    pool: Pool,
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[],
  ) {
    this.pool = pool;
    this.table = table;
    this.data = data;
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  select(columns = "*"): this {
    this.selectColumns = columns;
    return this;
  }

  single(): this {
    this.returningSingle = true;
    return this;
  }

  async then<TResult1 = { data: T | T[] | null; error: Error | null }>(
    resolve: (value: { data: T | T[] | null; error: Error | null }) => TResult1,
  ): Promise<TResult1> {
    try {
      const escapedTable = this.escapeIdentifier(this.table);
      const rows = Array.isArray(this.data) ? this.data : [this.data];

      if (rows.length === 0) {
        return resolve({ data: [], error: null });
      }

      const columns = Object.keys(rows[0]);
      const escapedColumns = columns
        .map((col) => this.escapeIdentifier(col))
        .join(", ");

      const values: QueryParameterValue[] = [];
      const placeholders: string[] = [];

      rows.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = [];
        columns.forEach((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1;
          rowPlaceholders.push(`$${paramIndex}`);
          values.push(row[col] as QueryParameterValue);
        });
        placeholders.push(`(${rowPlaceholders.join(", ")})`);
      });

      const returning = this.selectColumns
        ? `RETURNING ${this.selectColumns === "*" ? "*" : this.selectColumns}`
        : "RETURNING *";
      const query = `INSERT INTO ${escapedTable} (${escapedColumns}) VALUES ${placeholders.join(", ")} ${returning}`;

      const result = await this.pool.query(query, values);

      if (this.returningSingle) {
        return resolve({
          data: result.rows.length > 0 ? (result.rows[0] as T) : null,
          error: null,
        });
      }

      return resolve({
        data: result.rows as T[],
        error: null,
      });
    } catch (error) {
      return resolve({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

/**
 * UPDATE 操作构建器
 * 支持 .from('table').update(data).eq('id', id) 链式调用
 */
class PostgresUpdateBuilder<T = unknown> {
  private pool: Pool;
  private table: string;
  private data: Record<string, unknown>;
  private filters: DatabaseFilters = {};
  private selectColumns?: string;
  private returningSingle = false;

  constructor(pool: Pool, table: string, data: Record<string, unknown>) {
    this.pool = pool;
    this.table = table;
    this.data = data;
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  eq(column: string, value: QueryParameterValue): this {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: QueryParameterValue): this {
    this.filters[`!${column}`] = value;
    return this;
  }

  is(column: string, value: null): this {
    this.filters[`${column}?`] = value;
    return this;
  }

  select(columns = "*"): this {
    this.selectColumns = columns;
    return this;
  }

  single(): this {
    this.returningSingle = true;
    return this;
  }

  async then<TResult1 = { data: T | T[] | null; error: Error | null }>(
    resolve: (value: { data: T | T[] | null; error: Error | null }) => TResult1,
  ): Promise<TResult1> {
    try {
      const escapedTable = this.escapeIdentifier(this.table);
      const columns = Object.keys(this.data);

      if (columns.length === 0) {
        return resolve({ data: null, error: new Error("No data to update") });
      }

      const values: QueryParameterValue[] = [];
      let paramIndex = 1;

      // Build SET clause
      const setClause = columns
        .map((col) => {
          const escapedCol = this.escapeIdentifier(col);
          values.push(this.data[col] as QueryParameterValue);
          return `${escapedCol} = $${paramIndex++}`;
        })
        .join(", ");

      // Build WHERE clause
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(this.filters)) {
        const cleanKey = key.replace(/^!/, "").replace(/\?$/, "");
        const escapedKey = this.escapeIdentifier(cleanKey);

        if (key.endsWith("?") && value === null) {
          conditions.push(`${escapedKey} IS NULL`);
        } else if (key.startsWith("!")) {
          conditions.push(`${escapedKey} != $${paramIndex++}`);
          values.push(value as QueryParameterValue);
        } else {
          conditions.push(`${escapedKey} = $${paramIndex++}`);
          values.push(value as QueryParameterValue);
        }
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const returning = this.selectColumns
        ? `RETURNING ${this.selectColumns === "*" ? "*" : this.selectColumns}`
        : "RETURNING *";
      const query = `UPDATE ${escapedTable} SET ${setClause} ${whereClause} ${returning}`;

      const result = await this.pool.query(query, values);

      if (this.returningSingle) {
        return resolve({
          data: result.rows.length > 0 ? (result.rows[0] as T) : null,
          error: null,
        });
      }

      return resolve({
        data: result.rows as T[],
        error: null,
      });
    } catch (error) {
      return resolve({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
