/**
 * PIS Worker - 结构化日志工具
 * 
 * 使用 pino 提供高性能的结构化日志
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import pino from 'pino';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 日志级别（从环境变量读取，默认 info）
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase() as pino.Level;

// 日志目录（从环境变量读取，默认 logs）
// 支持绝对路径和相对路径
const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), 'logs');

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    console.warn(`Failed to create log directory: ${LOG_DIR}`, err);
  }
}

// 日志文件路径
const LOG_FILE = join(LOG_DIR, 'worker.log');
const ERROR_LOG_FILE = join(LOG_DIR, 'worker-error.log');

// 是否启用文件日志（默认启用）
const ENABLE_FILE_LOG = process.env.ENABLE_FILE_LOG !== 'false';

// 是否启用彩色输出（开发环境默认启用）
const ENABLE_PRETTY = process.env.NODE_ENV === 'development' || process.env.ENABLE_PRETTY_LOG === 'true';

// 创建日志传输流
const streams: Array<{ level: pino.Level; stream: pino.DestinationStream }> = [
  // 控制台输出
  {
    level: LOG_LEVEL,
    stream: ENABLE_PRETTY
      ? pino.destination({
          dest: 1, // stdout
          sync: false,
        })
      : pino.destination({
          dest: 1, // stdout
          sync: false,
        }),
  },
];

// 文件日志（生产环境）
if (ENABLE_FILE_LOG) {
  try {
    // 所有日志
    streams.push({
      level: LOG_LEVEL,
      stream: pino.destination({
        dest: LOG_FILE,
        sync: false,
        mkdir: true,
      }),
    });

    // 错误日志（单独文件）
    streams.push({
      level: 'error',
      stream: pino.destination({
        dest: ERROR_LOG_FILE,
        sync: false,
        mkdir: true,
      }),
    });
  } catch (err) {
    console.warn('Failed to create log file streams:', err);
  }
}

// 创建 logger 实例
const logger = pino(
  {
    level: LOG_LEVEL,
    // 基础配置
    base: {
      service: 'pis-worker',
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
  },
  pino.multistream(streams)
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
