# PIS 项目架构文档

> 本文档描述 PIS 项目的实际部署架构和环境配置，供工程师参考

## 📋 目录

1. [架构概览](#架构概览)
2. [技术栈](#技术栈)
3. [部署架构](#部署架构)
4. [环境变量配置](#环境变量配置)
5. [服务通信流程](#服务通信流程)
6. [目录结构](#目录结构)
7. [数据流](#数据流)

---

## 架构概览

PIS 采用前后端分离的微服务架构，主要包含以下组件：

```
┌─────────────────────────────────────────────────────────────────┐
│                          公网环境                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    用户访问 (HTTPS)                              │
│                           │                                     │
│  ┌─────────────────────────▼─────────────────────────┐         │
│  │         Cloudflare (DNS + CDN)                     │         │
│  │  • DNS 解析: pic/worker/media.example.com      │         │
│  │  • SSL/TLS 证书 (Full SSL 模式)                   │         │
│  │  • CDN 缓存加速                                     │         │
│  │  • DDoS 防护 + WAF                                 │         │
│  └───────┬───────────────────┬───────────────────┬─┘         │
│          │                   │                   │             │
│  ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐     │
│  │   Vercel      │   │   frpc        │   │   frpc        │     │
│  │   (Next.js)   │   │   (反向代理)   │   │   (反向代理)   │     │
│  │               │   │               │   │               │     │
│  │ pic.albertz   │   │ worker.albertz│   │ media.albertz │     │
│  │ han.top       │   │ han.top       │   │ han.top       │     │
│  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘     │
│          │                   │                   │             │
│          │ HTTPS              │ HTTP (内网)       │ HTTP (内网) │
└───────────┼────────────────────────┼───────────────────────────┘
            │                        │
            │                        │
┌───────────┼────────────────────────┼───────────────────────────┐
│           │                        │        内网服务器          │
│           │                        │     192.168.50.10          │
│           │                        │                            │
│  ┌────────▼────────┐      ┌────────▼────────┐                 │
│  │   frpc          │      │   frpc          │                 │
│  │   (反向代理)     │      │   (反向代理)     │                 │
│  │                 │      │                 │                 │
│  │ worker.albertz  │      │ media.albertz   │                 │
│  │ han.top         │      │ han.top         │                 │
│  └────────┬────────┘      └────────┬────────┘                 │
│           │                        │                            │
│           │ HTTP (内网)            │ HTTP (内网)                │
│           │                        │                            │
│  ┌────────▼────────┐      ┌────────▼────────┐                 │
│  │   Worker        │      │   MinIO         │                 │
│  │   (Docker)      │      │   (Docker)      │                 │
│  │   Port: 3001    │      │   Port: 19000   │                 │
│  │                 │      │   Port: 19001   │                 │
│  │ • 图片处理      │      │ • 对象存储      │                 │
│  │ • 队列处理      │      │ • S3 兼容       │                 │
│  └────────┬────────┘      └────────┬────────┘                 │
│           │                        │                            │
│           │ Docker Network         │ Docker Network             │
│           │                        │                            │
│  ┌────────▼────────┐               │                            │
│  │   Redis         │               │                            │
│  │   (Docker)      │               │                            │
│  │   Port: 16379   │               │                            │
│  │                 │               │                            │
│  │ • 任务队列      │               │                            │
│  │ • 缓存          │               │                            │
│  └─────────────────┘               │                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL (自托管)                         │  │
│  │  • 数据库存储                                            │  │
│  │  • 用户认证（自定义 JWT）                                 │  │
│  │  • 完全自托管                                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 技术栈

### 前端 (Vercel)
- **框架**: Next.js 15.5.7
- **语言**: TypeScript 5.5
- **UI**: React 19, Tailwind CSS, Framer Motion
- **状态管理**: Zustand, TanStack Query
- **图片处理**: Next.js Image, Sharp (服务端)

### 后端 Worker (192.168.50.10)
- **运行时**: Node.js 20+
- **框架**: Node.js 原生 http (HTTP API)
- **队列**: BullMQ (基于 Redis)
- **图片处理**: Sharp
- **存储**: MinIO Client (S3 兼容)

### 数据库
- **主数据库**: PostgreSQL (自托管)
- **认证**: 自定义 JWT + HttpOnly Cookie
- **缓存/队列**: Redis 7

### 存储
- **对象存储**: MinIO (S3 兼容)
- **支持**: 阿里云 OSS, 腾讯云 COS, AWS S3

### 基础设施
- **容器化**: Docker Compose
- **反向代理**: frpc (内网 → 公网)
- **CDN**: Cloudflare
- **部署**: Vercel (前端), Docker (Worker)

---

## 部署架构

### 实际部署环境

#### 公网服务
- **前端**: Vercel (`pic.example.com`)
- **Worker API**: `worker.example.com` (通过 frpc 代理)
- **媒体服务器**: `media.example.com` (通过 frpc 代理)

**域名解析配置（全部通过 Cloudflare DNS）**:
- `pic.example.com` → Cloudflare DNS (CNAME) → `pis-web-ten.vercel.app` → Vercel
- `worker.example.com` → Cloudflare DNS (A 记录) → frpc 服务器 IP → frpc 代理
- `media.example.com` → Cloudflare DNS (A 记录) → frpc 服务器 IP → frpc 代理

**Cloudflare 配置**:
- 所有域名使用 Cloudflare DNS 解析
- Cloudflare 提供 SSL/TLS 证书（自动 HTTPS）
- Cloudflare CDN 加速和缓存（特别是媒体服务器）
- DDoS 防护和 Web 应用防火墙（WAF）

#### 内网服务器 (192.168.50.10)
- **frpc**: 反向代理服务，将内网服务暴露到公网
- **Worker**: Docker 容器，端口 3001 (内网)
- **MinIO**: Docker 容器，端口 19000 (API), 19001 (Console)
- **Redis**: Docker 容器，端口 16379 (内网)

### frpc 反向代理配置

```toml
# frpc 配置位置: /opt/1panel/apps/frpc/frpc/data/frpc.toml

serverAddr = "103.117.122.25"
serverPort = 7000

auth.method = "token"
auth.token = "60d8a83c544e6168db"

# PIS Worker API
[[proxies]]
name = "pis-worker"
type = "http"
localIP = "127.0.0.1"
localPort = 3001
customDomains = ["worker.example.com"]

# PIS 图片存储 API
[[proxies]]
name = "pis-media"
type = "http"
localIP = "127.0.0.1"
localPort = 19000
customDomains = ["media.example.com"]

# MinIO 控制台 (可选)
[[proxies]]
name = "minio"
type = "http"
localIP = "127.0.0.1"
localPort = 9001
customDomains = ["minio.example.com"]
```

### 域名配置

所有域名都通过 **Cloudflare DNS** 解析和管理。

#### Vercel 域名配置
- **自定义域名**: `pic.example.com`
- **Vercel 分配域名**: `pis-web-ten.vercel.app`
- **Cloudflare DNS**: CNAME 记录 `pic.example.com` → `pis-web-ten.vercel.app`
- **SSL**: Cloudflare 自动提供 SSL 证书（Full SSL 模式）
- **CDN**: Cloudflare CDN 加速前端资源

#### frpc 域名配置
- **Worker API**: `worker.example.com`
  - Cloudflare DNS: A 记录 → frpc 服务器 IP
  - frpc 代理 → `192.168.50.10:3001`
  - SSL: Cloudflare 提供 SSL 证书（Full SSL 模式）
  
- **媒体服务器**: `media.example.com`
  - Cloudflare DNS: A 记录 → frpc 服务器 IP
  - frpc 代理 → `192.168.50.10:19000`
  - SSL: Cloudflare 提供 SSL 证书（Full SSL 模式）
  - CDN: Cloudflare CDN 缓存图片资源

#### Cloudflare 配置要点
1. **DNS 解析**: 所有域名在 Cloudflare 中配置 DNS 记录
2. **SSL/TLS**: 使用 Cloudflare 的 Full SSL 模式（端到端加密）
3. **CDN 缓存**: 
   - 前端资源通过 Cloudflare CDN 加速
   - 媒体服务器图片通过 Cloudflare CDN 缓存
4. **安全**: Cloudflare 提供 DDoS 防护和 WAF
5. **缓存清除**: 通过 Cloudflare API 清除 CDN 缓存（见 `CLOUDFLARE_API_TOKEN` 配置）

### Docker Compose 服务

```yaml
# 位置: /opt/PIS/docker/docker-compose.yml

服务:
  - minio:      MinIO 对象存储 (端口 19000/19001)
  - redis:      Redis 队列和缓存 (端口 16379)
  - worker:     图片处理 Worker (端口 3001)
  - minio-init: MinIO 初始化脚本 (一次性任务)
```

---

## 环境变量配置

> 📖 **详细配置说明**: 请参考 [环境变量配置文档](./ENVIRONMENT_VARIABLES.md) 获取完整的配置指南、检查清单和故障排除方法。

### 前端环境变量 (Vercel)

**配置位置**: Vercel Dashboard → Settings → Environment Variables

**重要提示**: 
- `NEXT_PUBLIC_*` 变量会暴露到浏览器，不要包含敏感信息
- 所有 URL 必须使用 **HTTPS**（不是 HTTP）
- `WORKER_API_KEY` 必须与 Worker 服务器配置完全一致

```bash
# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres.example.com
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=true

# ==================== 认证配置 ====================
AUTH_JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long

# ==================== 媒体服务器配置 ====================
# 前端访问媒体服务器的公网 URL (通过 frpc 代理)
NEXT_PUBLIC_MEDIA_URL=https://media.example.com/pis-photos

# ==================== Worker 服务配置 ====================
# Worker API 的公网 URL (通过 frpc 代理)
NEXT_PUBLIC_WORKER_URL=https://worker.example.com
WORKER_API_URL=https://worker.example.com

# Worker API 认证密钥 (必须与 Worker 服务器配置一致)
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8

# ==================== 应用配置 ====================
NEXT_PUBLIC_APP_URL=https://pic.example.com
NEXT_PUBLIC_PHOTOGRAPHER_NAME=PIS Photography
NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE=专业活动摄影

# ==================== Cloudflare Turnstile (可选) ====================
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA5vowVVc5g_-Gxl
TURNSTILE_SECRET_KEY=0x4AAAAAAA5vowGPXhxUGUkqVTMvC-YaLNk

# ==================== Cloudflare CDN 缓存清除 ====================
CLOUDFLARE_API_TOKEN=eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3
CLOUDFLARE_ZONE_ID=55be2d2f25313170ff6a622cda4c37ec
```

### Worker 服务器环境变量 (192.168.50.10)

在 `/opt/PIS/docker/.env` 文件中配置：

```bash
# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres                    # Docker Compose 服务名
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=AUTO_GENERATE           # 由部署脚本自动生成
DATABASE_SSL=false                        # Docker 内部网络不需要 SSL

# ==================== 认证配置 ====================
AUTH_JWT_SECRET=AUTO_GENERATE_32         # 由部署脚本自动生成

# ==================== MinIO 存储配置 ====================
# Worker 使用 Docker 内部网络连接 MinIO
MINIO_ENDPOINT_HOST=minio          # Docker 服务名
MINIO_ENDPOINT_PORT=9000           # MinIO 内部端口
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=albert
MINIO_SECRET_KEY=Zjy-1314
MINIO_BUCKET=pis-photos

# 存储公网 URL（用于生成 presigned URL）
# 注意: 使用公网域名，不是内网地址
STORAGE_PUBLIC_URL=https://media.example.com
MINIO_PUBLIC_URL=https://media.example.com

# ==================== Redis 配置 ====================
# Worker 使用 Docker 内部网络连接 Redis
REDIS_HOST=redis                   # Docker 服务名
REDIS_PORT=6379                    # Redis 内部端口
REDIS_PASSWORD=                    # 如果设置了密码

# ==================== Worker 服务配置 ====================
HTTP_PORT=3001                     # Worker HTTP API 端口
WORKER_BIND_HOST=0.0.0.0           # 绑定所有接口（允许 frpc 访问）
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8

# ==================== 图片处理配置 ====================
PREVIEW_MAX_SIZE=1920              # 预览图最大尺寸
THUMB_MAX_SIZE=250                 # 缩略图最大尺寸

# ==================== Cloudflare CDN 缓存清除 ====================
CLOUDFLARE_API_TOKEN=eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3
CLOUDFLARE_ZONE_ID=55be2d2f25313170ff6a622cda4c37ec
```

### 本地开发环境变量

在项目根目录 `.env.local` 文件中配置：

```bash
# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql

# PostgreSQL 连接配置（本地开发）
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-local-password
DATABASE_SSL=false

# ==================== 认证配置 ====================
AUTH_JWT_SECRET=local-dev-secret-key-change-in-production

# ==================== 存储配置 ====================
# 本地开发: 使用公网 URL 或本地 MinIO
NEXT_PUBLIC_MEDIA_URL=http://media.example.com/pis-photos
STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost         # 本地开发使用 localhost
STORAGE_PORT=19000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=albert
STORAGE_SECRET_KEY=Zjy-1314
STORAGE_BUCKET=pis-photos
STORAGE_PUBLIC_URL=https://media.example.com
MINIO_PUBLIC_URL=https://media.example.com

# 兼容旧配置
MINIO_ENDPOINT_HOST=localhost
MINIO_ENDPOINT_PORT=19000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=albert
MINIO_SECRET_KEY=Zjy-1314
MINIO_BUCKET=pis-photos

# ==================== Worker 服务配置 ====================
WORKER_URL=https://worker.example.com
NEXT_PUBLIC_WORKER_URL=https://worker.example.com
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8

# ==================== Redis 配置 ====================
REDIS_HOST=localhost
REDIS_PORT=16379

# ==================== 应用配置 ====================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PHOTOGRAPHER_NAME=PIS Photography
NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE=专业活动摄影

# ==================== Cloudflare Turnstile ====================
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA5vowVVc5g_-Gxl
TURNSTILE_SECRET_KEY=0x4AAAAAAA5vowGPXhxUGUkqVTMvC-YaLNk

# ==================== Cloudflare CDN ====================
CLOUDFLARE_API_TOKEN=eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3
CLOUDFLARE_ZONE_ID=55be2d2f25313170ff6a622cda4c37ec
```

---

## 服务通信流程

### 1. 图片上传流程

```
用户浏览器 (Vercel)
  ↓ HTTPS POST /api/admin/albums/[id]/upload
Vercel API Route
  ↓ HTTPS POST /api/worker/[...path] (代理)
frpc (worker.example.com)
  ↓ HTTP POST (内网)
Worker (192.168.50.10:3001)
  ↓
  ├─→ Redis (队列任务)
  ├─→ MinIO (上传原图)
  └─→ PostgreSQL (更新数据库)
  
Worker 处理完成后:
  ↓ HTTP PUT (Docker 网络)
MinIO (minio:9000)
  ↓
  ├─→ 生成缩略图 (processed/thumbs/)
  ├─→ 生成预览图 (processed/previews/)
  └─→ 更新数据库状态
```

### 2. 图片访问流程

```
用户浏览器
  ↓ HTTPS GET
Cloudflare CDN (media.example.com)
  ↓ HTTPS (缓存检查)
frpc (media.example.com)
  ↓ HTTP GET (内网)
MinIO (192.168.50.10:19000)
  ↓
返回图片数据
```

### 3. 图片处理流程

```
前端上传完成
  ↓ 创建任务
Redis Queue (BullMQ)
  ↓ Worker 消费
Worker 处理
  ├─→ 读取原图 (MinIO)
  ├─→ 图片处理 (Sharp)
  │   ├─→ EXIF 旋转
  │   ├─→ 添加水印
  │   ├─→ 生成缩略图
  │   └─→ 生成预览图
  ├─→ 上传处理结果 (MinIO)
  └─→ 更新数据库 (PostgreSQL)
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
│       │       └── cloudflare-purge.ts  # CDN 缓存清除
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
│   ├── deploy.sh                   # 一键部署脚本
│   ├── purge-cf-cache.sh          # Cloudflare 缓存清除
│   └── purge-deleted-photos-cache.ts  # 批量清除已删除照片缓存
│
├── docs/                            # 文档
│   ├── ARCHITECTURE.md             # 架构文档 (本文档)
│   ├── DEPLOYMENT.md               # 部署指南
│   └── i18n/                       # 多语言文档
│
├── .env.example                    # 环境变量示例
├── .env.local                      # 本地开发环境变量 (不提交到 Git)
├── package.json                    # Monorepo 根配置
├── pnpm-workspace.yaml             # pnpm workspace 配置
└── turbo.json                      # Turbo 构建配置
```

---

## 数据流

### 照片生命周期

```
1. 上传阶段
   用户 → Vercel API → Worker → MinIO (raw/)
   
2. 处理阶段
   Worker → Redis Queue → Worker → Sharp 处理
   ├─→ 缩略图 → MinIO (processed/thumbs/)
   ├─→ 预览图 → MinIO (processed/previews/)
   └─→ 更新数据库状态
   
3. 展示阶段
   用户 → Cloudflare CDN → frpc → MinIO → 返回图片
   
4. 删除阶段
   用户删除 → Vercel API → PostgreSQL (软删除)
   ↓
   Worker 定时任务 (30天后)
   ├─→ 删除 MinIO 文件
   ├─→ 清除 Cloudflare 缓存
   └─→ 删除数据库记录
```

### 存储路径结构

```
MinIO Bucket: pis-photos/
├── raw/                              # 原始图片
│   └── {albumId}/
│       └── {photoId}.jpg
│
├── processed/
│   ├── thumbs/                       # 缩略图 (250px)
│   │   └── {albumId}/
│   │       └── {photoId}.jpg
│   │
│   └── previews/                    # 预览图 (1920px)
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

#### 前端 (Vercel)
- 使用 HTTPS 访问所有外部服务
- `NEXT_PUBLIC_MEDIA_URL` 必须使用 HTTPS
- `NEXT_PUBLIC_WORKER_URL` 必须使用 HTTPS

#### Worker 服务器 (192.168.50.10)
- **内网连接**: 使用 Docker 服务名 (`minio`, `redis`)
- **公网 URL**: 用于生成 presigned URL，必须使用 HTTPS 域名
- **端口绑定**: `WORKER_BIND_HOST=0.0.0.0` (允许 frpc 访问)

### 2. frpc 反向代理

- **Worker API**: `worker.example.com` → `127.0.0.1:3001`
- **媒体服务器**: `media.example.com` → `127.0.0.1:19000`
- **MinIO Console**: `minio.example.com` → `127.0.0.1:9001`

### 3. Docker 网络

- 所有服务在同一 Docker 网络 (`pis-network`)
- Worker 通过服务名访问 MinIO 和 Redis
- 端口映射:
  - MinIO API: `19000:9000` (主机:容器)
  - MinIO Console: `19001:9001`
  - Redis: `16379:6379`
  - Worker: `3001:3001`

### 4. 环境变量命名规范

- `NEXT_PUBLIC_*`: 前端可访问的环境变量（会暴露到浏览器）
- 无前缀: 服务端专用环境变量（敏感信息）
- `STORAGE_*`: 存储相关配置（Worker 使用）
- `MINIO_*`: MinIO 特定配置（兼容旧配置）

---

## 故障排除

### 常见问题

1. **图片加载失败 (ERR_HTTP2_PROTOCOL_ERROR)**
   - 原因: Cloudflare 和 frpc 之间的 HTTP/2 兼容性问题
   - 解决: OptimizedImage 组件已自动回退到原生 `<img>` 标签

2. **Worker 无法连接 MinIO**
   - 检查: `MINIO_ENDPOINT_HOST=minio` (Docker 服务名)
   - 检查: Docker 网络是否正常

3. **前端无法访问媒体服务器**
   - 检查: `NEXT_PUBLIC_MEDIA_URL` 是否使用 HTTPS
   - 检查: frpc 服务是否正常运行
   - 检查: Cloudflare CDN 缓存（可能需要清除）

4. **已删除照片仍可访问**
   - 原因: Cloudflare CDN 缓存
   - 解决: 运行 `scripts/purge-deleted-photos-cache.ts` 清除缓存

---

## 维护命令

### 服务器维护 (192.168.50.10)

```bash
# 查看服务状态
cd /opt/PIS/docker
docker-compose ps

# 查看日志
docker-compose logs -f worker
docker-compose logs -f minio

# 重启服务
docker-compose restart worker

# 更新代码
cd /opt/PIS
git pull
cd docker
docker-compose up -d --build worker
```

### 清除 Cloudflare 缓存

```bash
# 清除特定图片缓存
./scripts/purge-cf-cache.sh \
  "https://media.example.com/pis-photos/processed/previews/xxx/xxx.jpg"

# 清除所有已删除照片的缓存
tsx scripts/purge-deleted-photos-cache.ts
```

---

## 安全注意事项

1. **环境变量安全**
   - 不要将 `.env.local` 提交到 Git
   - `NEXT_PUBLIC_*` 变量会暴露到浏览器，不要包含敏感信息
   - `WORKER_API_KEY` 必须使用强密码（至少 32 字符）

2. **网络安全**
   - Worker 服务仅在内网运行，通过 frpc 暴露到公网
   - MinIO Console 建议限制 IP 访问
   - Redis 建议设置密码

3. **CDN 缓存**
   - 删除照片时自动清除 Cloudflare 缓存
   - 定期检查已删除照片的缓存状态

---

## 更新日志

- **2026-01-26**: 添加 HTTP/2 错误自动回退机制
- **2026-01-26**: 改进 Cloudflare 缓存清除逻辑
- **2026-01-26**: 更新架构文档，包含 frpc 反向代理配置

---

## 相关文档

- [部署指南](i18n/zh-CN/DEPLOYMENT.md)
- [存储配置](i18n/zh-CN/STORAGE_CONFIG.md)
- [数据库配置](i18n/zh-CN/DATABASE_CONFIG.md)
- [CDN 配置指南](../CDN_SETUP_GUIDE.md)
