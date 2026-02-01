# Docker 网络和端口暴露策略

> 最后更新: 2026-01-31

## 🎯 核心问题

**如果有 `pis-nginx` 容器，是否只需要暴露一个端口（80/443），其他容器通过内部网络传输？**

**答案：是的！** ✅

## 📊 当前端口暴露情况

### Standalone 模式（Nginx 功能已集成到 Web 容器）

| 容器 | 暴露端口 | 绑定地址 | 说明 |
|------|---------|---------|------|
| `pis-web` | `8081:3000` | `0.0.0.0` | ✅ **唯一对外暴露的端口**（配合内网穿透） |
| `pis-postgres` | ❌ 无 | - | ✅ 仅内部网络访问 |
| `pis-minio` | ❌ 无 | - | ✅ 仅内部网络访问（通过 Next.js 代理） |
| `pis-redis` | ❌ 无 | - | ✅ 仅内部网络访问 |
| `pis-worker` | ❌ 无 | - | ✅ 仅内部网络访问（通过 Next.js 代理） |

### 结论

✅ **是的，只需要暴露一个端口（8081）！**

所有服务通过 Next.js Web 容器统一入口访问：
- `/` - Next.js 前端应用
- `/api/` - Next.js API
- `/media/` - MinIO 媒体文件（通过 Next.js API Route 代理）
- `/minio-console/` - MinIO 管理控制台（通过 Next.js API Route 代理）
- `/api/worker/` - Worker API（通过 Next.js API Route 代理）

其他容器（`pis-postgres`、`pis-minio`、`pis-redis`、`pis-worker`）**不对外暴露端口**，通过 Docker 内部网络（`pis-network`）通信。

## 🔗 Docker 内部网络通信

### 网络架构

```
Internet
   ↓
[8081] pis-web:3000 (唯一对外端口)
   ↓
Next.js API Routes (代理)
   ├──→ /media/* → pis-minio:9000 (内部)
   ├──→ /minio-console/* → pis-minio:9001 (内部)
   └──→ /api/worker/* → pis-worker:3001 (内部)
   ↓
Docker 内部网络 (pis-network)
   ├──→ pis-postgres:5432 (内部)
   ├──→ pis-minio:9000/9001 (内部)
   ├──→ pis-redis:6379 (内部)
   └──→ pis-worker:3001 (内部)
```

### Nginx 配置示例

```nginx
# docker/nginx/conf.d/default.conf

# 上游服务器（使用容器名，Docker DNS 自动解析）
upstream pis_web {
    server pis-web:3000;  # ✅ 使用容器名，内部网络
}

upstream pis_minio {
    server pis-minio:9000;  # ✅ 使用容器名，内部网络
}

# Worker API（内部网络）
location /api/worker/ {
    proxy_pass http://pis-worker:3001/;  # ✅ 使用容器名，内部网络
}
```

## 🔒 安全优势

### 1. 最小化攻击面

- ✅ 只暴露 80/443 端口
- ✅ 其他服务（PostgreSQL、Redis、MinIO）不对外暴露
- ✅ 减少被扫描和攻击的风险

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

### 3. 端口绑定策略

```yaml
# 对外暴露（Nginx）
nginx:
  ports:
    - "80:80"      # 0.0.0.0:80（所有接口）
    - "443:443"    # 0.0.0.0:443（所有接口）

# 仅本地调试（可选）
postgres:
  ports:
    - "127.0.0.1:5432:5432"  # 仅本地回环接口

# 不暴露（推荐）
web:
  # 无 ports 配置，仅内部网络访问
```

## 📝 端口暴露策略说明

### 当前配置分析

#### ✅ 必须暴露的端口

**Web（唯一对外端口，集成 Nginx 功能）**：
```yaml
web:
  ports:
    - "8081:3000"    # HTTP（配合 frpc/ddnsto 内网穿透）
    # HTTPS 由内网穿透服务处理，不需要暴露 443
```

#### ⚠️ 可选暴露的端口（仅用于调试）

**PostgreSQL**：
```yaml
postgres:
  ports:
    - "127.0.0.1:5432:5432"  # 仅本地访问，用于数据库管理工具
```

**MinIO**：
```yaml
minio:
  ports:
    - "127.0.0.1:9000:9000"  # API，仅本地访问
    - "127.0.0.1:9001:9001"  # Console，仅本地访问
```

