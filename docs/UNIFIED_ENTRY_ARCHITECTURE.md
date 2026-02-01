# 统一入口架构设计

> 最后更新: 2026-01-31

## 🎯 核心设计原则

**统一入口，容器之间调用数据，内部解决，避免多路径**

## ✅ 架构设计确认

### 设计原则

1. **统一入口**：所有外部请求通过 Next.js Web 容器（8081 端口）
2. **内部通信**：容器之间通过 Docker 内部网络（`pis-network`）通信
3. **避免多路径**：不对外暴露多个端口，统一管理

---

## 📊 当前架构

### 外部访问（统一入口）

```
Internet
   ↓
[frpc/ddnsto] 内网穿透
   ↓
[8081] Web (Next.js，唯一对外端口)
   ↓
Next.js API Routes (统一入口)
   ├──→ / → Next.js 前端应用
   ├──→ /api/* → Next.js API
   ├──→ /media/* → 代理到 pis-minio:9000
   ├──→ /minio-console/* → 代理到 pis-minio:9001
   └──→ /api/worker/* → 代理到 pis-worker:3001
   ↓
Docker 内部网络 (pis-network)
```

### 容器间通信（内部网络）

```
Web (8081，统一入口)
   ├──→ PostgreSQL (5432) - 内部网络: postgres:5432
   ├──→ Worker (3001) - 内部网络: worker:3001 (通过 API Route 代理)
   ├──→ MinIO (9000) - 内部网络: minio:9000 (通过 API Route 代理)
   └──→ Redis (6379) - 内部网络: redis:6379

Worker (3001)
   ├──→ PostgreSQL (5432) - 内部网络: postgres:5432
   ├──→ MinIO (9000) - 内部网络: minio:9000
   └──→ Redis (6379) - 内部网络: redis:6379
```

---

## 🔍 详细分析

### 1. 统一入口（Next.js Web 容器）

**对外暴露**：
- ✅ **唯一端口**：8081（HTTP）
- ✅ **HTTPS**：由内网穿透处理

**内部代理**（通过 Next.js API Routes）：
- ✅ `/` → Next.js 前端应用
- ✅ `/api/*` → Next.js API Routes
- ✅ `/media/*` → 代理到 `pis-minio:9000`（MinIO 媒体文件）
- ✅ `/minio-console/*` → 代理到 `pis-minio:9001`（MinIO Console）
- ✅ `/api/worker/*` → 代理到 `pis-worker:3001`（Worker API）

**优点**：
- ✅ 统一管理所有路由
- ✅ 便于监控和日志
- ✅ 可以统一添加安全头、CORS 等
- ✅ 减少容器数量（6 个容器）

---

### 2. 容器间内部通信

#### Web 容器 → 其他服务

**PostgreSQL**：
```typescript
// apps/web/src/lib/database/postgresql-client.ts
DATABASE_HOST=postgres  // 使用容器名，内部网络
DATABASE_PORT=5432      // 内部端口
```

**Worker**：
```typescript
// apps/web/src/app/api/worker/[...path]/route.ts
WORKER_URL=http://worker:3001  // 使用容器名，内部网络
```

**Redis**（如果使用）：
```typescript
REDIS_HOST=redis  // 使用容器名，内部网络
REDIS_PORT=6379   // 内部端口
```

#### Worker 容器 → 其他服务

**PostgreSQL**：
```typescript
// services/worker/src/index.ts
DATABASE_HOST=postgres  // 使用容器名，内部网络
DATABASE_PORT=5432      // 内部端口
```

**MinIO**：
```typescript
// services/worker/src/lib/storage/minio-adapter.ts
MINIO_ENDPOINT_HOST=minio  // 使用容器名，内部网络
MINIO_ENDPOINT_PORT=9000   // 内部端口
```

**Redis**：
```typescript
// services/worker/src/lib/redis.ts
REDIS_HOST=redis  // 使用容器名，内部网络
REDIS_PORT=6379   // 内部端口
```

