/**
 * Supabase 兼容层
 * 
 * PIS Standalone 版本支持 Supabase（云端）和 PostgreSQL（自托管）两种数据库后端
 * 此文件提供与 Supabase Client 相同的 API 接口，用于向后兼容和混合部署模式
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseCompatConfig {
  type: 'supabase';
  // Supabase 配置
  supabaseUrl?: string;
  supabaseKey?: string;
}

/**
 * Supabase 兼容客户端
 * 用于向后兼容和混合部署模式（Vercel + Supabase）
 */
export class SupabaseCompatClient {
  private supabaseClient: SupabaseClient;
  private config: SupabaseCompatConfig;

  constructor(config: SupabaseCompatConfig) {
    this.config = config;

    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Supabase URL and Key are required');
    }
    this.supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
  }

  from<T = any>(table: string): ReturnType<SupabaseClient['from']> {
    return this.supabaseClient.from(table);
  }

  /**
   * 调用数据库函数 (RPC)
   */
  async rpc(functionName: string, params?: Record<string, any>): Promise<{ data: any; error: Error | null }> {
    return this.supabaseClient.rpc(functionName, params);
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // Supabase client doesn't need explicit close
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseClient.from('albums').select('id').limit(1);
      if (error) throw error;
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}

/**
 * 从环境变量创建 Supabase 兼容客户端
 * 用于向后兼容和混合部署模式（Vercel + Supabase）
 */
export function createSupabaseCompatClient(): SupabaseCompatClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return new SupabaseCompatClient({
    type: 'supabase',
    supabaseUrl,
    supabaseKey,
  });
}
