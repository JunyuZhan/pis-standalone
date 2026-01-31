# PIS 日志系统文档

## 概述

PIS 使用 [pino](https://getpino.io/) 作为结构化日志库，提供高性能的日志记录功能。

## 日志级别

支持的日志级别（从低到高）：
- `trace` - 最详细的调试信息
- `debug` - 调试信息
- `info` - 一般信息（默认）
- `warn` - 警告信息
- `error` - 错误信息
- `fatal` - 致命错误

## 环境变量配置

### Worker 服务

```bash
# 日志级别（默认：info）
LOG_LEVEL=info

# 日志目录（默认：logs）
LOG_DIR=logs

# 是否启用文件日志（默认：true）
ENABLE_FILE_LOG=true

# 是否启用彩色输出（默认：false，开发环境自动启用）
ENABLE_PRETTY_LOG=false
```

### Web 服务

```bash
# 日志级别（默认：info）
LOG_LEVEL=info

# 是否启用彩色输出（默认：false，开发环境自动启用）
ENABLE_PRETTY_LOG=false
```

## 使用方法

### Worker 服务

```typescript
import logger from './lib/logger.js';

// 基本用法
logger.info('服务启动成功');
logger.error({ err }, '处理失败');

// 带上下文的日志
logger.info({ photoId: '123', albumId: '456' }, '开始处理照片');

// 错误日志
logger.error({ err, photoId: '123' }, '照片处理失败');
```

### Web 服务

```typescript
import logger from '@/lib/logger';

// 基本用法
logger.info('API 请求');
logger.error({ err }, 'API 错误');

// 带上下文的日志
logger.info({ userId: '123', action: 'login' }, '用户登录');
```

## 日志输出

### Worker 服务

**控制台输出**：
- 开发环境：彩色格式化输出（使用 pino-pretty）
- 生产环境：JSON 格式输出

**文件输出**（生产环境）：
- `logs/worker.log` - 所有日志
- `logs/worker-error.log` - 仅错误日志

### Web 服务

**控制台输出**：
- 开发环境：彩色格式化输出（使用 pino-pretty）
- 生产环境：JSON 格式输出

## Docker 部署

### 日志卷

Docker Compose 配置中已包含日志卷：

```yaml
volumes:
  pis_worker_logs:
    name: pis_worker_logs
  pis_web_logs:
    name: pis_web_logs
```

### 查看日志

```bash
# 查看 Worker 日志
docker exec pis-worker cat /app/logs/worker.log

# 查看 Worker 错误日志
docker exec pis-worker cat /app/logs/worker-error.log

# 实时查看日志
docker logs -f pis-worker
docker logs -f pis-web
```

### 日志轮转

建议使用 `logrotate` 或 Docker 日志驱动进行日志轮转：

```bash
# 使用 Docker 日志驱动
docker run --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  ...
```

## 日志格式

### JSON 格式（生产环境）

```json
{
  "level": 30,
  "time": 1704067200000,
  "pid": 12345,
  "hostname": "server-01",
  "service": "pis-worker",
  "msg": "开始处理照片",
  "photoId": "123",
  "albumId": "456"
}
```

### 格式化输出（开发环境）

```
[2024-01-01 12:00:00.000] INFO (12345 on server-01): 开始处理照片
    photoId: "123"
    albumId: "456"
```

## 最佳实践

1. **使用结构化日志**：使用对象传递上下文信息
   ```typescript
   // ✅ 好
   logger.info({ userId, action: 'login' }, '用户登录');
   
   // ❌ 不好
   logger.info(`用户 ${userId} 登录`);
   ```

2. **错误日志包含堆栈**：使用 `err` 字段传递错误对象
   ```typescript
   // ✅ 好
   logger.error({ err, photoId }, '处理失败');
   
   // ❌ 不好
   logger.error(`处理失败: ${err.message}`);
   ```

3. **使用合适的日志级别**：
   - `debug` - 详细的调试信息
   - `info` - 一般操作信息
   - `warn` - 警告信息（不影响功能）
   - `error` - 错误信息（影响功能）
   - `fatal` - 致命错误（服务无法继续）

4. **避免敏感信息**：不要在日志中记录密码、密钥等敏感信息

## 性能

pino 是一个高性能的日志库：
- 异步写入，不阻塞主线程
- JSON 序列化性能优异
- 支持日志级别过滤，减少不必要的序列化

## 相关文档

- [pino 官方文档](https://getpino.io/)
- [环境变量配置](./ENVIRONMENT_VARIABLES.md)
- [Docker 部署](./i18n/zh-CN/DEPLOYMENT.md)
