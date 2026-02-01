# PIS 架构 - 服务访问路径说明

> 最后更新: 2026-01-31

## 🎯 核心原则

**所有服务都通过 Next.js Web 容器的路径访问，不直接暴露端口！**

## 📊 架构图

```
Internet
   ↓
[8081] pis-web:3000 (唯一对外端口)
   ↓
Next.js API Routes (统一入口)
   ├──→ / → Next.js 前端应用
   ├──→ /api/* → Next.js API
   ├──→ /media/* → 代理到 pis-minio:9000
   ├──→ /minio-console/* → 代理到 pis-minio:9001
   └──→ /api/worker/* → 代理到 pis-worker:3001
   ↓
Docker 内部网络 (pis-network)
   ├──→ pis-postgres:5432 (仅内部)
   ├──→ pis-minio:9000/9001 (仅内部)
   ├──→ pis-redis:6379 (仅内部)
   └──→ pis-worker:3001 (仅内部)
```

## 🔌 端口暴露情况

### ✅ 唯一对外暴露的端口

| 容器 | 端口映射 | 说明 |
|------|---------|------|
| `pis-web` | `8081:3000` | ✅ **唯一对外端口** |

### ❌ 不暴露端口的容器（仅内部访问）

| 容器 | 内部端口 | 访问方式 |
|------|---------|---------|
| `pis-postgres` | 5432 | 仅 Docker 内部网络访问 |
| `pis-minio` | 9000 (API) | 通过 `/media/*` 路径访问 |
| `pis-minio` | 9001 (Console) | 通过 `/minio-console/*` 路径访问 |
| `pis-redis` | 6379 | 仅 Docker 内部网络访问 |
| `pis-worker` | 3001 | 通过 `/api/worker/*` 路径访问 |

## 🌐 服务访问路径

### 1. Next.js 前端应用

```
http://localhost:8081/
```

**说明**：直接访问根路径，Next.js 处理所有前端路由。

---

### 2. Next.js API

```
http://localhost:8081/api/*
```

**示例**：
- `http://localhost:8081/api/auth/login`
- `http://localhost:8081/api/admin/albums`
- `http://localhost:8081/api/public/albums`

**说明**：所有 API 请求都通过 `/api/` 路径，由 Next.js API Routes 处理。

---

### 3. 媒体文件（MinIO）

```
http://localhost:8081/media/*
```

**示例**：
- `http://localhost:8081/media/processed/photo.jpg`
- `http://localhost:8081/media/raw/original.jpg`

**实现**：通过 `apps/web/src/app/media/[...path]/route.ts` 代理到 `pis-minio:9000`

**说明**：
- ✅ 支持 GET、HEAD、OPTIONS
- ✅ 支持 CORS（跨域访问）
- ✅ 支持缓存（7天）
- ✅ 支持流式传输（大文件）

---

### 4. MinIO Console（管理界面）

```
http://localhost:8081/minio-console/*
```

**示例**：
- `http://localhost:8081/minio-console/`
- `http://localhost:8081/minio-console/login`

**实现**：通过 `apps/web/src/app/minio-console/[...path]/route.ts` 代理到 `pis-minio:9001`

**说明**：
- ✅ 支持 GET、POST、PUT、DELETE
- ⚠️ **WebSocket 不完全支持**（Next.js API Routes 限制）
- 💡 **建议**：如需完整 WebSocket 支持，可临时暴露端口 `127.0.0.1:9001:9001`

---

### 5. Worker API

```
http://localhost:8081/api/worker/*
```

**示例**：
- `http://localhost:8081/api/worker/health`
- `http://localhost:8081/api/worker/presign`
- `http://localhost:8081/api/worker/package`

**实现**：通过 `apps/web/src/app/api/worker/[...path]/route.ts` 代理到 `pis-worker:3001`

**说明**：
- ✅ 需要用户认证（登录）
- ✅ 自动添加 Worker API Key
- ✅ 支持所有 HTTP 方法

---

### 6. 健康检查

```
http://localhost:8081/health
```

**说明**：Next.js 健康检查端点，用于监控服务状态。

---

## 🔒 安全优势

### 1. 最小化攻击面

- ✅ 只暴露 1 个端口（8081）
- ✅ 其他服务完全隐藏，无法从外部直接访问
- ✅ 减少被扫描和攻击的风险

### 2. 统一入口

- ✅ 所有请求都经过 Next.js，可以统一处理：
  - 认证和授权
  - 速率限制
  - 日志记录
  - 错误处理

### 3. 网络隔离

- ✅ 所有容器在同一 Docker 网络（`pis-network`）
- ✅ 容器间可以通过容器名通信
- ✅ 外部无法直接访问内部服务

## 📝 配置验证

### 检查端口暴露

```bash
# 查看所有暴露的端口
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep pis-

# 应该只看到：
# pis-web    0.0.0.0:8081->3000/tcp
```

### 检查内部网络

```bash
# 查看网络中的容器
docker network inspect pis-network | grep -A 5 Containers

# 应该看到所有 6 个容器都在同一网络中
```

### 测试路径访问

```bash
# 测试前端
curl http://localhost:8081/

# 测试 API
curl http://localhost:8081/api/health

# 测试媒体文件（如果存在）
curl http://localhost:8081/media/processed/test.jpg

# 测试 Worker API（需要认证）
curl http://localhost:8081/api/worker/health
```

## ⚠️ 常见错误

### ❌ 错误：直接访问容器端口

```bash
# ❌ 错误：无法访问（端口未暴露）
curl http://localhost:9000/minio/health/live
curl http://localhost:3001/health
curl http://localhost:5432
```

### ✅ 正确：通过 Next.js 路径访问

```bash
# ✅ 正确：通过路径访问
curl http://localhost:8081/media/processed/test.jpg
curl http://localhost:8081/api/worker/health
curl http://localhost:8081/minio-console/
```

## 🎯 总结

✅ **所有服务都通过 Next.js Web 容器的路径访问**

- `/` → Next.js 前端
- `/api/*` → Next.js API
- `/media/*` → MinIO 媒体文件（代理）
- `/minio-console/*` → MinIO Console（代理）
- `/api/worker/*` → Worker API（代理）

❌ **不直接暴露其他容器的端口**

- `pis-postgres:5432` → 仅内部访问
- `pis-minio:9000/9001` → 仅内部访问（通过路径访问）
- `pis-redis:6379` → 仅内部访问
- `pis-worker:3001` → 仅内部访问（通过路径访问）

🔒 **安全原则**：最小权限原则，只暴露必要的端口