---

### 3. 避免多路径

#### ✅ 当前设计（正确）

**外部访问**：
- ✅ 所有请求 → Nginx (8080) → 内部服务
- ✅ 不直接暴露 Web、MinIO、Worker 端口

**容器间通信**：
- ✅ 使用容器名（如 `postgres`, `minio`, `worker`）
- ✅ 通过 Docker 内部网络（`pis-network`）
- ✅ 不通过外部端口

#### ❌ 错误设计（避免）

**多路径暴露**：
```yaml
# ❌ 不推荐：直接暴露多个端口
web:
  ports:
    - "3000:3000"    # 直接暴露 Web
minio:
  ports:
    - "9000:9000"    # 直接暴露 MinIO
worker:
  ports:
    - "3001:3001"    # 直接暴露 Worker
```

**问题**：
- ❌ 多个入口点，难以管理
- ❌ 需要配置多个内网穿透映射
- ❌ 安全风险增加
- ❌ 路由分散

---

## 📋 端口暴露策略

### ✅ 当前配置（正确）

| 容器 | 对外端口 | 内部端口 | 说明 |
|------|---------|---------|------|
| **Web** | 8081 | 3000 | ✅ **唯一对外端口**（集成代理功能） |
| Worker | ❌ 无 | 3001 | ✅ 仅内部访问（通过 Next.js 代理） |
| MinIO | ❌ 无 | 9000/9001 | ✅ 仅内部访问（通过 Next.js 代理） |
| PostgreSQL | ❌ 无 | 5432 | ✅ 仅内部访问 |
| Redis | ❌ 无 | 6379 | ✅ 仅内部访问 |

### 容器间通信（内部网络）

| 服务 | 目标服务 | 使用地址 | 说明 |
|------|---------|---------|------|
| Web | PostgreSQL | `postgres:5432` | ✅ 容器名，内部网络 |
| Web | Worker | `worker:3001` | ✅ 容器名，内部网络（通过 API Route 代理） |
| Web | Redis | `redis:6379` | ✅ 容器名，内部网络 |
| Worker | PostgreSQL | `postgres:5432` | ✅ 容器名，内部网络 |
| Worker | MinIO | `minio:9000` | ✅ 容器名，内部网络 |
| Worker | Redis | `redis:6379` | ✅ 容器名，内部网络 |

---

## 🔒 安全优势

### 1. 最小攻击面

- ✅ **只暴露一个端口**：8080（Nginx）
- ✅ **其他服务不对外暴露**：无法从外部直接访问
- ✅ **减少被扫描和攻击的风险**

### 2. 网络隔离

```yaml
networks:
  pis-network:
    driver: bridge
    name: pis-network
```

- ✅ 所有容器在同一网络内
- ✅ 容器间可以通过容器名通信
- ✅ 外部无法直接访问内部服务

### 3. 统一管理

- ✅ 所有流量通过 Nginx
- ✅ 统一日志和监控
- ✅ 统一安全策略（CORS、缓存、安全头）

---

## 📝 配置示例

### Docker Compose 配置

```yaml
networks:
  pis-network:
    driver: bridge
    name: pis-network

services:
  # 唯一对外暴露的容器（集成代理功能）
  web:
    ports:
      - "8081:3000"    # 唯一对外端口
    environment:
      - DATABASE_HOST=postgres      # 内部网络
      - DATABASE_PORT=5432          # 内部端口
      - WORKER_URL=http://worker:3001  # 内部网络
      - MINIO_ENDPOINT_HOST=minio   # 内部网络（用于代理）
      - MINIO_ENDPOINT_PORT=9000    # 内部端口
    networks:
      - pis-network

  worker:
    # 无 ports 配置
    environment:
      - DATABASE_HOST=postgres      # 内部网络
      - MINIO_ENDPOINT_HOST=minio   # 内部网络
      - REDIS_HOST=redis            # 内部网络
    networks:
      - pis-network

  postgres:
    # 无 ports 配置（或仅 127.0.0.1，用于调试）
    networks:
      - pis-network

  minio:
    # 无 ports 配置（或仅 127.0.0.1，用于调试）
    networks:
      - pis-network

  redis:
    # 无 ports 配置（或仅 127.0.0.1，用于调试）
    networks:
      - pis-network
```

