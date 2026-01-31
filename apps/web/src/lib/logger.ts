/**
 * PIS Web - 结构化日志工具
 * 
 * 使用 pino 提供高性能的结构化日志
 * 注意：Next.js 环境中，日志主要输出到控制台
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import pino from 'pino';

// 日志级别（从环境变量读取，默认 info）
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase() as pino.Level;

// 是否启用彩色输出（开发环境默认启用）
const ENABLE_PRETTY = process.env.NODE_ENV === 'development' || process.env.ENABLE_PRETTY_LOG === 'true';

// 创建 logger 实例
const logger = pino(
  {
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
  }
);

// 导出 logger
export default logger;

// 导出便捷方法
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  fatal: logger.fatal.bind(logger),
};

// 导出 logger 实例（用于高级用法）
export { logger };
