# PIS 部署指南

> 作者: junyuzhan (junyuzhan@outlook.com)
> 许可证: MIT

## 目录

1. [快速开始（一键部署）](#快速开始一键部署) - 最快的部署方式
2. [架构概览](#架构概览)
3. [前置要求](#前置要求)
4. [Supabase 配置](#supabase-配置)
5. [本地开发环境](#本地开发环境)
6. [生产环境部署](#生产环境部署)
7. [环境变量配置](#环境变量配置)
8. [验证与测试](#验证与测试)
9. [维护与运维](#维护与运维)
10. [故障排除](#故障排除)

---

## 快速开始（一键部署）

> **在服务器上部署 PIS 的最快方式**

### 引导式部署脚本

新的引导式部署脚本提供交互式设置体验，并自动生成所有安全密钥。

**SSH 登录服务器后运行：**

```bash
# 克隆仓库
git clone https://github.com/JunyuZhan/pis-standalone.git
cd pis-standalone

# 运行引导式部署（交互式）
bash docker/deploy.sh
```

**或从本地机器部署：**

```bash
git clone https://github.com/JunyuZhan/pis-standalone.git
cd pis-standalone

# 部署到远程服务器
bash docker/deploy.sh <服务器IP> <SSH用户>
# 示例: bash docker/deploy.sh 192.168.1.100 root
```

### 部署模式

脚本将引导您选择两种部署模式之一：

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| **完全独立**（推荐） | 全部服务容器化（PostgreSQL + MinIO + Redis + Web + Worker + Nginx） | 完全自托管，数据隐私 |
| **混合模式**（可选） | Vercel（前端）+ Supabase（数据库）+ 您的服务器（存储/Worker） | 快速搭建，云端前端 |

### 部署流程

```
步骤 1: 选择部署模式（混合 / 独立）
步骤 2: 安装环境（Docker、Git）
步骤 3: 配置数据库（PostgreSQL 凭证，或可选的 Supabase URL）
步骤 4: 配置存储（MinIO / 云存储）
步骤 5: 自动生成安全密钥
步骤 6: 构建并启动服务
步骤 7: 配置 SSL/TLS（Let's Encrypt）
步骤 8: 验证部署
```

### 自动生成的密钥

部署脚本会自动生成以下安全随机值：
- `STORAGE_ACCESS_KEY`、`STORAGE_SECRET_KEY`（MinIO 凭证）
- `WORKER_API_KEY`（Worker API 认证）
- `ALBUM_SESSION_SECRET`（JWT 会话签名）
- `REDIS_PASSWORD`（Redis 认证）
- `POSTGRES_PASSWORD`（独立模式的 PostgreSQL 密码）

### 数据库选项

| 类型 | 推荐用于 | 特性 |
|------|---------|------|
| **PostgreSQL**（推荐） | 独立部署 | 自托管，本地 Docker，完全控制 |
| **Supabase**（可选） | 混合部署 | 云端托管，包含认证，需要网络连接 |
| **MySQL** | 独立部署 | 自托管，本地 Docker |

### PostgreSQL 配置（推荐）

PostgreSQL 是默认和推荐的数据库选项，提供完全的数据控制：

```bash
# 数据库连接信息
DATABASE_HOST=postgres          # Docker 服务名或主机地址
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=AUTO_GENERATE # 由部署脚本自动生成
```

### 获取 Supabase 凭证（可选，混合模式）

如果选择混合模式，需要 Supabase 凭证：

1. 访问 https://supabase.com/dashboard
2. 选择项目 → **Settings** → **API**
3. 复制 **Project URL** 和 **service_role key**

### 服务器要求

- **系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 7+
- **配置**:
  - 混合模式: 1 核 1GB 内存最低
  - 独立模式: 2 核 2GB 内存最低，推荐 4GB
- **端口**:
  - 独立模式: 80 (HTTP)、443 (HTTPS)
  - 混合模式: 9000、9001、3001（可内网访问）

### 部署后配置

#### 独立模式

所有服务通过您的域名访问：
```
https://yourdomain.com          # 主应用
https://yourdomain.com/media    # 媒体文件
```

#### 混合模式

1. **访问 MinIO 控制台**（如果使用 MinIO）：
   ```
   http://your-server-ip:9001
   ```

2. **初始化数据库架构**（PostgreSQL）：
   ⚠️ **重要**：在 PostgreSQL 数据库中执行数据库迁移脚本（`docker/init-postgresql-db.sql`）。

3. **部署前端到 Vercel**：
   - 连接 GitHub 仓库
   - 配置环境变量
   - 部署

### 常用命令

```bash
# 独立模式 - 查看日志
cd /opt/pis/docker && docker-compose -f docker-compose.standalone.yml logs -f

# 独立模式 - 重启服务
cd /opt/pis/docker && docker-compose -f docker-compose.standalone.yml restart

# 更新代码
cd /opt/pis && git pull && cd docker && docker-compose -f docker-compose.standalone.yml up -d --build
```

### 快速故障排除

**问：部署失败？**

```bash
cd /opt/pis/docker && docker-compose -f docker-compose.standalone.yml logs
```

**问：端口已被占用？**

```bash
ss -tuln | grep -E ":(80|443|9000|9001|3001)"
```

> 💡 **需要更多细节？** 继续阅读下面的完整部署指南。

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              互联网                                      │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────────────────────┐
│    Vercel     │    │   Supabase    │    │        内网服务器              │
│  (Next.js)    │    │    Cloud      │    │                               │
│               │    │               │    │  ┌─────────┐  ┌─────────────┐ │
│  • 前端页面    │    │  • PostgreSQL │    │  │  MinIO  │  │   Worker    │ │
│  • API Routes │    │  • Auth       │    │  │ (存储)   │  │ (图片处理)  │ │
│  • SSR/SSG    │    │  • Realtime   │    │  └─────────┘  └─────────────┘ │
│               │    │               │    │       ▲              │        │
└───────┬───────┘    └───────┬───────┘    │       └──────────────┘        │
        │                    │            │              Redis            │
        │                    │            │           (任务队列)           │
        └────────────────────┴────────────┴───────────────────────────────┘
```

| 组件 | 部署位置 | 用途 |
|------|---------|------|
| Next.js 前端 | Vercel | 用户界面、API 路由 |
| PostgreSQL | Supabase | 元数据存储 |
| Auth | Supabase | 用户认证 |
| Realtime | Supabase | 实时推送 |
| MinIO | 内网 Docker | 照片存储 |
| Worker | 内网 Docker | 图片处理 |
| Redis | 内网 Docker | 任务队列 |

---

## 前置要求

### 本地开发

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & Docker Compose
- **Git**

### 生产部署

- 一台 Linux 服务器 (推荐 2核4G+)
- 已安装 Docker
- 域名已解析到服务器 (需要两个: 主站 + 媒体)
- Supabase 账号 (免费版即可)
- Vercel 账号 (免费版即可)

---

## Supabase 配置

### 1. 创建项目

1. 访问 [https://supabase.com](https://supabase.com) 并登录
2. 点击 **New Project**
3. 填写项目信息:
   - **Name**: `pis`
   - **Database Password**: 设置强密码并保存
   - **Region**: 选择离你最近的区域 (推荐新加坡)
4. 点击 **Create new project**，等待 2-3 分钟

### 2. 获取 API Keys

进入项目 → **Settings** → **API**，复制以下信息:

| 名称 | 用途 | 示例 |
|------|------|------|
| Project URL | 所有客户端 | `https://xxxxx.supabase.co` |
| anon public | 前端浏览器 | `eyJhbGciOiJIUzI1NiIs...` |
| service_role | Worker 后端 | `eyJhbGciOiJIUzI1NiIs...` (⚠️ 保密!) |

### 3. 执行数据库架构

1. 进入项目 → **SQL Editor**
2. 点击 **New query**
3. 执行数据库迁移脚本（请参考项目文档或 Supabase migrations）
4. 点击 **Run** 执行
5. ✅ 完成！

**或者使用命令行**：
```bash
# 使用 Supabase CLI 或其他迁移工具执行数据库架构
```

### 4. 创建管理员账号

> ⚠️ **重要**：必须先创建管理员账号才能访问管理后台。

**步骤：**

1. 进入 Supabase Dashboard → **Authentication** → **Users**
2. 点击 **Add user** → **Create new user**
3. 填写表单：
   - **Email**: 你的管理员邮箱（例如：`admin@example.com`）
   - **Password**: 设置一个强密码（至少 8 个字符）
   - ✅ **Auto Confirm User**（勾选此项 - 很重要！）
4. 点击 **Create user**
5. ✅ 完成！现在可以使用这个邮箱和密码在 `/admin/login` 登录

**注意**：
- 这里创建的邮箱和密码将用于登录管理后台
- 确保勾选 "Auto Confirm User"，这样你可以立即登录
- 如果需要，可以创建多个管理员账号

### 5. 配置 Auth URLs

1. 进入 **Authentication** → **URL Configuration**
2. 设置:

| 配置项 | 值 |
|--------|-----|
| Site URL | `https://yourdomain.com` |
| Redirect URLs | `https://yourdomain.com/auth/callback` |
| | `http://localhost:3000/auth/callback` |

### 6. 启用 Realtime (可选但推荐)

1. 进入 **Database** → **Replication**
2. 点击 **Tables** 标签
3. 找到 `photos` 表，点击开关启用

---

## 本地开发环境

### 1. 克隆并安装

```bash
git clone https://github.com/your-username/pis.git
cd pis-standalone
pnpm install
```

### 2. 启动基础服务

```bash
cd docker
docker-compose up -d minio redis minio-init
```

验证服务启动:
```bash
docker-compose ps
# 应该看到 pis-minio 和 pis-redis 状态为 Up (healthy)
```

### 3. 配置环境变量

**apps/web/.env:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos
```

**services/worker/.env:**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MinIO (本地 Docker)
MINIO_ENDPOINT_HOST=localhost
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pis-photos

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. 启动开发服务器

```bash
# 终端 1: 启动 Worker
cd services/worker
pnpm dev

# 终端 2: 启动前端
cd ../..   # 回到项目根目录
pnpm dev
```

### 5. 访问应用

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | 前端首页 |
| http://localhost:3000/admin/login | 管理后台登录 |
| http://localhost:9001 | MinIO 控制台 (minioadmin/minioadmin) |

---

## 生产环境部署

### 服务器端 (Docker)

#### 1. 准备服务器

```bash
# 安装 Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 上传项目文件

将以下文件上传到服务器 `/opt/pis/`:

```
/opt/pis/
├── docker/
│   ├── docker-compose.yml
│   ├── worker.Dockerfile
│   └── nginx/
│       └── media.conf
├── services/
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
└── .env
```

#### 3. 配置环境变量

创建 `/opt/pis/.env`:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MinIO (自定义强密码!)
MINIO_ACCESS_KEY=your-strong-access-key
MINIO_SECRET_KEY=your-strong-secret-key-at-least-8-chars

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

#### 4. 启动服务

```bash
cd /opt/pis/docker
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 5. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/media.yourdomain.com`:

```nginx
server {
    listen 80;
    server_name media.yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;

    # SSL 证书 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/media.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media.yourdomain.com/privkey.pem;

    # 允许大文件上传
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 缓存静态资源
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";

        # CORS
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
    }
}
```

启用配置:
```bash
sudo ln -s /etc/nginx/sites-available/media.yourdomain.com /etc/nginx/sites-enabled/
sudo certbot --nginx -d media.yourdomain.com
sudo nginx -t && sudo nginx -s reload
```

### Vercel 部署

#### 1. 连接仓库

1. 访问 [https://vercel.com](https://vercel.com) 并登录
2. 点击 **Add New Project**
3. 选择你的 GitHub 仓库

#### 2. 配置构建

| 配置项 | 值 |
|--------|-----|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `pnpm build` |
| Install Command | `pnpm install` |

#### 3. 配置环境变量

在 **Settings** → **Environment Variables** 添加:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos
```

#### 4. 部署

点击 **Deploy**，等待构建完成。

#### 5. 绑定域名

1. **Settings** → **Domains**
2. 添加 `yourdomain.com`
3. 按提示配置 DNS (CNAME 或 A 记录)

---

## 环境变量配置

### 前端 (Vercel / apps/web/.env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公开密钥 | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | 应用访问地址 | `https://yourdomain.com` |
| `NEXT_PUBLIC_MEDIA_URL` | 媒体 CDN 地址 | `https://media.yourdomain.com/pis-photos` |

### Worker (Docker / .env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥 | `eyJ...` |
| `MINIO_ENDPOINT_HOST` | MinIO 主机 | `minio` (Docker) / `localhost` |
| `MINIO_ENDPOINT_PORT` | MinIO 端口 | `9000` |
| `MINIO_USE_SSL` | 是否使用 SSL | `false` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | 自定义强密码 |
| `MINIO_SECRET_KEY` | MinIO 密钥 | 自定义强密码 (≥8字符) |
| `MINIO_BUCKET` | 存储桶名称 | `pis-photos` |
| `REDIS_HOST` | Redis 主机 | `redis` (Docker) / `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |

---

## 验证与测试

### 1. 检查 Docker 服务

```bash
# 查看服务状态
docker-compose ps

# 预期输出:
# NAME            STATUS
# pis-minio       Up (healthy)
# pis-redis       Up (healthy)
# pis-worker      Up

# MinIO 健康检查
curl http://localhost:9000/minio/health/live
# 预期: OK

# Redis 连接测试
docker exec pis-redis redis-cli ping
# 预期: PONG
```

### 2. 测试完整流程

1. 访问 `https://yourdomain.com/admin/login`
2. 使用管理员账号登录
3. 创建新相册
4. 上传测试图片
5. 观察 Worker 日志: `docker-compose logs -f worker`
6. 确认图片处理完成 (状态变为 completed)
7. 复制相册链接，在无痕模式测试访客访问

### 3. 性能检查

```bash
# Lighthouse 测试
npx lighthouse https://yourdomain.com --view

# 目标指标:
# - FCP < 1.5s
# - LCP < 2.5s
# - Score > 90
```

---

## 维护与运维

### 常用命令

```bash
# 查看日志
docker-compose logs -f [service]

# 重启服务
docker-compose restart [service]

# 更新 Worker 代码
docker-compose build worker
docker-compose up -d worker

# 清理未使用的镜像
docker system prune -a
```

### 数据备份

```bash
# 备份 MinIO 数据
docker run --rm \
  -v pis_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data

# 恢复 MinIO 数据
docker run --rm \
  -v pis_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/minio-backup.tar.gz -C /

# Supabase 数据导出
# 在 Dashboard → Settings → Database → Backups
```

### 监控建议

- **Uptime Kuma**: 监控服务可用性
- **Grafana + Prometheus**: Docker 容器监控
- **Sentry**: 前端错误追踪

---

## 故障排除

### Worker 无法连接 MinIO

```bash
# 检查 Docker 网络
docker network ls
docker-compose exec worker ping minio

# 确认 MinIO 环境变量
docker-compose exec worker env | grep MINIO
```

### 图片无法显示

1. 检查 MinIO Bucket 是否存在且有权限
   ```bash
   docker exec pis-minio mc ls local/pis-photos
   ```
2. 检查 Nginx 反向代理日志
   ```bash
   tail -f /var/log/nginx/error.log
   ```
3. 确认 `NEXT_PUBLIC_MEDIA_URL` 配置正确

### Supabase 连接失败

1. 确认 API Keys 正确 (注意 anon vs service_role)
2. 检查 RLS 策略是否阻止访问
3. 查看 Supabase Dashboard → Logs

### 上传失败

1. 检查 Nginx `client_max_body_size` 配置
2. 确认 MinIO 凭证正确
3. 查看 Worker 日志:
   ```bash
   docker-compose logs -f worker
   ```

### 登录循环问题

1. 清除浏览器 Cookies (所有 `sb-` 开头的)
2. 确认 Supabase Auth URLs 配置正确
3. 检查 Middleware 日志

---

## 安全建议

### 必须做

- [ ] 修改默认 MinIO 密码
- [ ] 使用 HTTPS
- [ ] 服务端口只监听 127.0.0.1
- [ ] 定期备份数据
- [ ] 保护 `SUPABASE_SERVICE_ROLE_KEY`

### 建议做

- [ ] 配置防火墙规则
- [ ] 启用 Supabase MFA
- [ ] 设置日志轮转
- [ ] 配置监控告警

---

## 联系支持

如遇到问题，请:

1. 查看本文档的故障排除部分
2. 搜索 GitHub Issues
3. 提交新 Issue，附上:
   - 错误日志
   - 环境信息 (OS, Docker 版本)
   - 复现步骤
