# PIS 日志位置指南

> 最后更新: 2026-01-31

## 📋 概述

本文档详细说明了 PIS 项目中所有日志的位置和查看方法。

## 📍 日志位置

### 1. Docker 容器日志（推荐）

#### Web 容器日志

```bash
# 查看所有日志
docker logs pis-web

# 实时查看日志（跟随）
docker logs -f pis-web

# 查看最近 100 行
docker logs --tail 100 pis-web

# 查看最近 1 小时的日志
docker logs --since 1h pis-web

# 查看指定时间范围的日志
docker logs --since "2026-01-31T10:00:00" --until "2026-01-31T11:00:00" pis-web
```

#### Worker 容器日志

```bash
# 查看所有日志
docker logs pis-worker

# 实时查看日志（跟随）
docker logs -f pis-worker

# 查看最近 100 行
docker logs --tail 100 pis-worker

# 查看错误日志（过滤）
docker logs pis-worker 2>&1 | grep -i error
```

#### 其他容器日志

```bash
# PostgreSQL 日志
docker logs pis-postgres

# Redis 日志
docker logs pis-redis

# MinIO 日志
docker logs pis-minio
```

### 2. 应用日志文件（Worker 服务）

Worker 服务会将日志写入文件（如果启用）：

**容器内路径**:
- `/app/logs/worker.log` - 所有日志
- `/app/logs/worker-error.log` - 仅错误日志

**查看方法**:

```bash
# 查看 Worker 所有日志
docker exec pis-worker cat /app/logs/worker.log

# 查看 Worker 错误日志
docker exec pis-worker cat /app/logs/worker-error.log

# 实时查看 Worker 日志文件
docker exec pis-worker tail -f /app/logs/worker.log

# 查看最近 100 行
docker exec pis-worker tail -n 100 /app/logs/worker.log

# 搜索错误
docker exec pis-worker grep -i error /app/logs/worker.log
```

### 3. Docker 日志卷

Docker Compose 配置中定义了日志卷：

```yaml
volumes:
  pis_worker_logs:
    name: pis_worker_logs
  pis_web_logs:
    name: pis_web_logs
```

**查看日志卷位置**:

```bash
# 查看所有日志卷
docker volume ls | grep pis

# 查看日志卷详细信息
docker volume inspect pis_worker_logs
docker volume inspect pis_web_logs
```

**日志卷位置**（Docker Desktop）:
- macOS: `~/Library/Containers/com.docker.docker/Data/vms/0/data/docker/volumes/pis_worker_logs/_data`
- Linux: `/var/lib/docker/volumes/pis_worker_logs/_data`

### 4. 系统日志（如果配置了日志驱动）

如果配置了 Docker 日志驱动，日志可能存储在：

**JSON 文件日志驱动**:
- `/var/lib/docker/containers/<container-id>/<container-id>-json.log`

**查看方法**:

```bash
# 获取容器 ID
docker ps --format "{{.ID}} {{.Names}}" | grep pis-web
docker ps --format "{{.ID}} {{.Names}}" | grep pis-worker

# 查看 JSON 日志文件（需要 root 权限）
sudo cat /var/lib/docker/containers/<container-id>/<container-id>-json.log | jq
```

## 🔍 日志查看命令汇总

### 快速查看

```bash
# 查看所有容器日志
docker compose -f docker/docker-compose.standalone.yml logs

# 查看特定服务日志
docker compose -f docker/docker-compose.standalone.yml logs web
docker compose -f docker/docker-compose.standalone.yml logs worker

# 实时查看所有日志
docker compose -f docker/docker-compose.standalone.yml logs -f

# 查看最近 100 行
docker compose -f docker/docker-compose.standalone.yml logs --tail 100
```

### 过滤和搜索

```bash
# 查看错误日志
docker logs pis-web 2>&1 | grep -i error
docker logs pis-worker 2>&1 | grep -i error

# 查看警告日志
docker logs pis-web 2>&1 | grep -i warn
docker logs pis-worker 2>&1 | grep -i warn

# 查看特定关键词
docker logs pis-web 2>&1 | grep "login"
docker logs pis-worker 2>&1 | grep "photo"

# 查看 JSON 格式日志（如果使用 pino）
docker logs pis-worker 2>&1 | jq '.level >= 40'  # 仅错误和警告
```

### 日志统计

```bash
# 统计错误数量
docker logs pis-web 2>&1 | grep -i error | wc -l
docker logs pis-worker 2>&1 | grep -i error | wc -l

# 统计最近 1 小时的错误
docker logs --since 1h pis-web 2>&1 | grep -i error | wc -l

# 查看日志级别分布
docker logs pis-worker 2>&1 | jq -r '.level' | sort | uniq -c
```

## 📊 日志格式

### Web 服务日志格式

**开发环境**（格式化输出）:
```
[2026-01-31 11:00:00.000] INFO (12345 on pis-web): API 请求
    method: "POST"
    path: "/api/auth/login"
    statusCode: 200
```

**生产环境**（JSON 格式）:
```json
{
  "level": 30,
  "time": 1704067200000,
  "pid": 12345,
  "hostname": "pis-web",
  "service": "pis-web",
  "msg": "API 请求",
  "method": "POST",
  "path": "/api/auth/login",
  "statusCode": 200
}
```

