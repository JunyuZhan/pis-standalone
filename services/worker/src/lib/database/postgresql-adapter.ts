/**
 * PostgreSQL 数据库适配器
 * 直接使用 pg 库连接 PostgreSQL 数据库
 */
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { DatabaseAdapter, DatabaseConfig, QueryResult as AdapterQueryResult } from './types.js';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    if (!config.host || !config.database || !config.user || !config.password) {
      throw new Error('PostgreSQL adapter requires host, database, user, and password');
    }

    this.pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 20, // 连接池最大连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // 监听连接错误
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  /**
   * 转义标识符（表名、列名）
   */
  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * 构建 WHERE 子句
   * 支持查询构建器的特殊键格式：
   * - "column<" -> column < value
   * - "column>" -> column > value
   * - "column<=" -> column <= value
   * - "column>=" -> column >= value
   * - "!column" -> column != value
   * - "!column:operator" -> NOT (column operator value)
   * - "column?" -> column IS value
   * - "column~" -> column LIKE value
   * - "column~~" -> column ILIKE value
   * - "column[]" -> column IN (values)
   */
  private buildWhereClause(filters: Record<string, any>): { clause: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      let column: string;
      let operator: string;
      let isNot = false;

      // 解析特殊键格式
      if (key.startsWith('!')) {
        // 处理 "!column:operator" 格式（用于 not() 方法）
        if (key.includes(':')) {
          const parts = key.substring(1).split(':');
          column = parts[0];
          const op = parts[1];
          
          if (op === 'is') {
            // NOT (column IS value)
            const escapedColumn = this.escapeIdentifier(column);
            if (value === null) {
              conditions.push(`NOT (${escapedColumn} IS NULL)`);
            } else {
              conditions.push(`NOT (${escapedColumn} IS $${paramIndex++})`);
              values.push(value);
            }
            continue;
          } else {
            // 其他操作符暂不支持，使用默认处理
            column = key.substring(1);
            operator = '!=';
            isNot = false; // neq() 不需要额外的 NOT
          }
        } else {
          // "!column" 格式（来自 neq()） -> column != value（不需要 NOT 包装）
          column = key.substring(1);
          operator = '!=';
          isNot = false; // neq() 不需要额外的 NOT
        }
      } else if (key.endsWith('<')) {
        column = key.slice(0, -1);
        operator = '<';
      } else if (key.endsWith('>')) {
        column = key.slice(0, -1);
        operator = '>';
      } else if (key.endsWith('<=')) {
        column = key.slice(0, -2);
        operator = '<=';
      } else if (key.endsWith('>=')) {
        column = key.slice(0, -2);
        operator = '>=';
      } else if (key.endsWith('?')) {
        // "column?" -> column IS value
        column = key.slice(0, -1);
        const escapedColumn = this.escapeIdentifier(column);
        if (value === null) {
          conditions.push(`${escapedColumn} IS NULL`);
        } else {
          conditions.push(`${escapedColumn} IS $${paramIndex++}`);
          values.push(value);
        }
        continue;
      } else if (key.endsWith('~')) {
        // "column~" -> column LIKE value
        column = key.slice(0, -1);
        operator = 'LIKE';
      } else if (key.endsWith('~~')) {
        // "column~~" -> column ILIKE value
        column = key.slice(0, -2);
        operator = 'ILIKE';
      } else if (key.endsWith('[]')) {
        // "column[]" -> column IN (values)
        column = key.slice(0, -2);
        const escapedColumn = this.escapeIdentifier(column);
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${escapedColumn} IN (${placeholders})`);
          values.push(...value);
        } else {
          // 空数组，使用 FALSE 条件
          conditions.push('FALSE');
        }
        continue;
      } else {
        // 普通键，使用等号
        column = key;
        operator = '=';
      }

      const escapedColumn = this.escapeIdentifier(column);
      
      if (value === null) {
        if (operator === '=') {
          conditions.push(`${escapedColumn} IS NULL`);
        } else if (operator === '!=') {
          conditions.push(`${escapedColumn} IS NOT NULL`);
        } else {
          // 其他操作符与 NULL 比较
          conditions.push(`${escapedColumn} ${operator} NULL`);
        }
      } else if (Array.isArray(value)) {
        // 数组值，使用 IN
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${escapedColumn} IN (${placeholders})`);
        values.push(...value);
      } else {
        // 普通值
        const condition = `${escapedColumn} ${operator} $${paramIndex++}`;
        if (isNot) {
          conditions.push(`NOT (${condition})`);
        } else {
          conditions.push(condition);
        }
        values.push(value);
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    };
  }

  /**
   * 构建 ORDER BY 子句
   */
  private buildOrderByClause(orderBy?: { column: string; direction: 'asc' | 'desc' }[]): string {
    if (!orderBy || orderBy.length === 0) {
      return '';
    }

    const clauses = orderBy.map((order) => {
      const escapedColumn = this.escapeIdentifier(order.column);
      const direction = order.direction.toUpperCase();
      return `${escapedColumn} ${direction}`;
    });

    return `ORDER BY ${clauses.join(', ')}`;
  }

  async findOne<T = any>(
    table: string,
    filters: Record<string, any>
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const { clause, values } = this.buildWhereClause(filters);
      const query = `SELECT * FROM ${escapedTable} ${clause} LIMIT 1`;

      const result = await this.pool.query(query, values);

      return {
        data: result.rows[0] || null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async findMany<T = any>(
    table: string,
    filters?: Record<string, any>,
    options?: {
      select?: string[];
      limit?: number;
      offset?: number;
      orderBy?: { column: string; direction: 'asc' | 'desc' }[];
    }
  ): Promise<AdapterQueryResult<T>> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const selectFields = options?.select
        ? options.select.map((field) => this.escapeIdentifier(field)).join(', ')
        : '*';
      const { clause, values } = filters ? this.buildWhereClause(filters) : { clause: '', values: [] };
      const orderByClause = this.buildOrderByClause(options?.orderBy);

      let query = `SELECT ${selectFields} FROM ${escapedTable} ${clause} ${orderByClause}`;
      const queryValues = [...values];

      if (options?.limit) {
        query += ` LIMIT $${queryValues.length + 1}`;
        queryValues.push(options.limit);
      }

      if (options?.offset) {
        query += ` OFFSET $${queryValues.length + 1}`;
        queryValues.push(options.offset);
      }

      const result = await this.pool.query(query, queryValues);

      // 获取总数（如果需要）
      let count: number | undefined;
      if (filters) {
        const { clause: countClause, values: countValues } = this.buildWhereClause(filters);
        const countResult = await this.pool.query(
          `SELECT COUNT(*) as count FROM ${escapedTable} ${countClause}`,
          countValues
        );
        count = parseInt(countResult.rows[0].count, 10);
      }

      return {
        data: result.rows as T[],
        error: null,
        count,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async insert<T = any>(
    table: string,
    data: T | T[]
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) {
        return { data: [], error: null };
      }

      const escapedTable = this.escapeIdentifier(table);
      const firstRecord = records[0] as Record<string, any>;
      const columns = Object.keys(firstRecord);
      const escapedColumns = columns.map((col) => this.escapeIdentifier(col));
      const placeholders: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const record of records) {
        const rowPlaceholders: string[] = [];
        for (const column of columns) {
          rowPlaceholders.push(`$${paramIndex++}`);
          values.push((record as Record<string, any>)[column]);
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const columnsStr = escapedColumns.join(', ');
      const valuesStr = placeholders.join(', ');
      const query = `INSERT INTO ${escapedTable} (${columnsStr}) VALUES ${valuesStr} RETURNING *`;

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

  async update<T = any>(
    table: string,
    filters: Record<string, any>,
    data: Partial<T>
  ): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const updateFields = Object.keys(data);
      if (updateFields.length === 0) {
        return { data: null, error: new Error('No fields to update') };
      }

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const field of updateFields) {
        const escapedField = this.escapeIdentifier(field);
        setClauses.push(`${escapedField} = $${paramIndex++}`);
        values.push((data as Record<string, any>)[field]);
      }

      const escapedTable = this.escapeIdentifier(table);
      // 使用 buildWhereClause 方法正确处理特殊格式的 filters（如 column?, column>, 等）
      const { clause: whereClause, values: whereValues } = this.buildWhereClause(filters);
      // 调整 WHERE 子句中的参数索引，使其从 SET 子句之后开始
      const adjustedWhereClause = whereClause.replace(/\$(\d+)/g, (_, num) => {
        return `$${parseInt(num, 10) + paramIndex - 1}`;
      });
      const setClause = setClauses.join(', ');

      const query = `UPDATE ${escapedTable} SET ${setClause} ${adjustedWhereClause} RETURNING *`;
      const allValues = [...values, ...whereValues];

      const result = await this.pool.query(query, allValues);

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

  async delete(
    table: string,
    filters: Record<string, any>
  ): Promise<{ error: Error | null }> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const { clause, values } = this.buildWhereClause(filters);
      const query = `DELETE FROM ${escapedTable} ${clause}`;

      await this.pool.query(query, values);

      return {
        error: null,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async count(
    table: string,
    filters?: Record<string, any>
  ): Promise<number> {
    try {
      const escapedTable = this.escapeIdentifier(table);
      const { clause, values } = filters ? this.buildWhereClause(filters) : { clause: '', values: [] };
      const query = `SELECT COUNT(*) as count FROM ${escapedTable} ${clause}`;

      const result = await this.pool.query(query, values);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
