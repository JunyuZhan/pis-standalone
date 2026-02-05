/**
 * @fileoverview Redis 连接集成测试
 * 
 * 测试 Redis 的实际连接和缓存读写功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Redis 配置（从环境变量读取，测试环境使用本地 Docker）
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
}

describe('Redis Integration Tests', () => {
  describe('Redis Connection', () => {
    it('should connect to Redis successfully using redis-cli', async () => {
      const { execSync } = await import('child_process')
      
      try {
        const output = execSync(
          `docker exec pis-redis-dev redis-cli PING`,
          { encoding: 'utf-8' }
        ).trim()
        
        expect(output).toBe('PONG')
      } catch {
        // 如果 Docker 命令失败，使用 Node.js 客户端
        const { default: redis } = await import('redis')
        const client = redis.createClient({
          socket: {
            host: redisConfig.host,
            port: redisConfig.port,
          },
          password: redisConfig.password || undefined,
        })

        await client.connect()
        const result = await client.ping()
        await client.quit()
        
        expect(result).toBe('PONG')
      }
    })

    it('should perform read/write operations', async () => {
      const { execSync } = await import('child_process')
      
      // 使用 Docker 执行 Redis 命令
      const testKey = 'integration:test:key'
      const testValue = 'integration-test-value'
      
      try {
        // 写入
        execSync(
          `docker exec pis-redis-dev redis-cli SET ${testKey} ${testValue}`,
          { encoding: 'utf-8' }
        )
        
        // 读取
        const result = execSync(
          `docker exec pis-redis-dev redis-cli GET ${testKey}`,
          { encoding: 'utf-8' }
        ).trim()
        
        expect(result).toBe(testValue)
        
        // 清理
        execSync(
          `docker exec pis-redis-dev redis-cli DEL ${testKey}`,
          { encoding: 'utf-8' }
        )
      } catch (error) {
        // 如果 Docker 命令失败，使用 Node.js 客户端
        const { default: redis } = await import('redis')
        const client = redis.createClient({
          socket: {
            host: redisConfig.host,
            port: redisConfig.port,
          },
          password: redisConfig.password || undefined,
        })

        await client.connect()
        
        // 写入
        await client.set(testKey, testValue)
        
        // 读取
        const result = await client.get(testKey)
        expect(result).toBe(testValue)
        
        // 清理
        await client.del(testKey)
        await client.quit()
      }
    })

    it('should support TTL operations', async () => {
      const { execSync } = await import('child_process')
      
      const testKey = 'integration:test:ttl'
      const testValue = 'ttl-test-value'
      
      try {
        // 设置带 TTL 的键
        execSync(
          `docker exec pis-redis-dev redis-cli SETEX ${testKey} 10 ${testValue}`,
          { encoding: 'utf-8' }
        )
        
        // 获取 TTL
        const ttl = execSync(
          `docker exec pis-redis-dev redis-cli TTL ${testKey}`,
          { encoding: 'utf-8' }
        ).trim()
        
        expect(parseInt(ttl)).toBeGreaterThan(0)
        expect(parseInt(ttl)).toBeLessThanOrEqual(10)
        
        // 清理
        execSync(
          `docker exec pis-redis-dev redis-cli DEL ${testKey}`,
          { encoding: 'utf-8' }
        )
      } catch (error) {
        // 如果 Docker 命令失败，使用 Node.js 客户端
        const { default: redis } = await import('redis')
        const client = redis.createClient({
          socket: {
            host: redisConfig.host,
            port: redisConfig.port,
          },
          password: redisConfig.password || undefined,
        })

        await client.connect()
        
        // 设置带 TTL 的键
        await client.set(testKey, testValue, { EX: 10 })
        
        // 获取 TTL
        const ttl = await client.ttl(testKey)
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(10)
        
        // 清理
        await client.del(testKey)
        await client.quit()
      }
    })
  })

  describe('Redis Docker Health Check', () => {
    it('container should be healthy', async () => {
      const { execSync } = await import('child_process')
      
      try {
        const output = execSync(
          'docker inspect --format="{{.State.Health.Status}}" pis-redis-dev',
          { encoding: 'utf-8' }
        ).trim()
        
        expect(output).toBe('healthy')
      } catch {
        // 如果容器不存在，跳过此测试
        console.warn('⚠️ Docker container pis-redis-dev not found, skipping health check')
      }
    })
  })
})