**Redis**：
```yaml
redis:
  ports:
    - "127.0.0.1:6379:6379"  # 仅本地访问，用于 Redis 客户端
```

#### ✅ 不暴露的端口（仅内部网络）

**PostgreSQL**：
```yaml
postgres:
  # 无 ports 配置
  # 仅内部网络访问
```

**MinIO**：
```yaml
minio:
  # 无 ports 配置
  # 通过 Next.js API Route 代理访问
```

**Redis**：
```yaml
redis:
  # 无 ports 配置
  # 仅内部网络访问
```

**Worker**：
```yaml
worker:
  # 无 ports 配置
  # 通过 Next.js API Route 代理访问
```

## 🎯 最佳实践建议

### 生产环境（推荐）

**完全隐藏内部服务**：
```yaml
services:
  web:
    ports:
      - "8081:3000"    # HTTP（配合内网穿透）
      # HTTPS 由内网穿透服务处理
  
  postgres:
    # 不暴露端口，完全内部访问
  
  minio:
    # 不暴露端口，通过 Next.js API Route 代理
  
  redis:
    # 不暴露端口，完全内部访问
  
  worker:
    # 不暴露端口，通过 Next.js API Route 代理
```

**优点**：
- ✅ 最大安全性
- ✅ 最小攻击面
- ✅ 统一入口（Nginx）

**缺点**：
- ❌ 无法直接访问数据库/Redis 进行调试
- ❌ 无法直接访问 MinIO Console

### 开发/调试环境（可选）

**暴露调试端口**：
```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"  # 仅本地
  
  minio:
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"  # Console
  
  redis:
    ports:
      - "127.0.0.1:6379:6379"
```

**优点**：
- ✅ 可以使用数据库管理工具（pgAdmin、DBeaver）
- ✅ 可以访问 MinIO Console
- ✅ 可以使用 Redis 客户端

**缺点**：
- ⚠️ 增加了攻击面（虽然仅本地）

## 🔍 验证网络连接

### 检查容器网络

```bash
# 查看网络
docker network inspect pis-network

# 查看容器 IP
docker inspect pis-web | grep IPAddress
docker inspect pis-worker | grep IPAddress
docker inspect pis-minio | grep IPAddress
```

### 测试内部网络连接

```bash
# 从 nginx 容器测试 web 容器
docker exec pis-nginx wget -O- http://pis-web:3000/health

# 从 web 容器测试 worker 容器
docker exec pis-web wget -O- http://pis-worker:3001/health

# 从 worker 容器测试 minio 容器
docker exec pis-worker wget -O- http://pis-minio:9000/minio/health/live
```

## 📋 总结

### ✅ 核心答案

**是的，只需要暴露一个端口（8081）！**

- ✅ **唯一对外端口**: 8081（Web 容器，集成 Nginx 功能）
- ✅ **内部通信**: 所有容器通过 `pis-network` 内部网络通信
- ✅ **容器名解析**: Docker DNS 自动解析容器名（如 `pis-web`、`pis-worker`）
- ✅ **代理功能**: Next.js API Routes 代理媒体文件、MinIO Console、Worker API
- ✅ **安全性**: 最小化攻击面，其他服务不对外暴露

### 📊 端口暴露对比

| 服务 | 无代理 | 当前（Next.js 集成） | 推荐 |
|------|--------|---------------------|------|
| Web | 3000 | 8081（HTTP） | ✅ |
| Worker | 3001 | 无（通过 Next.js 代理） | ✅ |
| MinIO | 9000/9001 | 无（通过 Next.js 代理） | ✅ |
| PostgreSQL | 5432 | 无（内部） | ✅ |
| Redis | 6379 | 无（内部） | ✅ |

**注意**：HTTPS（443）由内网穿透服务（frpc/ddnsto）处理，PIS 容器内不需要暴露。

### 🎯 最佳实践

1. **生产环境**: 只暴露 Web 容器的 8081，其他服务完全内部访问
2. **开发环境**: 可选暴露调试端口（127.0.0.1），仅本地访问
3. **安全原则**: 最小权限原则，只暴露必要的端口
4. **代理功能**: 使用 Next.js API Routes 统一代理所有服务
