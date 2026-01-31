# PIS 环境变量配置文档

> 本文档详细说明 PIS 项目的环境变量配置，包含实际生产环境配置示例

## 📋 目录

1. [快速配置（自动生成）](#快速配置自动生成) - 新功能
2. [配置位置说明](#配置位置说明)
3. [Vercel 环境变量](#vercel-环境变量)
4. [Worker 服务器环境变量](#worker-服务器环境变量)
5. [本地开发环境变量](#本地开发环境变量)
6. [环境变量说明](#环境变量说明)

---

## 快速配置（自动生成）

> ⚠️ **新功能**: 引导式部署脚本会自动生成所有安全密钥

### 使用引导式部署脚本

运行引导式部署脚本可以自动生成所有必需的安全密钥：

```bash
git clone https://github.com/JunyuZhan/PIS.git
cd pis
bash docker/deploy.sh
```

### 自动生成的密钥

脚本会自动为以下变量生成安全的随机值：

| 变量名 | 占位符 | 说明 | 生成方式 |
|--------|--------|------|----------|
| `STORAGE_ACCESS_KEY` | `AUTO_GENERATE_16` | MinIO 访问密钥 | 16 字符随机字符串 |
| `STORAGE_SECRET_KEY` | `AUTO_GENERATE` | MinIO 密钥 | 64 字符十六进制 |
| `WORKER_API_KEY` | `AUTO_GENERATE_32` | Worker API 密钥 | 64 字符十六进制 |
| `ALBUM_SESSION_SECRET` | `AUTO_GENERATE_32` | 会话签名密钥 | 64 字符十六进制 |
| `REDIS_PASSWORD` | `AUTO_GENERATE` | Redis 密码 | 32 字符随机字符串 |
| `POSTGRES_PASSWORD` | `AUTO_GENERATE` | PostgreSQL 密码 | 32 字符随机字符串 |

### 占位符说明

在 `.env.example` 文件中，您会看到以下占位符：

- `AUTO_GENERATE`: 生成 64 字符十六进制随机字符串
- `AUTO_GENERATE_16`: 生成 16 字符随机字符串
- `AUTO_GENERATE_32`: 生成 64 字符十六进制随机字符串（32 字节）

这些占位符仅用于配置文件模板，部署脚本会将其替换为实际的安全随机值。

---

## 配置位置说明

### 前端 (Vercel)
- **位置**: Vercel Dashboard → Settings → Environment Variables
- **作用**: Next.js 应用运行时使用
- **注意**: `NEXT_PUBLIC_*` 变量会暴露到浏览器

### Worker 服务器 (192.168.50.10)
- **位置**: `/opt/PIS/docker/.env`
- **作用**: Docker Compose 读取，传递给 Worker 容器
- **注意**: 使用 Docker 内部网络地址（服务名）

### 本地开发
- **位置**: 项目根目录 `.env.local`
- **作用**: 本地开发环境使用
- **注意**: 不提交到 Git（已在 .gitignore 中）

---

## Vercel 环境变量

### 配置位置

**Vercel Dashboard** → 项目 → **Settings** → **Environment Variables**

### 配置步骤

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目 `PIS` (或你的项目名称)
3. 进入 **Settings** → **Environment Variables**
4. 点击 **Add New** 添加每个环境变量
5. 选择环境范围（Production、Preview、Development）
6. 保存后需要重新部署才能生效

### 必需配置（Production）

以下环境变量是应用运行所必需的，必须全部配置：

```bash
# ==================== 数据库配置 ====================
# 数据库类型：postgresql（自托管）或 supabase（云服务，向后兼容）
DATABASE_TYPE=postgresql

# PostgreSQL 连接配置（方式1：使用连接字符串）
# DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# PostgreSQL 连接配置（方式2：分别配置，推荐）
DATABASE_HOST=postgres.example.com
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=true

# 认证 JWT 密钥（用于会话管理，必须与 Worker 服务器一致）
AUTH_JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long

# ==================== 媒体服务器配置 ====================
# 前端访问媒体服务器的公网 URL（通过 frpc 反向代理）
# ⚠️ 必须使用 HTTPS，格式: https://域名/路径
NEXT_PUBLIC_MEDIA_URL=https://media.example.com/pis-photos

# ==================== Worker 服务配置 ====================
# Worker API 的公网 URL（通过 frpc 反向代理）
# ⚠️ 必须使用 HTTPS
NEXT_PUBLIC_WORKER_URL=https://worker.example.com

# Worker API URL（服务端使用，支持多个变量名）
WORKER_API_URL=https://worker.example.com

# Worker API 认证密钥（必须与 Worker 服务器配置一致）
# ⚠️ 这是敏感信息，不要暴露到客户端
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8

# ==================== 应用配置 ====================
# 应用公网访问地址（用于生成链接、邮件等）
NEXT_PUBLIC_APP_URL=https://pic.example.com

# 品牌信息（显示在页面标题、元数据等）
NEXT_PUBLIC_PHOTOGRAPHER_NAME=PIS Photography
NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE=专业活动摄影
```

### 可选配置

以下环境变量是可选的，根据需求配置：

```bash
# ==================== Cloudflare Turnstile (可选) ====================
# 用于登录页面的机器人验证（防止暴力破解）
# 如果未配置，登录页面将不显示验证码
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA5vowVVc5g_-Gxl
TURNSTILE_SECRET_KEY=0x4AAAAAAA5vowGPXhxUGUkqVTMvC-YaLNk

# ==================== Cloudflare CDN 缓存清除 (可选) ====================
# 用于在删除照片时自动清除 CDN 缓存
# 如果未配置，删除照片后 CDN 缓存可能仍存在一段时间
CLOUDFLARE_API_TOKEN=eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3
CLOUDFLARE_ZONE_ID=55be2d2f25313170ff6a622cda4c37ec
```

### 环境变量说明表

| 变量名 | 类型 | 必需 | 说明 | 示例值 |
|--------|------|------|------|--------|
| `DATABASE_TYPE` | Private | ✅ | 数据库类型 | `postgresql` 或 `supabase` |
| `DATABASE_URL` | Private | ❌ | PostgreSQL 连接字符串（方式1） | `postgresql://user:pass@host:5432/db` |
| `DATABASE_HOST` | Private | ✅* | PostgreSQL 主机地址 | `postgres.example.com` |
| `DATABASE_PORT` | Private | ❌ | PostgreSQL 端口 | `5432` |
| `DATABASE_NAME` | Private | ✅* | PostgreSQL 数据库名 | `pis` |
| `DATABASE_USER` | Private | ✅* | PostgreSQL 用户名 | `pis` |
| `DATABASE_PASSWORD` | Private | ✅* | PostgreSQL 密码 | `your-secure-password` |
| `DATABASE_SSL` | Private | ❌ | 是否使用 SSL | `true` 或 `false` |
| `AUTH_JWT_SECRET` | Private | ✅ | JWT 签名密钥（会话管理） | `your-jwt-secret-key...` |
| `NEXT_PUBLIC_MEDIA_URL` | Public | ✅ | 媒体服务器公网 URL（HTTPS） | `https://media.example.com/pis-photos` |
| `NEXT_PUBLIC_WORKER_URL` | Public | ✅ | Worker API 公网 URL（HTTPS） | `https://worker.example.com` |
| `WORKER_API_URL` | Private | ✅ | Worker API URL（服务端，兼容） | `https://worker.example.com` |
| `WORKER_API_KEY` | Private | ✅ | Worker API 认证密钥 | `14566ade4b1a...` |
| `NEXT_PUBLIC_APP_URL` | Public | ✅ | 应用公网访问地址 | `https://pic.example.com` |
| `NEXT_PUBLIC_PHOTOGRAPHER_NAME` | Public | ✅ | 摄影师/品牌名称 | `PIS Photography` |
| `NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE` | Public | ✅ | 品牌标语 | `专业活动摄影` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public | ❌ | Cloudflare Turnstile 站点密钥 | `0x4AAAAAAA...` |
| `TURNSTILE_SECRET_KEY` | Private | ❌ | Cloudflare Turnstile 密钥 | `0x4AAAAAAA...` |
| `CLOUDFLARE_API_TOKEN` | Private | ❌ | Cloudflare API Token | `eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3` |
| `CLOUDFLARE_ZONE_ID` | Private | ❌ | Cloudflare Zone ID | `55be2d2f25313170ff6a622cda4c37ec` |

**说明**:
- ✅* 表示如果未使用 `DATABASE_URL`，则这些变量是必需的
- **Public**: `NEXT_PUBLIC_*` 前缀的变量会暴露到浏览器，不要包含敏感信息
- **Private**: 无前缀的变量仅在服务端使用，可以包含敏感信息
- **必需**: ✅ 表示应用运行必需，❌ 表示可选

**说明**:
- **Public**: `NEXT_PUBLIC_*` 前缀的变量会暴露到浏览器，不要包含敏感信息
- **Private**: 无前缀的变量仅在服务端使用，可以包含敏感信息
- **必需**: ✅ 表示应用运行必需，❌ 表示可选

### 快速配置检查清单

在 Vercel Dashboard 中检查以下配置：

- [ ] `DATABASE_TYPE=postgresql` 已设置（自托管模式）
- [ ] PostgreSQL 连接配置已正确设置（`DATABASE_URL` 或分别配置 `DATABASE_HOST` 等）
- [ ] `AUTH_JWT_SECRET` 已配置（至少 32 字符，与 Worker 服务器一致）
- [ ] `NEXT_PUBLIC_MEDIA_URL` 使用 **HTTPS**（不是 HTTP）
- [ ] `NEXT_PUBLIC_WORKER_URL` 使用 **HTTPS**（不是 HTTP）
- [ ] `WORKER_API_KEY` 与 Worker 服务器配置**完全一致**（区分大小写）
- [ ] 所有 `NEXT_PUBLIC_*` 变量已正确设置（前端会使用）
- [ ] 环境范围已正确选择（Production/Preview/Development）

### 常见问题

#### 1. 环境变量更新后不生效

**原因**: Vercel 需要重新部署才能应用新的环境变量

**解决**: 
- 在 Vercel Dashboard → Deployments 中点击 **Redeploy**
- 或推送新的代码触发自动部署

#### 2. Worker API 调用失败（401 Unauthorized）

**原因**: `WORKER_API_KEY` 与 Worker 服务器不一致

**解决**: 
- 检查 Vercel 和 Worker 服务器的 `WORKER_API_KEY` 是否完全相同
- 确保没有多余的空格或换行符

#### 3. 数据库连接失败

**原因**: PostgreSQL 连接配置错误

**解决**: 
- 检查 `DATABASE_URL` 格式是否正确，或分别检查 `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_NAME`、`DATABASE_USER`、`DATABASE_PASSWORD`
- 确保数据库服务器允许来自 Vercel IP 的连接
- 如果使用 SSL，确保 `DATABASE_SSL=true` 且数据库服务器支持 SSL

#### 4. 图片加载失败（ERR_HTTP2_PROTOCOL_ERROR）

**原因**: `NEXT_PUBLIC_MEDIA_URL` 使用了 HTTP 或配置错误

**解决**: 
- 确保 `NEXT_PUBLIC_MEDIA_URL` 使用 HTTPS
- 检查 URL 格式是否正确（包含 `/pis-photos` 路径）

---

## Worker 服务器环境变量

### 文件位置
`/opt/PIS/docker/.env`

### 完整配置

```bash
# ==================== 数据库配置 ====================
# 数据库类型
DATABASE_TYPE=postgresql

# PostgreSQL 连接配置（使用 Docker 内部网络）
DATABASE_HOST=postgres                    # Docker Compose 服务名
DATABASE_PORT=5432                        # PostgreSQL 容器内部端口
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=AUTO_GENERATE           # 由部署脚本自动生成
DATABASE_SSL=false                        # Docker 内部网络不需要 SSL

# 认证 JWT 密钥（必须与前端配置一致）
AUTH_JWT_SECRET=AUTO_GENERATE_32          # 由部署脚本自动生成

# ==================== MinIO 存储配置 ====================
# Worker 使用 Docker 内部网络连接 MinIO
# 注意: 使用 Docker 服务名，不是 IP 地址
MINIO_ENDPOINT_HOST=minio              # Docker Compose 服务名
MINIO_ENDPOINT_PORT=9000               # MinIO 容器内部端口
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=albert
MINIO_SECRET_KEY=Zjy-1314
MINIO_BUCKET=pis-photos

# 存储公网 URL（用于生成 presigned URL）
# 重要: 使用公网域名，不是内网地址
# 这个 URL 用于生成签名 URL，必须与实际访问地址一致
STORAGE_PUBLIC_URL=https://media.example.com
MINIO_PUBLIC_URL=https://media.example.com

# ==================== Redis 配置 ====================
# Worker 使用 Docker 内部网络连接 Redis
REDIS_HOST=redis                        # Docker Compose 服务名
REDIS_PORT=6379                         # Redis 容器内部端口
REDIS_PASSWORD=                          # 如果设置了密码，填写密码

# ==================== Worker 服务配置 ====================
HTTP_PORT=3001                          # Worker HTTP API 端口
WORKER_BIND_HOST=0.0.0.0                # 绑定所有接口（允许 frpc 访问）

# Worker API 认证密钥 (必须与 Vercel 配置一致)
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8

# ==================== 图片处理配置 ====================
PREVIEW_MAX_SIZE=1920                   # 预览图最大尺寸（像素）
THUMB_MAX_SIZE=250                      # 缩略图最大尺寸（像素）

# ==================== Cloudflare CDN 缓存清除 ====================
CLOUDFLARE_API_TOKEN=eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3
CLOUDFLARE_ZONE_ID=55be2d2f25313170ff6a622cda4c37ec

# ==================== Cloudflare Turnstile (可选) ====================
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA5vowVVc5g_-Gxl
TURNSTILE_SECRET_KEY=0x4AAAAAAA5vowGPXhxUGUkqVTMvC-YaLNk
```

---

## 本地开发环境变量

### 文件位置
项目根目录 `.env.local`

### 完整配置

```bash
# ===========================================
# PIS 统一环境配置 (根目录)
# 本地开发: 此文件被 apps/web 和 services/worker 共享
# ===========================================

# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql

# PostgreSQL 连接配置（本地开发）
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-local-password
DATABASE_SSL=false

# 认证 JWT 密钥（本地开发可以使用简单密钥）
AUTH_JWT_SECRET=local-dev-secret-key-change-in-production

# ==================== MinIO 存储配置 ====================
# 注意: NEXT_PUBLIC_MEDIA_URL 用于前端访问，STORAGE_ENDPOINT 用于后端连接
# 本地开发: 可以使用公网 URL 或本地 MinIO
NEXT_PUBLIC_MEDIA_URL=http://media.example.com/pis-photos

STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost              # 本地开发使用 localhost
STORAGE_PORT=19000                     # 本地 MinIO 端口
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

# ==================== Worker 服务 ====================
WORKER_URL=https://worker.example.com
NEXT_PUBLIC_WORKER_URL=https://worker.example.com
WORKER_API_KEY=14566ade4b1a168eccf84ffb0d91e17e23662c5f966506de4c3aa82d16554cb8

# ==================== Redis ====================
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

## 环境变量说明

### 数据库配置

| 变量名 | 位置 | 说明 | 示例值 |
|--------|------|------|--------|
| `DATABASE_TYPE` | 所有 | 数据库类型 | `postgresql` 或 `supabase` |
| `DATABASE_URL` | 所有 | PostgreSQL 连接字符串（可选） | `postgresql://user:pass@host:5432/db` |
| `DATABASE_HOST` | 所有 | PostgreSQL 主机地址 | `localhost` 或 `postgres.example.com` |
| `DATABASE_PORT` | 所有 | PostgreSQL 端口 | `5432` |
| `DATABASE_NAME` | 所有 | PostgreSQL 数据库名 | `pis` |
| `DATABASE_USER` | 所有 | PostgreSQL 用户名 | `pis` |
| `DATABASE_PASSWORD` | 所有 | PostgreSQL 密码 | `your-secure-password` |
| `DATABASE_SSL` | 所有 | 是否使用 SSL | `true` 或 `false` |
| `AUTH_JWT_SECRET` | 所有 | JWT 签名密钥（会话管理） | `your-jwt-secret-key...` |

### 存储配置

| 变量名 | 位置 | 说明 | 示例值 |
|--------|------|------|--------|
| `NEXT_PUBLIC_MEDIA_URL` | Vercel | 前端访问媒体服务器的 URL | `https://media.example.com/pis-photos` |
| `STORAGE_TYPE` | Worker | 存储类型 | `minio` |
| `STORAGE_ENDPOINT` | Worker | 存储服务器地址（内网） | `minio` (Docker) 或 `localhost` (本地) |
| `STORAGE_PORT` | Worker | 存储服务器端口 | `9000` |
| `STORAGE_USE_SSL` | Worker | 是否使用 SSL | `false` |
| `STORAGE_ACCESS_KEY` | Worker | 存储访问密钥 | `albert` |
| `STORAGE_SECRET_KEY` | Worker | 存储密钥 | `Zjy-1314` |
| `STORAGE_BUCKET` | Worker | 存储桶名称 | `pis-photos` |
| `STORAGE_PUBLIC_URL` | Worker | 存储公网 URL（生成 presigned URL） | `https://media.example.com` |
| `MINIO_PUBLIC_URL` | Worker | MinIO 公网 URL（兼容） | `https://media.example.com` |

**重要说明**:
- `STORAGE_ENDPOINT`: Worker 服务器使用 Docker 服务名 `minio`，本地开发使用 `localhost`
- `STORAGE_PUBLIC_URL`: 必须使用公网 HTTPS 域名，用于生成 presigned URL
- `NEXT_PUBLIC_MEDIA_URL`: 前端访问 URL，必须使用 HTTPS

### Worker 服务配置

| 变量名 | 位置 | 说明 | 示例值 |
|--------|------|------|--------|
| `WORKER_URL` | Worker | Worker 服务 URL（日志用） | `https://worker.example.com` |
| `NEXT_PUBLIC_WORKER_URL` | Vercel | Worker API 公网 URL | `https://worker.example.com` |
| `WORKER_API_KEY` | Vercel/Worker | Worker API 认证密钥 | `14566ade4b1a...` |
| `HTTP_PORT` | Worker | Worker HTTP 端口 | `3001` |
| `WORKER_BIND_HOST` | Worker | Worker 绑定地址 | `0.0.0.0` (允许 frpc 访问) |

### Redis 配置

| 变量名 | 位置 | 说明 | 示例值 |
|--------|------|------|--------|
| `REDIS_HOST` | Worker | Redis 服务器地址 | `redis` (Docker) 或 `localhost` (本地) |
| `REDIS_PORT` | Worker | Redis 端口 | `6379` |
| `REDIS_PASSWORD` | Worker | Redis 密码（可选） | 空或密码字符串 |

### 图片处理配置

| 变量名 | 位置 | 说明 | 默认值 |
|--------|------|------|--------|
| `PREVIEW_MAX_SIZE` | Worker | 预览图最大尺寸（像素） | `1920` |
| `THUMB_MAX_SIZE` | Worker | 缩略图最大尺寸（像素） | `250` |

### Cloudflare 配置

| 变量名 | 位置 | 说明 | 示例值 |
|--------|------|------|--------|
| `CLOUDFLARE_API_TOKEN` | Vercel/Worker | Cloudflare API Token | `eefd8ypDgq_kJO2OivNQy7VFU6qj12KM7c1u03k3` |
| `CLOUDFLARE_ZONE_ID` | Vercel/Worker | Cloudflare Zone ID | `55be2d2f25313170ff6a622cda4c37ec` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel | Turnstile 站点密钥 | `0x4AAAAAAA5vowVVc5g_-Gxl` |
| `TURNSTILE_SECRET_KEY` | Vercel | Turnstile 密钥 | `0x4AAAAAAA5vowGPXhxUGUkqVTMvC-YaLNk` |

---

## 配置检查清单

### Vercel 配置检查

- [ ] `DATABASE_TYPE=postgresql` 已设置
- [ ] PostgreSQL 连接配置已正确设置
- [ ] `AUTH_JWT_SECRET` 已配置（至少 32 字符）
- [ ] `NEXT_PUBLIC_MEDIA_URL` 使用 HTTPS
- [ ] `NEXT_PUBLIC_WORKER_URL` 使用 HTTPS
- [ ] `WORKER_API_KEY` 与 Worker 服务器一致

### Worker 服务器配置检查

- [ ] `MINIO_ENDPOINT_HOST=minio` (Docker 服务名)
- [ ] `REDIS_HOST=redis` (Docker 服务名)
- [ ] `STORAGE_PUBLIC_URL` 使用 HTTPS 公网域名
- [ ] `WORKER_BIND_HOST=0.0.0.0` (允许 frpc 访问)
- [ ] `WORKER_API_KEY` 与 Vercel 配置一致

### frpc 配置检查

- [ ] `pis-worker` 代理: `worker.example.com` → `127.0.0.1:3001`
- [ ] `pis-media` 代理: `media.example.com` → `127.0.0.1:19000`
- [ ] frpc 服务正常运行

### Docker 服务检查

```bash
# 检查服务状态
docker ps | grep -E 'pis|minio|redis'

# 检查网络
docker network inspect pis-network

# 检查端口映射
docker port pis-worker
docker port pis-minio
```

---

## 常见配置错误

### 1. Worker 无法连接 MinIO

**错误配置**:
```bash
MINIO_ENDPOINT_HOST=192.168.50.10  # ❌ 错误：使用 IP 地址
```

**正确配置**:
```bash
MINIO_ENDPOINT_HOST=minio          # ✅ 正确：使用 Docker 服务名
```

### 2. 前端无法访问媒体服务器

**错误配置**:
```bash
NEXT_PUBLIC_MEDIA_URL=http://media.example.com/pis-photos  # ❌ 错误：使用 HTTP
```

**正确配置**:
```bash
NEXT_PUBLIC_MEDIA_URL=https://media.example.com/pis-photos  # ✅ 正确：使用 HTTPS
```

### 3. Presigned URL 签名不匹配

**错误配置**:
```bash
STORAGE_PUBLIC_URL=http://192.168.50.10:19000  # ❌ 错误：使用内网地址
```

**正确配置**:
```bash
STORAGE_PUBLIC_URL=https://media.example.com  # ✅ 正确：使用公网 HTTPS 域名
```

### 4. Worker API 认证失败

**错误**: Vercel 和 Worker 服务器的 `WORKER_API_KEY` 不一致

**解决**: 确保两个环境使用相同的密钥

---

## 环境变量生成指南

### 生成 Worker API Key

```bash
# 方法 1: 使用 openssl
openssl rand -hex 32

# 方法 2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法 3: 使用在线密码生成器（至少 32 字符）
```

### 生成 JWT Secret

```bash
# 方法 1: 使用 openssl
openssl rand -hex 32

# 方法 2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法 3: 使用在线密码生成器（至少 32 字符）
```

### 配置 PostgreSQL 数据库

1. **创建数据库**:
   ```sql
   CREATE DATABASE pis;
   CREATE USER pis WITH PASSWORD 'your-secure-password';
   GRANT ALL PRIVILEGES ON DATABASE pis TO pis;
   ```

2. **运行数据库迁移**:
   ```bash
   # 参考 docs/RESET_DATABASE.md
   psql -U pis -d pis -f docker/init-postgresql-db.sql
   ```

### 获取 Cloudflare 配置

1. **API Token**:
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - My Profile → API Tokens → Create Token
   - 权限: Zone → Cache Purge → Purge

2. **Zone ID**:
   - 选择域名 → 右侧边栏找到 Zone ID

---

## 更新和维护

### 更新环境变量

#### Vercel
1. 登录 Vercel Dashboard
2. 进入项目 → Settings → Environment Variables
3. 添加或修改变量
4. 重新部署应用

#### Worker 服务器
```bash
# 1. 编辑环境变量文件
ssh root@192.168.50.10
vi /opt/PIS/docker/.env

# 2. 重启 Worker 服务
cd /opt/PIS/docker
docker-compose restart worker

# 3. 验证配置
docker-compose exec worker env | grep MINIO
```

### 备份环境变量

```bash
# 备份 Worker 服务器配置
ssh root@192.168.50.10 "cp /opt/PIS/docker/.env /opt/PIS/docker/.env.backup.$(date +%Y%m%d)"

# 备份 frpc 配置
ssh root@192.168.50.10 "cp /opt/1panel/apps/frpc/frpc/data/frpc.toml /opt/1panel/apps/frpc/frpc/data/frpc.toml.backup.$(date +%Y%m%d)"
```

---

## 相关文档

- [架构文档](./ARCHITECTURE.md)
- [部署指南](./i18n/zh-CN/DEPLOYMENT.md)
- [存储配置](./i18n/zh-CN/STORAGE_CONFIG.md)
