/**
 * @fileoverview Redis/BullMQ 队列配置
 *
 * 配置 BullMQ 任务队列，用于异步处理照片上传和处理任务。
 * 包含队列定义、连接配置和事件监听。
 *
 * @module lib/redis
 *
 * @example
 * ```typescript
 * import { photoQueue, QUEUE_NAME } from '@/lib/redis'
 *
 * // 添加任务到队列
 * await photoQueue.add('process-photo', {
 *   photoId: 'abc-123',
 *   albumId: 'album-456'
 * })
 * ```
 */

import { Queue, Worker, QueueEvents, type ConnectionOptions } from 'bullmq'

/**
 * Redis 连接配置
 *
 * @description
 * 从环境变量读取 Redis 连接信息：
 * - REDIS_HOST: Redis 主机（默认 localhost）
 * - REDIS_PORT: Redis 端口（默认 6379）
 * - REDIS_PASSWORD: Redis 密码
 *
 * 包含指数退避重试策略和连接超时设置。
 */
const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  // BullMQ 要求 maxRetriesPerRequest 必须是 null
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    // 指数退避，最多等待 30 秒
    const delay = Math.min(times * 50, 30000)
    return delay
  },
  // 连接超时
  connectTimeout: 10000,
  // 启用离线队列（连接断开时缓存命令）
  enableOfflineQueue: false,
}

/** 任务队列名称 */
export const QUEUE_NAME = 'photo-processing'

/**
 * 照片处理任务队列
 *
 * @description
 * BullMQ 队列实例，用于管理照片处理任务。
 *
 * 默认任务选项：
 * - 失败重试 3 次
 * - 指数退避延迟
 * - 成功任务保留 24 小时（最多 1000 个）
 * - 失败任务保留 7 天
 */
export const photoQueue = new Queue(QUEUE_NAME, {
  connection,
  // 添加默认作业选项，避免连接错误时崩溃
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // 保留 24 小时
      count: 1000, // 最多保留 1000 个
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 失败任务保留 7 天
    },
  },
})

/**
 * 队列事件监听器
 *
 * @description
 * 监听队列事件，如任务完成、失败等。
 */
export const queueEvents = new QueueEvents(QUEUE_NAME, { connection })

// ============================================
// 错误处理
// ============================================

/** 上次错误时间（用于抑制重复日志） */
let lastErrorTime = 0
/** 错误日志间隔（30 秒） */
const ERROR_LOG_INTERVAL = 30000

/**
 * 队列连接错误处理
 *
 * @description
 * 抑制重复错误日志，每 30 秒只记录一次。
 */
photoQueue.on('error', (error) => {
  const now = Date.now()
  if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
    console.error('⚠️ Redis connection error:', error.message)
    console.error(
      '   This error will be suppressed for 30 seconds to reduce log spam'
    )
    console.error('   Please check Redis connection:', {
      host: connection.host,
      port: connection.port,
      hasPassword: !!connection.password,
    })
    lastErrorTime = now
  }
})

/**
 * 队列事件监听器错误处理
 */
queueEvents.on('error', (error) => {
  const now = Date.now()
  if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
    console.error('⚠️ Redis QueueEvents error:', error.message)
    lastErrorTime = now
  }
})

/** 导出 Redis 连接配置供其他模块使用 */
export { connection }
