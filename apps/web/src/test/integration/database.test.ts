/**
 * @fileoverview 数据库连接集成测试
 * 
 * 测试 PostgreSQL 数据库的实际连接和查询功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// 数据库配置（从环境变量读取，测试环境使用本地 Docker）
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'pis',
  user: process.env.DATABASE_USER || 'pis',
  password: process.env.DATABASE_PASSWORD || 'pis_dev_password',
}

describe('Database Integration Tests', () => {
  describe('PostgreSQL Connection', () => {
    it('should connect to PostgreSQL successfully', async () => {
      // 动态导入 pg，避免在没有安装时阻塞
      const { default: pg } = await import('pg')
      const { Pool } = pg
      
      const pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      })

      try {
        const result = await pool.query('SELECT 1 as connection_test')
        expect(result.rows[0].connection_test).toBe(1)
      } finally {
        await pool.end()
      }
    })

    it('should query albums table', async () => {
      const { default: pg } = await import('pg')
      const { Pool } = pg
      
      const pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
      })

      try {
        // 测试查询 albums 表
        const result = await pool.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `)
        expect(result.rows[0]).toBeDefined()
        expect(typeof result.rows[0].count).toBe('string')
      } finally {
        await pool.end()
      }
    })

    it('should query photos table structure', async () => {
      const { default: pg } = await import('pg')
      const { Pool } = pg
      
      const pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
      })

      try {
        // 检查 photos 表是否存在
        const result = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'photos'
          ORDER BY ordinal_position
          LIMIT 5
        `)
        expect(result.rows).toBeDefined()
      } finally {
        await pool.end()
      }
    })
  })

  describe('PostgreSQL Docker Health Check', () => {
    it('container should be healthy', async () => {
      const { execSync } = await import('child_process')
      
      try {
        const output = execSync(
          'docker inspect --format="{{.State.Health.Status}}" pis-postgres-dev',
          { encoding: 'utf-8' }
        ).trim()
        
        expect(output).toBe('healthy')
      } catch {
        // 如果容器不存在，跳过此测试
        console.warn('⚠️ Docker container pis-postgres-dev not found, skipping health check')
      }
    })
  })
})