### Worker 服务日志格式

**开发环境**（格式化输出）:
```
[2026-01-31 11:00:00.000] INFO (12345 on pis-worker): 开始处理照片
    photoId: "123"
    albumId: "456"
```

**生产环境**（JSON 格式）:
```json
{
  "level": 30,
  "time": 1704067200000,
  "pid": 12345,
  "hostname": "pis-worker",
  "service": "pis-worker",
  "msg": "开始处理照片",
  "photoId": "123",
  "albumId": "456"
}
```

## 🛠️ 日志管理

### 清理日志

```bash
# 清理 Docker 日志（注意：这会删除所有日志）
docker system prune -a --volumes

# 清理特定容器的日志（需要停止容器）
docker stop pis-web pis-worker
docker rm pis-web pis-worker
docker volume rm pis_web_logs pis_worker_logs
```

### 日志轮转

**使用 Docker 日志驱动**（推荐）:

在 `docker-compose.standalone.yml` 中添加：

```yaml
services:
  web:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  worker:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**使用 logrotate**（Linux）:

创建 `/etc/logrotate.d/pis`:

```
/var/lib/docker/containers/*/*-json.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        docker kill --signal="USR1" pis-web pis-worker 2>/dev/null || true
    endscript
}
```

## 📝 日志级别配置

### 环境变量

在 `.env` 文件中配置：

```bash
# Worker 服务日志级别
LOG_LEVEL=info  # trace, debug, info, warn, error, fatal

# Web 服务日志级别
LOG_LEVEL=info

# 是否启用文件日志（Worker）
ENABLE_FILE_LOG=true

# 是否启用彩色输出
ENABLE_PRETTY_LOG=false
```

### 动态调整（需要重启容器）

```bash
# 修改环境变量后重启
docker compose -f docker/docker-compose.standalone.yml restart web worker
```

## 🔍 常见日志查看场景

### 1. 查看启动日志

```bash
# 查看容器启动日志
docker logs pis-web --since 5m
docker logs pis-worker --since 5m
```

### 2. 查看错误日志

```bash
# 查看所有错误
docker logs pis-web 2>&1 | grep -i error
docker logs pis-worker 2>&1 | grep -i error

# 查看 Worker 错误日志文件
docker exec pis-worker cat /app/logs/worker-error.log
```

### 3. 查看 API 请求日志

```bash
# 查看 Web 服务的 API 请求
docker logs pis-web 2>&1 | grep "API\|POST\|GET"

# 查看登录相关日志
docker logs pis-web 2>&1 | grep -i login
```

### 4. 查看图片处理日志

```bash
# 查看 Worker 图片处理日志
docker logs pis-worker 2>&1 | grep -i "photo\|process\|image"

# 查看处理失败的日志
docker logs pis-worker 2>&1 | grep -i "failed\|error" | grep -i photo
```

### 5. 实时监控日志

```bash
# 实时查看所有服务日志
docker compose -f docker/docker-compose.standalone.yml logs -f

# 实时查看特定服务
docker logs -f pis-web
docker logs -f pis-worker

# 实时查看并过滤错误
docker logs -f pis-worker 2>&1 | grep --line-buffered -i error
```

## 📊 日志分析工具

### 使用 jq 分析 JSON 日志

```bash
# 安装 jq（如果未安装）
# macOS: brew install jq
# Linux: apt-get install jq

# 查看错误日志
docker logs pis-worker 2>&1 | jq 'select(.level >= 40)'

# 统计日志级别
docker logs pis-worker 2>&1 | jq -r '.level' | sort | uniq -c

# 查看特定时间段的日志
docker logs --since 1h pis-worker 2>&1 | jq 'select(.time > 1704067200000)'
```

### 使用 grep 搜索

```bash
# 搜索特定用户的操作
docker logs pis-web 2>&1 | grep "userId.*123"

# 搜索特定照片的处理
docker logs pis-worker 2>&1 | grep "photoId.*abc-123"

# 搜索特定相册的操作
docker logs pis-web 2>&1 | grep "albumId.*xyz-456"
```

## ✅ 总结

### 日志位置汇总

| 服务 | 日志位置 | 查看方法 |
|------|---------|---------|
| Web | Docker 日志 | `docker logs pis-web` |
| Worker | Docker 日志 + 文件 | `docker logs pis-worker`<br>`docker exec pis-worker cat /app/logs/worker.log` |
| PostgreSQL | Docker 日志 | `docker logs pis-postgres` |
| Redis | Docker 日志 | `docker logs pis-redis` |
| MinIO | Docker 日志 | `docker logs pis-minio` |

### 推荐查看方式

1. **日常查看**: 使用 `docker logs` 命令
2. **实时监控**: 使用 `docker logs -f`
3. **错误排查**: 使用 `docker logs` + `grep` 过滤
4. **日志分析**: 使用 `docker logs` + `jq` 分析 JSON 格式

---

**相关文档**:
- [日志系统文档](./LOGGING.md) - 日志配置和使用方法
- [Docker 部署文档](./DOCKER_CONTAINERS_AND_VOLUMES.md) - 容器和卷说明
