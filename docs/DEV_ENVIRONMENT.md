# 🚀 开发环境快速启动指南

> 无需每次构建容器，快速启动开发环境

## 快速开始

### 1. 启动基础服务（只需一次）

```bash
# 方式 1: 使用快捷脚本（推荐）
pnpm dev:services

# 方式 2: 手动启动
cd docker
docker-compose -f docker-compose.dev.yml up -d
```

这会启动：
- ✅ PostgreSQL (端口 5432)
- ✅ MinIO (API: 9000, Console: 9001)
- ✅ Redis (端口 6379)

### 2. 配置环境变量

确保根目录有 `.env` 文件（如果不存在会自动从 `.env.example` 创建）：

**重要**: 开发环境必须使用 `localhost` 作为数据库主机名，而不是 `postgres`（`postgres` 是 Docker 容器内的主机名）。

```bash
# 数据库配置（开发环境使用 localhost）
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost  # ⚠️ 必须是 localhost，不是 postgres
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=pis_dev_password  # 与 docker-compose.dev.yml 中的密码一致
DATABASE_SSL=false

# MinIO 配置
MINIO_ENDPOINT_HOST=localhost
MINIO_ENDPOINT_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=pis-photos

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# Worker 配置
WORKER_URL=http://localhost:3001
NEXT_PUBLIC_WORKER_URL=http://localhost:3001
WORKER_API_KEY=changeme  # 开发环境可以使用简单密钥

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos

# 认证配置
AUTH_JWT_SECRET=local-dev-secret-key-change-in-production
ALBUM_SESSION_SECRET=local-dev-session-secret-change-in-production
```

### 3. 启动开发服务器

**终端 1 - Web 前端：**
```bash
pnpm dev:web
# 或
pnpm dev  # 会同时启动 Web 和 Worker（如果配置了 turbo）
```

**终端 2 - Worker 服务：**
```bash
pnpm dev:worker
```

### 4. 访问应用

| 服务 | 地址 | 说明 |
|------|------|------|
| Web 前端 | http://localhost:3000 | Next.js 开发服务器 |
| 管理后台 | http://localhost:3000/admin/login | 需要登录 |
| MinIO Console | http://localhost:9001 | minioadmin/minioadmin |
| PostgreSQL | localhost:5432 | 数据库连接 |

## 常用命令

```bash
# 启动基础服务
pnpm dev:services

# 启动 Web（终端 1）
pnpm dev:web

# 启动 Worker（终端 2）
pnpm dev:worker

# 停止基础服务
pnpm dev:stop

# 查看服务日志
cd docker && docker-compose -f docker-compose.dev.yml logs -f

# 重启服务
cd docker && docker-compose -f docker-compose.dev.yml restart
```

## 优势

✅ **无需构建容器** - Web 和 Worker 在本地运行，修改代码立即生效  
✅ **快速启动** - 基础服务只需启动一次，后续直接运行 `pnpm dev`  
✅ **热重载** - Next.js 和 Worker 都支持热重载  
✅ **调试方便** - 可以直接使用 VS Code 调试器  

## 与生产环境的区别

| 项目 | 开发环境 | 生产环境 |
|------|---------|---------|
| Web | 本地运行 (`pnpm dev`) | Docker 容器 |
| Worker | 本地运行 (`pnpm dev`) | Docker 容器 |
| PostgreSQL | Docker 容器 | Docker 容器 |
| MinIO | Docker 容器 | Docker 容器 |
| Redis | Docker 容器 | Docker 容器 |

## 故障排查

### 端口被占用

如果端口被占用，可以修改 `docker/docker-compose.dev.yml` 中的端口映射：

```yaml
ports:
  - "5433:5432"  # PostgreSQL 改为 5433
  - "9002:9000"  # MinIO API 改为 9002
  - "9003:9001"  # MinIO Console 改为 9003
  - "6380:6379"  # Redis 改为 6380
```

记得同时更新 `.env` 文件中的端口配置。

### 数据库未初始化

如果数据库表不存在，手动执行：

```bash
docker exec -i pis-postgres-dev psql -U pis -d pis < docker/init-postgresql-db.sql
```

### 清理开发环境

```bash
# 停止并删除容器（保留数据卷）
cd docker && docker-compose -f docker-compose.dev.yml down

# 完全清理（包括数据卷）
cd docker && docker-compose -f docker-compose.dev.yml down -v
```

## 下一步

- 📖 [开发指南](DEVELOPMENT.md) - 详细的开发文档
- 🏗️ [架构文档](ARCHITECTURE.md) - 了解系统架构
- 🧪 [测试指南](TESTING.md) - 运行测试
