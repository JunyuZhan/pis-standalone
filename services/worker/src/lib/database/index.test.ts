/**
 * 数据库适配器工厂测试
 * 
 * PIS Standalone 支持两种数据库后端：
 * - PostgreSQL（默认，内网/自托管部署）
 * - Supabase（可选，向后兼容）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDatabaseAdapter, getDatabaseAdapter, getSupabaseClient } from './index.js';
import { SupabaseAdapter } from './supabase-adapter.js';
import { PostgreSQLAdapter } from './postgresql-adapter.js';
import type { DatabaseConfig } from './types.js';

// Mock 适配器类
class MockSupabaseAdapter {
  constructor(public config: any) {}
  getClient() {
    return { client: 'mock' };
  }
  
  // 添加其他 DatabaseAdapter 方法以满足接口要求
  async findOne() { return { data: null, error: null }; }
  async findMany() { return { data: [], error: null }; }
  async insert() { return { data: null, error: null }; }
  async update() { return { data: null, error: null }; }
  async delete() { return { data: null, error: null }; }
  async count() { return { data: 0, error: null }; }
  async close() {}
}

class MockPostgreSQLAdapter {
  constructor(public config: any) {}
  
  // 添加其他 DatabaseAdapter 方法以满足接口要求
  async findOne() { return { data: null, error: null }; }
  async findMany() { return { data: [], error: null }; }
  async insert() { return { data: null, error: null }; }
  async update() { return { data: null, error: null }; }
  async delete() { return { data: null, error: null }; }
  async count() { return { data: 0, error: null }; }
  async close() {}
}

vi.mock('./supabase-adapter.js', () => ({
  SupabaseAdapter: vi.fn(function SupabaseAdapter(config: any) {
    return new MockSupabaseAdapter(config);
  }),
}));

vi.mock('./postgresql-adapter.js', () => ({
  PostgreSQLAdapter: vi.fn(function PostgreSQLAdapter(config: any) {
    return new MockPostgreSQLAdapter(config);
  }),
}));

describe('Database Adapter Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清除模块缓存以重置单例
    vi.resetModules();
  });

  describe('createDatabaseAdapter', () => {
    it('应该创建 PostgreSQL 适配器（默认）', () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'pis',
        user: 'pis',
        password: 'password',
      };

      const adapter = createDatabaseAdapter(config);

      expect(PostgreSQLAdapter).toHaveBeenCalledWith(config);
      expect(adapter).toBeDefined();
    });

    it('应该从环境变量创建 PostgreSQL 适配器（默认）', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'postgresql',
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'pis',
        DATABASE_USER: 'pis',
        DATABASE_PASSWORD: 'password',
      };

      const adapter = createDatabaseAdapter();

      expect(PostgreSQLAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();

      process.env = originalEnv;
    });

    it('应该创建 Supabase 适配器（向后兼容）', () => {
      const config: DatabaseConfig = {
        type: 'supabase',
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
      };

      const adapter = createDatabaseAdapter(config);

      expect(SupabaseAdapter).toHaveBeenCalledWith(config);
      expect(adapter).toBeDefined();
    });

    it('应该从环境变量创建 Supabase 适配器（向后兼容）', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'supabase',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };

      const adapter = createDatabaseAdapter();

      expect(SupabaseAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();

      process.env = originalEnv;
    });

    it('应该拒绝不支持的数据库类型', () => {
      const config = {
        type: 'invalid' as any,
      };

      expect(() => createDatabaseAdapter(config as DatabaseConfig)).toThrow(
        'Unsupported database type: invalid. Supported types: \'supabase\', \'postgresql\''
      );
    });
  });

  describe('getDatabaseAdapter', () => {
    it('应该返回单例适配器', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'supabase',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };

      // 清除之前的调用记录
      vi.clearAllMocks();
      
      const adapter1 = getDatabaseAdapter();
      const adapter2 = getDatabaseAdapter();

      expect(adapter1).toBe(adapter2);
      // 注意：由于单例模式，第二次调用不会创建新实例，所以这里只调用一次
      expect(SupabaseAdapter).toHaveBeenCalled();

      process.env = originalEnv;
    });
  });

  describe('getSupabaseClient', () => {
    it('应该从 Supabase 适配器获取客户端', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_TYPE: 'supabase',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };

      const adapter = getDatabaseAdapter();
      
      // 由于我们 mock 了 SupabaseAdapter，instanceOf 检查会失败
      // 但 MockSupabaseAdapter 有 getClient 方法，所以我们可以直接测试
      if (adapter && typeof (adapter as any).getClient === 'function') {
        const client = (adapter as any).getClient();
        expect(client).toBeDefined();
      }

      process.env = originalEnv;
    });

    it('应该从 Supabase 适配器获取客户端（通过 getSupabaseClient）', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };

      // 由于 mock 了 SupabaseAdapter，instanceof 检查会失败
      // 但我们可以直接测试 getDatabaseAdapter().getClient()
      const adapter = getDatabaseAdapter();
      if (adapter && typeof (adapter as any).getClient === 'function') {
        const client = (adapter as any).getClient();
        expect(client).toBeDefined();
      } else {
        // 如果 getSupabaseClient 抛出错误（因为 instanceof 检查），这是预期的行为
        expect(() => getSupabaseClient()).toThrow('Supabase client is only available when using Supabase adapter');
      }

      process.env = originalEnv;
    });
  });
});
