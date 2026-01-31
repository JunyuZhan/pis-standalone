<!--
⚠️  这是示例文档，所有敏感信息已用占位符替换
实际配置请参考对应的原始文档（不提交到 Git）
-->
# PIS 项目架构文档

> 本文档说明 PIS 系统的架构逻辑和组件关系，不限定具体部署方式。

## 📋 目录

1. [快速参考](#快速参考) - 常用命令和配置速查
2. [架构概览](#架构概览)
3. [技术栈](#技术栈)
4. [部署架构](#部署架构)
5. [环境变量配置](#环境变量配置)
6. [服务通信流程](#服务通信流程)
7. [目录结构](#目录结构)
8. [数据流](#数据流)
9. [维护命令](#维护命令)
10. [故障排查](#故障排查)

---

## 快速参考

### 🏗️ 系统组件

PIS 系统包含以下核心组件：

- **前端 (Next.js)**: 用户界面和 API Routes
- **Worker**: 图片处理服务
- **存储**: 对象存储（MinIO/OSS/COS/S3）
- **数据库**: PostgreSQL/MySQL（通过 Supabase 或直接连接）
- **队列**: Redis（用于任务队列）

### 🚀 常用命令

```bash
# 本地开发
pnpm install      # 安装依赖
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm lint         # 代码检查
pnpm docker:up    # 启动 Docker 服务（MinIO + Redis）
```

---

## 架构概览

PIS 采用前后端分离的微服务架构，主要包含以下组件：

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Next.js)                          │
│  • 用户界面                                                  │
│  • API Routes (代理 Worker 请求)                            │
└───────┬───────────────────────┬─────────────────────────────┘
        │                       │
        │                       ▼
        │              ┌─────────────────┐
        │              │   对象存储       │
        │              │ (MinIO/OSS/COS/S3) │
        │              └─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Worker (图片处理)                         │
│  • 图片处理 (Sharp)                                          │
│  • 队列处理 (BullMQ)                                         │
└───────┬───────────────────────┬─────────────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐      ┌─────────────────┐
│    Redis     │      │   数据库        │
│  (任务队列)   │      │ (PostgreSQL/MySQL) │
└──────────────┘      └─────────────────┘
```

**组件说明**:
- **前端**: Next.js 应用，提供用户界面和 API Routes
- **Worker**: 独立的图片处理服务，通过 HTTP API 提供服务
- **存储**: 对象存储服务，存储原始图片和处理后的图片
- **数据库**: 存储相册、照片等元数据
- **Redis**: 任务队列，用于异步处理图片

---

## 技术栈

### 前端
- **框架**: Next.js 15
- **语言**: TypeScript
- **UI**: React, Tailwind CSS
- **状态管理**: Zustand, TanStack Query

### Worker
- **运行时**: Node.js 20+
- **框架**: Node.js 原生 http
- **队列**: BullMQ (基于 Redis)
- **图片处理**: Sharp

### 数据库
- **支持**: PostgreSQL（自托管，推荐）, Supabase（向后兼容）
- **队列**: Redis

### 存储
- **支持**: MinIO, 阿里云 OSS, 腾讯云 COS, AWS S3

---

## 部署架构

PIS 采用微服务架构，各组件可以独立部署：

- **前端**: 部署到任何支持 Next.js 的平台
- **Worker**: 独立部署，通过 HTTP API 提供服务
- **存储**: 对象存储服务（MinIO/OSS/COS/S3）
- **数据库**: PostgreSQL（自托管，推荐）或 Supabase（向后兼容）
- **Redis**: 任务队列服务

各组件通过环境变量配置连接，部署方式灵活。

---

## 环境变量配置

> 📖 **详细配置说明**: 请参考 [环境变量配置文档](./ENVIRONMENT_VARIABLES.example.md)

### 前端环境变量

**重要提示**: 
- `NEXT_PUBLIC_*` 变量会暴露到浏览器，不要包含敏感信息
- `WORKER_API_KEY` 必须与 Worker 配置一致

```bash
# 数据库配置（PostgreSQL，推荐）
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=false

# 或使用 Supabase（向后兼容）
# DATABASE_TYPE=supabase
# NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 存储配置
NEXT_PUBLIC_MEDIA_URL=https://your-media-domain.com/pis-photos

# Worker 配置
NEXT_PUBLIC_WORKER_URL=https://your-worker-domain.com
WORKER_API_KEY=your-worker-api-key

# 应用配置
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

### Worker 环境变量

```bash
# 数据库配置（PostgreSQL，推荐）
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=false

# 或使用 Supabase（向后兼容）
# DATABASE_TYPE=supabase
# SUPABASE_URL=https://your-project-id.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 存储配置
STORAGE_TYPE=minio
STORAGE_ENDPOINT=your-storage-endpoint
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
STORAGE_BUCKET=pis-photos
STORAGE_PUBLIC_URL=https://your-media-domain.com

# Redis 配置
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# Worker 配置
HTTP_PORT=3001
WORKER_API_KEY=your-worker-api-key
```

---

## 服务通信流程

### 1. 图片上传流程

```
用户浏览器
  ↓ POST /api/admin/albums/[id]/upload
前端 API Route
  ├─→ 创建上传凭证
  └─→ 代理到 Worker API
      ↓
      Worker 服务
      ↓
      ├─→ Redis (加入队列)
      ├─→ 存储 (上传原图)
      └─→ 数据库 (创建记录)
      
Worker 异步处理:
  ↓
  ├─→ 生成缩略图
  ├─→ 生成预览图
  └─→ 更新数据库状态
```

### 2. 图片访问流程

```
用户浏览器
  ↓ GET
前端/CDN
  ↓
存储服务
  ↓
返回图片数据
```

### 3. 图片处理流程

```
前端上传完成
  ↓ 创建任务
Redis 队列
  ↓ Worker 消费
Worker 处理
  ├─→ 读取原图 (存储)
  ├─→ 图片处理
  │   ├─→ EXIF 旋转
  │   ├─→ 添加水印
  │   ├─→ 生成缩略图
  │   └─→ 生成预览图
  ├─→ 上传处理结果 (存储)
  └─→ 更新数据库
```

---

## 目录结构

```
PIS/
├── apps/
│   └── web/                          # Next.js 前端应用
│       ├── src/
│       │   ├── app/                  # Next.js App Router
│       │   │   ├── api/              # API Routes
│       │   │   │   ├── admin/       # 管理员 API
│       │   │   │   └── public/      # 公开 API
│       │   │   ├── admin/           # 管理后台页面
│       │   │   └── album/           # 相册展示页面
│       │   ├── components/           # React 组件
│       │   │   ├── admin/           # 管理后台组件
│       │   │   ├── album/           # 相册相关组件
│       │   │   └── ui/              # UI 基础组件
│       │   └── lib/                 # 工具函数
│       ├── next.config.ts            # Next.js 配置
│       └── package.json
│
├── services/
│   └── worker/                       # Worker 服务
│       ├── src/
│       │   ├── index.ts              # Worker 入口
│       │   ├── processor.ts         # 图片处理逻辑
│       │   └── lib/
│       │       ├── database/        # 数据库适配器
│       │       ├── storage/         # 存储适配器
│       │       ├── redis.ts         # Redis 客户端
│       │       └── cloudflare-purge.ts  # CDN 缓存清除（可选）
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml           # Docker Compose 配置
│   ├── worker.Dockerfile           # Worker Dockerfile
│   └── nginx/
│       └── media.conf              # Nginx 配置示例
│
├── database/
│   └── init-postgresql-db.sql      # 数据库架构
│
├── scripts/                         # 部署和维护脚本
│   ├── deploy.sh                   # 部署脚本
│   └── purge-deleted-photos-cache.ts  # 批量清除已删除照片缓存
│
├── docs/                            # 文档
│   ├── ARCHITECTURE.md             # 架构文档 (本文档)
│   ├── DEPLOYMENT.md               # 部署指南
│   └── i18n/                       # 多语言文档
│
├── .env.example                    # 环境变量示例
├── .env                            # 本地开发环境变量 (不提交到 Git)
├── package.json                    # Monorepo 根配置
├── pnpm-workspace.yaml             # pnpm workspace 配置
└── turbo.json                      # Turbo 构建配置
```

---

## 数据流

### 照片生命周期

```
1. 上传阶段
   用户 → 前端 API → Worker → 存储 (raw/)
   
2. 处理阶段
   Worker → Redis 队列 → Worker → 图片处理
   ├─→ 生成缩略图 → 存储 (processed/thumbs/)
   ├─→ 生成预览图 → 存储 (processed/previews/)
   └─→ 更新数据库状态
   
3. 展示阶段
   用户 → 前端/CDN → 存储 → 返回图片
   
4. 删除阶段
   用户删除 → 前端 API → 数据库 (软删除)
   ↓
   Worker 定时任务 (30天后)
   ├─→ 删除存储文件
   ├─→ 清除 CDN 缓存
   └─→ 删除数据库记录
```

### 存储路径结构

```
存储 Bucket: pis-photos/
├── raw/                              # 原始图片
│   └── {albumId}/
│       └── {photoId}.jpg
│
├── processed/
│   ├── thumbs/                       # 缩略图
│   │   └── {albumId}/
│   │       └── {photoId}.jpg
│   │
│   └── previews/                    # 预览图
│       └── {albumId}/
│           └── {photoId}.jpg
│
└── packages/                         # 打包下载
    └── {albumId}/
        └── {packageId}.zip
```

---

## 关键配置说明

### 1. 网络配置

- 前端通过 HTTP API 调用 Worker 服务
- Worker 通过环境变量配置连接存储和数据库
- 存储公网 URL 用于生成 presigned URL

### 2. 环境变量命名规范

- `NEXT_PUBLIC_*`: 前端可访问的环境变量（会暴露到浏览器）
- 无前缀: 服务端专用环境变量（敏感信息）
- `STORAGE_*`: 存储相关配置（Worker 使用）

---

## 故障排查

### 常见问题

1. **图片加载失败**
   - 检查: `NEXT_PUBLIC_MEDIA_URL` 配置是否正确
   - 检查: 存储服务是否正常运行
   - 检查: CDN 缓存（可能需要清除）

2. **Worker 无法连接存储**
   - 检查: `STORAGE_ENDPOINT` 配置是否正确
   - 检查: 存储服务网络连接

3. **前端无法访问 Worker API**
   - 检查: `NEXT_PUBLIC_WORKER_URL` 配置是否正确
   - 检查: `WORKER_API_KEY` 是否一致
   - 检查: Worker 服务是否正常运行

4. **已删除照片仍可访问**
   - 原因: CDN 缓存
   - 解决: 清除 CDN 缓存

---

## 维护命令

### Docker 服务维护

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f worker
docker-compose logs -f minio

# 重启服务
docker-compose restart worker

# 更新代码
git pull
docker-compose up -d --build worker
```

### 清除 CDN 缓存

```bash
# 清除特定图片缓存
./scripts/purge-cf-cache.sh "图片URL"

# 清除所有已删除照片的缓存
tsx scripts/purge-deleted-photos-cache.ts
```

---

## 安全注意事项

1. **环境变量安全**
   - 不要将 `.env` 提交到 Git
   - `NEXT_PUBLIC_*` 变量会暴露到浏览器，不要包含敏感信息
   - `WORKER_API_KEY` 必须使用强密码（至少 32 字符）

2. **网络安全**
   - Worker 服务建议限制访问
   - 存储服务控制台建议限制 IP 访问
   - Redis 建议设置密码

3. **CDN 缓存**
   - 删除照片时自动清除 CDN 缓存
   - 定期检查已删除照片的缓存状态

---

## 更新日志

- **2026-01-27**: 简化架构文档，移除具体部署限制

---

## 相关文档

- [部署指南](i18n/zh-CN/DEPLOYMENT.md)