---

## 🎯 设计原则总结

### ✅ 正确设计

1. **统一入口**
   - ✅ 所有外部请求 → Next.js Web 容器 (8081)
   - ✅ 通过 Next.js API Routes 统一代理
   - ✅ 不直接暴露其他服务端口

2. **内部通信**
   - ✅ 容器间使用容器名通信
   - ✅ 通过 Docker 内部网络（`pis-network`）
   - ✅ 不通过外部端口

3. **避免多路径**
   - ✅ 只有一个对外入口（Nginx）
   - ✅ 路由统一管理
   - ✅ 便于监控和维护

### ❌ 错误设计（避免）

1. **多路径暴露**
   - ❌ 直接暴露 Web、MinIO、Worker 端口
   - ❌ 多个入口点
   - ❌ 路由分散

2. **外部端口通信**
   - ❌ 容器间通过外部端口通信
   - ❌ 增加网络延迟
   - ❌ 增加安全风险

---

## 📊 架构对比

### ✅ 当前架构（统一入口）

```
Internet
   ↓
[8081] Web (Next.js，唯一入口)
   ├──→ / → Next.js 前端应用
   ├──→ /api/* → Next.js API Routes
   ├──→ /media/* → 代理到 pis-minio:9000
   ├──→ /minio-console/* → 代理到 pis-minio:9001
   └──→ /api/worker/* → 代理到 pis-worker:3001

Web (内部通信)
   ├──→ PostgreSQL (内部: postgres:5432)
   ├──→ Worker (内部: worker:3001，通过 API Route 代理)
   ├──→ MinIO (内部: minio:9000，通过 API Route 代理)
   └──→ Redis (内部: redis:6379)

Worker (内部通信)
   ├──→ PostgreSQL (内部: postgres:5432)
   ├──→ MinIO (内部: minio:9000)
   └──→ Redis (内部: redis:6379)
```

**优点**：
- ✅ 统一入口（Next.js Web 容器）
- ✅ 内部通信（Docker 内部网络）
- ✅ 避免多路径（只暴露一个端口）
- ✅ 安全性高（最小攻击面）
- ✅ 容器数量少（6 个容器）

### ❌ 错误架构（多路径）

```
Internet
   ├──→ [3000] Web (直接暴露)
   ├──→ [9000] MinIO (直接暴露)
   └──→ [3001] Worker (直接暴露)

Web
   └──→ PostgreSQL (通过外部端口: localhost:5432)
```

**缺点**：
- ❌ 多个入口点
- ❌ 需要多个内网穿透映射
- ❌ 路由分散
- ❌ 安全风险高

---

## ✅ 结论

**你的理解完全正确！** ✅

**设计原则**：
1. ✅ **统一入口**：所有外部请求通过 Next.js Web 容器 (8081)
2. ✅ **内部通信**：容器之间通过 Docker 内部网络通信
3. ✅ **避免多路径**：不对外暴露多个端口

**当前架构已正确实现**：
- ✅ Web 容器是唯一对外端口（8081）
- ✅ 所有服务通过 Next.js API Routes 统一代理
- ✅ 容器间使用容器名通信（`postgres`, `minio`, `worker`, `redis`）
- ✅ 通过 Docker 内部网络（`pis-network`）
- ✅ 不通过外部端口

**这是最佳实践**：
- ✅ 安全性高（最小攻击面）
- ✅ 易于管理（统一入口）
- ✅ 性能好（内部网络通信）
- ✅ 架构清晰（职责分离）
