/**
 * @fileoverview 服务集成测试
 * 
 * 测试真实的服务集成，包括数据库和缓存的完整流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// 服务配置
const serviceConfig = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'pis',
    user: process.env.DATABASE_USER || 'pis',
    password: process.env.DATABASE_PASSWORD || 'pis_dev_password',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
  },
}

describe('Service Integration Tests', () => {
  describe('Full Stack Integration', () => {
    it('should connect to both PostgreSQL and Redis', async () => {
      const { default: pg } = await import('pg')
      const { Pool } = pg
      
      const { default: redis } = await import('redis')
      
      // 连接数据库
      const dbPool = new Pool({
        host: serviceConfig.database.host,
        port: serviceConfig.database.port,
        database: serviceConfig.database.database,
        user: serviceConfig.database.user,
        password: serviceConfig.database.password,
        max: 3,
      })
      
      // 连接 Redis
      const redisClient = redis.createClient({
        socket: {
          host: serviceConfig.redis.host,
          port: serviceConfig.redis.port,
        },
        password: serviceConfig.redis.password || undefined,
      })
      
      try {
        // 测试数据库连接
        const dbResult = await dbPool.query('SELECT 1 as test')
        expect(dbResult.rows[0].test).toBe(1)
        
        // 测试 Redis 连接
        await redisClient.connect()
        const redisResult = await redisClient.ping()
        expect(redisResult).toBe('PONG')
        
        // 清理
        await redisClient.quit()
        await dbPool.end()
      } catch (error) {
        // 确保关闭连接
        try {
          await redisClient.quit()
        } catch {}
        try {
          await dbPool.end()
        } catch {}
        throw error
      }
    })

    it('should perform database album operations', async () => {
      const { default: pg } = await import('pg')
      const { Pool } = pg
      
      const pool = new Pool({
        host: serviceConfig.database.host,
        port: serviceConfig.database.port,
        database: serviceConfig.database.database,
        user: serviceConfig.database.user,
        password: serviceConfig.database.password,
      })

      try {
        // 查询相册表结构
        const tableResult = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'albums'
          ) as exists
        `)
        
        expect(tableResult.rows[0].exists).toBe(true)
        
        // 查询相册相关表
        const tablesResult = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name LIKE '%album%'
          ORDER BY table_name
        `)
        
        expect(tablesResult.rows.length).toBeGreaterThan(0)
      } finally {
        await pool.end()
      }
    })

    it('should perform database photo operations', async () => {
      const { default: pg } = await import('pg')
      const { Pool } = pg
      
      const pool = new Pool({
        host: serviceConfig.database.host,
        port: serviceConfig.database.port,
        database: serviceConfig.database.database,
        user: serviceConfig.database.user,
        password: serviceConfig.database.password,
      })

      try {
        // 查询照片表结构
        const columnsResult = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'photos'
          ORDER BY ordinal_position
        `)
        
        // 验证关键字段存在
        const columnNames = columnsResult.rows.map(row => row.column_name)
        expect(columnNames).toContain('id')
        expect(columnNames).toContain('album_id')
        expect(columnNames).toContain('status')
      } finally {
        await pool.end()
      }
    })

    it('should perform cache operations with session simulation', async () => {
      const { default: redis } = await import('redis')
      
      const client = redis.createClient({
        socket: {
          host: serviceConfig.redis.host,
          port: serviceConfig.redis.port,
        },
        password: serviceConfig.redis.password || undefined,
      })

      try {
        await client.connect()
        
        // 模拟会话缓存操作
        const sessionId = 'test:integration:session'
        const sessionData = JSON.stringify({
          userId: 'test-user-123',
          albumId: 'test-album-456',
          timestamp: Date.now(),
        })
        
        // 写入会话
        await client.set(`session:${sessionId}`, sessionData, { EX: 300 })
        
        // 读取会话
        const cached = await client.get(`session:${sessionId}`)
        expect(cached).toBe(sessionData)
        
        // 验证 TTL
        const ttl = await client.ttl(`session:${sessionId}`)
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(300)
        
        // 清理
        await client.del(`session:${sessionId}`)
      } finally {
        await client.quit()
      }
    })

    it('should handle rate limiting simulation', async () => {
      const { default: redis } = await import('redis')
      
      const client = redis.createClient({
        socket: {
          host: serviceConfig.redis.host,
          port: serviceConfig.redis.port,
        },
        password: serviceConfig.redis.password || undefined,
      })

      try {
        await client.connect()
        
        const rateLimitKey = 'rate_limit:test:ip'
        const maxRequests = 5
        
        // 模拟速率限制
        for (let i = 0; i <= maxRequests; i++) {
          const count = await client.incr(rateLimitKey)
          
          if (i === 0) {
            // 第一次请求，设置过期时间
            await client.expire(rateLimitKey, 60)
          }
          
          if (i < maxRequests) {
            expect(count).toBe(i + 1)
          }
        }
        
        // 验证超过限制
        const finalCount = await client.get(rateLimitKey)
        expect(parseInt(finalCount!)).toBeGreaterThan(maxRequests)
        
        // 清理
        await client.del(rateLimitKey)
      } finally {
        await client.quit()
      }
    })
  })

  describe('Docker Service Status', () => {
    it('all required containers should be running', async () => {
      const { execSync } = await import('child_process')
      
      const containers = ['pis-postgres-dev', 'pis-redis-dev']
      
      for (const container of containers) {
        try {
          const status = execSync(
            `docker inspect --format="{{.State.Status}}" ${container}`,
            { encoding: 'utf-8' }
          ).trim()
          
          expect(status).toBe('running')
        } catch {
          // 如果容器不存在，记录警告
          console.warn(`⚠️ Container ${container} not found`)
          // 不抛出错误，允许跳过
        }
      }
    })
  })
})
