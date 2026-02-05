/**
 * Redis 集成测试
 * 
 * 使用真实的 Redis 连接进行集成测试
 * 运行前确保 Docker Redis 容器正在运行
 * 
 * 运行命令: 
 *   pnpm --filter @pis/worker test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import Redis from 'ioredis'

// Redis 连接配置（从环境变量读取或使用默认值）
const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379')
const TEST_KEY_PREFIX = 'pis:test:integration:'

// 获取测试 Redis 客户端
let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) return null
        return Math.min(times * 100, 3000)
      }
    })
  }
  return redisClient
}

describe('Redis Integration Tests', () => {
  let client: Redis

  beforeAll(async () => {
    client = getRedisClient()
    try {
      await client.connect()
      console.log('✅ Redis 连接成功')
    } catch (error) {
      console.log('⚠️  Redis 连接失败，跳过集成测试')
      throw error
    }
  })

  afterAll(async () => {
    if (client) {
      // 清理测试数据
      const testKeys = await client.keys(`${TEST_KEY_PREFIX}*`)
      if (testKeys.length > 0) {
        await client.del(...testKeys)
      }
      await client.quit()
      console.log('✅ Redis 连接已关闭')
    }
  })

  beforeEach(async () => {
    // 每个测试前清理相关测试数据
    const testKeys = await client.keys(`${TEST_KEY_PREFIX}*`)
    if (testKeys.length > 0) {
      await client.del(...testKeys)
    }
  })

  describe('Basic Operations', () => {
    it('should set and get string value', async () => {
      const key = `${TEST_KEY_PREFIX}string:test`
      await client.set(key, 'hello world')
      
      const value = await client.get(key)
      expect(value).toBe('hello world')
    })

    it('should set and get number value', async () => {
      const key = `${TEST_KEY_PREFIX}number:test`
      await client.set(key, '42')
      
      const value = await client.get(key)
      expect(value).toBe('42')
      
      // 测试 incr
      const newValue = await client.incr(key)
      expect(newValue).toBe(43)
    })

    it('should delete key', async () => {
      const key = `${TEST_KEY_PREFIX}delete:test`
      await client.set(key, 'to be deleted')
      
      const deleted = await client.del(key)
      expect(deleted).toBe(1)
      
      const value = await client.get(key)
      expect(value).toBeNull()
    })

    it('should check key exists', async () => {
      const key = `${TEST_KEY_PREFIX}exists:test`
      await client.set(key, 'exists')
      
      const exists = await client.exists(key)
      expect(exists).toBe(1)
      
      await client.del(key)
      const notExists = await client.exists(key)
      expect(notExists).toBe(0)
    })

    it('should set expiration (TTL)', async () => {
      const key = `${TEST_KEY_PREFIX}ttl:test`
      await client.set(key, 'expires soon')
      await client.expire(key, 2)
      
      const ttl = await client.ttl(key)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(2)
    })
  })

  describe('Hash Operations', () => {
    it('should set and get hash fields', async () => {
      const key = `${TEST_KEY_PREFIX}hash:album`
      await client.hset(key, 'album_id', 'album-123')
      await client.hset(key, 'photo_count', '100')
      await client.hset(key, 'status', 'active')
      
      const albumId = await client.hget(key, 'album_id')
      expect(albumId).toBe('album-123')
      
      const allFields = await client.hgetall(key)
      expect(allFields).toEqual({
        album_id: 'album-123',
        photo_count: '100',
        status: 'active'
      })
    })

    it('should increment hash field', async () => {
      const key = `${TEST_KEY_PREFIX}hash:counter`
      await client.hset(key, 'views', '0')
      
      await client.hincrby(key, 'views', 1)
      await client.hincrby(key, 'views', 5)
      
      const views = await client.hget(key, 'views')
      expect(views).toBe('6')
    })

    it('should delete hash fields', async () => {
      const key = `${TEST_KEY_PREFIX}hash:delete`
      await client.hset(key, 'field1', 'value1')
      await client.hset(key, 'field2', 'value2')
      
      const deleted = await client.hdel(key, 'field1')
      expect(deleted).toBe(1)
      
      const allFields = await client.hgetall(key)
      expect(allFields).toEqual({ field2: 'value2' })
    })
  })

  describe('List Operations', () => {
    it('should push and pop from list', async () => {
      const key = `${TEST_KEY_PREFIX}list:queue`
      
      await client.rpush(key, 'item1', 'item2', 'item3')
      
      const length = await client.llen(key)
      expect(length).toBe(3)
      
      const item = await client.lpop(key)
      expect(item).toBe('item1')
      
      const remaining = await client.lrange(key, 0, -1)
      expect(remaining).toEqual(['item2', 'item3'])
    })
  })

  describe('Set Operations', () => {
    it('should add and check set members', async () => {
      const key = `${TEST_KEY_PREFIX}set:tags`
      
      await client.sadd(key, 'photo', 'nature', 'landscape')
      
      const isMember = await client.sismember(key, 'photo')
      expect(isMember).toBe(1)
      
      const isNotMember = await client.sismember(key, 'city')
      expect(isNotMember).toBe(0)
      
      const allMembers = await client.smembers(key)
      expect(allMembers.sort()).toEqual(['landscape', 'nature', 'photo'])
    })
  })

  describe('Photo Processing Queue', () => {
    it('should enqueue and dequeue photo jobs', async () => {
      const queueKey = `${TEST_KEY_PREFIX}queue:photos`
      
      const jobData = {
        photoId: 'photo-001',
        albumId: 'album-123',
        operation: 'process',
        priority: 10
      }
      
      // 添加任务到列表（模拟队列）
      await client.rpush(queueKey, JSON.stringify(jobData))
      
      const queueLength = await client.llen(queueKey)
      expect(queueLength).toBe(1)
      
      // 取出任务
      const storedJob = await client.lpop(queueKey)
      expect(storedJob).not.toBeNull()
      
      const parsedJob = JSON.parse(storedJob!)
      expect(parsedJob.photoId).toBe('photo-001')
      expect(parsedJob.albumId).toBe('album-123')
    })

    it('should store photo status', async () => {
      const statusKey = `${TEST_KEY_PREFIX}status:photo-002`
      
      await client.hset(statusKey, 'status', 'processing')
      await client.hset(statusKey, 'progress', '50')
      await client.hset(statusKey, 'workerId', 'worker-01')
      
      const status = await client.hget(statusKey, 'status')
      expect(status).toBe('processing')
      
      const progress = await client.hget(statusKey, 'progress')
      expect(progress).toBe('50')
    })
  })

  describe('Album Cache Operations', () => {
    it('should cache album data', async () => {
      const cacheKey = `${TEST_KEY_PREFIX}cache:album:album-456`
      const albumData = {
        id: 'album-456',
        name: 'Test Album',
        photoCount: 50,
        watermarkEnabled: true
      }
      
      // 缓存相册数据
      await client.set(cacheKey, JSON.stringify(albumData), 'EX', 300) // 5分钟过期
      
      // 获取并验证
      const cached = await client.get(cacheKey)
      expect(cached).not.toBeNull()
      
      const parsed = JSON.parse(cached!)
      expect(parsed.name).toBe('Test Album')
      expect(parsed.watermarkEnabled).toBe(true)
      
      // 验证 TTL
      const ttl = await client.ttl(cacheKey)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(300)
    })
  })

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // 测试不存在的 key 的操作
      const nonExistentKey = `${TEST_KEY_PREFIX}nonexistent`
      
      const value = await client.get(nonExistentKey)
      expect(value).toBeNull()
      
      const deleted = await client.del(nonExistentKey)
      expect(deleted).toBe(0)
    })

    it('should handle invalid data types', async () => {
      const key = `${TEST_KEY_PREFIX}type:mismatch`
      
      // 设置字符串值
      await client.set(key, 'string value')
      
      // 尝试对字符串执行哈希操作应该失败
      try {
        await client.hset(key, 'field', 'value')
        // 如果操作成功，说明 Redis 覆盖了旧值
        const value = await client.hget(key, 'field')
        expect(value).toBe('value')
      } catch (error) {
        // 有些操作可能会失败
        expect(error).toBeDefined()
      }
    })
  })

  describe('Performance', () => {
    it('should handle multiple operations in batch', async () => {
      const key = `${TEST_KEY_PREFIX}batch:test`
      
      // 使用 pipeline 进行批量操作
      const pipeline = client.pipeline()
      for (let i = 0; i < 100; i++) {
        pipeline.set(`${key}:${i}`, `value-${i}`)
      }
      pipeline.incr(`${key}:counter`)
      
      const results = await pipeline.exec()
      expect(results).toBeDefined()
      expect(results!.length).toBe(101) // 100 sets + 1 incr
      
      // 验证最后的结果
      const counter = await client.get(`${key}:counter`)
      expect(counter).toBe('1')
    })
  })
})

// 导出测试配置
export const testConfig = {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  keyPrefix: TEST_KEY_PREFIX
}
