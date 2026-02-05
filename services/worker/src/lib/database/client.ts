
import { createSupabaseCompatClient, SupabaseCompatClient } from './supabase-compat.js';
import { createPostgreSQLCompatClient, PostgreSQLCompatClient } from './postgresql-compat.js';
import logger from '../logger.js';

// 注意：环境变量应该在 index.ts 中加载，这里不再重复加载
// 如果环境变量未加载，createPostgreSQLCompatClient 会抛出错误
const dbType = (process.env.DATABASE_TYPE || 'postgresql').toLowerCase();
let dbClient: SupabaseCompatClient | PostgreSQLCompatClient;

if (dbType === 'postgresql') {
  // PostgreSQL 模式：使用 PostgreSQL 适配器
  try {
    // 验证环境变量是否已加载
    if (!process.env.DATABASE_PASSWORD && !process.env.DATABASE_URL) {
      const error = new Error(
        'DATABASE_PASSWORD or DATABASE_URL is required but not set. ' +
        'Make sure environment variables are loaded in index.ts before importing this module.'
      );
      console.error('[Database Client] Environment variables check:', {
        DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ? 'SET' : 'NOT SET',
        DATABASE_HOST: process.env.DATABASE_HOST || 'NOT SET',
        DATABASE_USER: process.env.DATABASE_USER || 'NOT SET',
        DATABASE_NAME: process.env.DATABASE_NAME || 'NOT SET',
      });
      throw error;
    }
    
    dbClient = createPostgreSQLCompatClient();
    logger.info({ mode: 'postgresql' }, '✅ Database client initialized');
  } catch (err: any) {
    logger.fatal({ err }, '❌ Failed to initialize PostgreSQL database client');
    throw err; // 重新抛出错误，让调用者处理
  }
} else {
  // Supabase 模式：使用 Supabase 客户端
  try {
    dbClient = createSupabaseCompatClient();
    logger.info({ mode: 'supabase' }, '✅ Database client initialized');
  } catch (err: any) {
    logger.fatal({ err }, '❌ Failed to initialize Supabase database client');
    throw err; // 重新抛出错误，让调用者处理
  }
}

export const db = dbClient;
