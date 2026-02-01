# PIS Docker 部署指南

> 📋 **Docker Compose 文件说明**: 请参考 [DOCKER_COMPOSE_FILES.md](./DOCKER_COMPOSE_FILES.md) 了解不同配置文件的用途

## 部署架构

**完全自托管（推荐）**

| 组件 | 位置 | 说明 |
|------|------|------|
| **前端** | 自建服务器 | Next.js 应用（Docker 容器） |
| **数据库** | 自建服务器 | PostgreSQL 数据库（Docker 容器，自动初始化） |
| **存储/Worker** | 自建服务器 | MinIO + Redis + Worker 服务（Docker 容器） |
| **反向代理** | 自建服务器 | Next.js Web 容器（集成代理功能） |

**混合部署（可选，向后兼容）**

| 组件 | 位置 | 说明 |
|------|------|------|
| **前端** | Vercel | Next.js 应用（自动部署） |
| **数据库** | Supabase Cloud | PostgreSQL 数据库和认证（向后兼容） |
| **存储/Worker** | 自建服务器 | MinIO + Redis + Worker 服务 |

## 快速开始（一键部署）

### 方法一：一键安装（推荐）

```bash
# 复制粘贴到终端执行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/install.sh | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/install.sh | bash
```

### 方法二：手动安装

```bash
git clone https://github.com/JunyuZhan/pis-standalone.git
cd pis-standalone/docker
bash deploy.sh
```

脚本会引导你完成：
- 配置 PostgreSQL 数据库连接
- 配置域名和 SSL 证书
- 配置存储（自动生成密钥）
- 配置 Worker 服务
- 初始化数据库和创建管理员账号

## 手动部署

### 1. 配置数据库

#### 方式一：使用 Docker Compose（推荐）

使用 `docker-compose.standalone.yml` 自动启动 PostgreSQL：

```bash
cd docker
docker-compose -f docker-compose.standalone.yml up -d postgres
```

#### 方式二：使用外部 PostgreSQL

确保 PostgreSQL 已安装并运行，然后执行初始化脚本：

```bash
psql -h localhost -U postgres -d pis -f docker/init-postgresql-db.sql
```

### 2. 配置环境变量

```bash
# 复制并编辑配置文件
cp ../.env.example ../.env
nano ../.env

# 必须配置:
#   DATABASE_TYPE=postgresql
#   DATABASE_HOST=localhost
#   DATABASE_PORT=5432
#   DATABASE_NAME=pis
#   DATABASE_USER=pis
#   DATABASE_PASSWORD=your-secure-password
#   AUTH_JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long
```

### 3. 初始化数据库

#### 自动初始化（推荐）

**Docker Compose 会自动初始化数据库**：
- ✅ PostgreSQL 容器会在首次启动时自动执行 `init-postgresql-db.sql`
- ✅ 如果数据卷是全新的，无需手动操作
- ✅ 数据库会在容器启动后自动完成初始化

#### 手动初始化（外部数据库或已有数据卷）

如果使用外部 PostgreSQL 或数据卷已存在，需要手动执行：

```bash
# 外部 PostgreSQL
psql -h localhost -U pis -d pis -f docker/init-postgresql-db.sql

# 或使用 Docker 容器执行
docker exec -i pis-postgres psql -U pis -d pis < docker/init-postgresql-db.sql
```

### 4. 创建管理员账号

```bash
# 使用脚本创建管理员账号
cd ..
pnpm create-admin

# 或直接运行
pnpm exec tsx scripts/create-admin.ts
```

### 5. 启动服务

#### 完全自托管模式（推荐）

```bash
cd docker
docker-compose -f docker-compose.standalone.yml up -d
```

这将启动所有服务：PostgreSQL、MinIO、Redis、Worker、Web、Nginx。

#### 混合部署模式（仅 Worker 和存储，向后兼容）

```bash
cd docker
docker-compose up -d
```

然后单独部署前端到 Vercel：
- 导入 GitHub 仓库到 Vercel
- 配置环境变量（从 .env 文件）
- 部署

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f worker

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| nginx | 8081 | 反向代理（唯一对外暴露端口，所有服务通过路径访问） |
| web | 容器内 | Next.js 前端（通过 Nginx 访问） |
| worker | 容器内 | 图片处理服务（通过 Nginx /worker-api/ 访问） |
| postgres | 容器内 | PostgreSQL 数据库（仅容器内访问） |
| minio | 容器内 | 对象存储（通过 Nginx /media/ 和 /minio-console/ 访问） |
| redis | 容器内 | 任务队列（仅容器内访问） |

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose logs --tail=100 <服务名>

# 检查容器状态
docker compose ps -a
```

### 数据库连接失败

检查 PostgreSQL 配置：
- 确认 `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_NAME`、`DATABASE_USER`、`DATABASE_PASSWORD` 正确
- 检查 PostgreSQL 服务是否运行：`docker-compose ps postgres`
- 检查数据库是否已初始化：`psql -h localhost -U pis -d pis -c "\dt"`

### MinIO 无法访问

```bash
# 检查 MinIO 健康状态
curl http://localhost:9000/minio/health/live
```

## 备份与恢复

### 备份数据

```bash
# 备份 MinIO 数据（存储的图片文件）
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data

# 数据库备份（PostgreSQL）
# 完全自托管模式：
docker exec pis-postgres pg_dump -U pis -d pis > backup.sql

# 混合部署模式（Supabase）：在 Supabase Dashboard -> Database -> Backups 中操作
```

### 恢复数据

```bash
# 恢复 MinIO 数据
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar xzf /backup/minio-backup.tar.gz -C /

# 恢复 PostgreSQL 数据
docker exec -i pis-postgres pg_restore -U pis -d pis < backup.sql

# 或使用 psql
psql -h localhost -U pis -d pis < backup.sql
```
