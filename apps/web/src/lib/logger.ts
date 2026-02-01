/**
 * PIS Web - 结构化日志工具
 *
 * 使用 pino 提供高性能的结构化日志
 * 注意：Next.js 环境中，日志主要输出到控制台
 *
 * @author PIS Contributors
 * @license MIT
 *
 * @example
 * ```typescript
 * import logger from '@/lib/logger'
 *
 * logger.info({ userId: '123' }, 'User logged in')
 * logger.error({ err: error }, 'Operation failed')
 *
 * // 或使用便捷方法
 * import { log } from '@/lib/logger'
 * log.info('Simple info message')
 * ```
 */
import pino from 'pino'

/** 日志级别（从环境变量读取，默认 info） */
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase() as pino.Level

/** 是否启用彩色输出（开发环境默认启用） */
const ENABLE_PRETTY = process.env.NODE_ENV === 'development' || process.env.ENABLE_PRETTY_LOG === 'true'

/**
 * 创建 Pino Logger 实例
 *
 * @description
 * - 生产环境：JSON 格式输出
 * - 开发环境：彩色格式化输出
 */
const logger = pino({
  level: LOG_LEVEL,
  // 基础配置
  base: {
    service: 'pis-web',
    pid: process.pid,
  },
  // 时间戳格式
  timestamp: pino.stdTimeFunctions.isoTime,
  // 序列化配置
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // 格式化配置（开发环境）
  ...(ENABLE_PRETTY && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),
})

// 导出默认 logger 实例
export default logger

/**
 * 便捷日志方法
 *
 * @description
 * 提供简化版的日志方法，直接绑定到 logger 实例
 *
 * @example
 * ```typescript
 * import { log } from '@/lib/logger'
 *
 * log.debug('Debug message')
 * log.info('Info message')
 * log.warn('Warning message')
 * log.error('Error message')
 * log.fatal('Fatal message')
 * ```
 */
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  fatal: logger.fatal.bind(logger),
}

/**
 * Logger 类型定义
 *
 * @description
 * Pino Logger 的类型，用于类型注解
 */
export type Logger = typeof logger

/** 导出 logger 实例（用于高级用法） */
export { logger }
