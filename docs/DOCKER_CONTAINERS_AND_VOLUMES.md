# Docker 容器和存储卷命名规范

> 最后更新: 2026-01-31

## 📦 容器命名

所有容器使用统一前缀：**`pis-`**

### 容器统计

- **Standalone 模式（完全自托管）**: **6 个容器**
- **混合模式（Worker + 存储）**: **4 个容器**
- **PostgreSQL 模式**: **5 个容器**

### 容器列表

#### Standalone 模式（完全自托管）- 6 个容器
1. `pis-postgres` - PostgreSQL 数据库
2. `pis-minio` - MinIO 对象存储
3. `pis-minio-init` - MinIO 初始化容器（一次性任务）
4. `pis-redis` - Redis 任务队列/缓存
5. `pis-worker` - 图片处理 Worker 服务
6. `pis-web` - Next.js Web 前端（集成 Nginx 代理功能）

> **注意**: Nginx 功能已集成到 `pis-web` 容器中，通过 Next.js API Routes 实现代理功能。详见 [NGINX_TO_NEXTJS_INTEGRATION.md](./NGINX_TO_NEXTJS_INTEGRATION.md)

#### 混合模式（Worker + 存储）- 4 个容器
1. `pis-minio` - MinIO 对象存储
2. `pis-minio-init` - MinIO 初始化容器
3. `pis-redis` - Redis 任务队列
4. `pis-worker` - 图片处理 Worker 服务

#### PostgreSQL 模式 - 5 个容器
1. `pis-postgresql` - PostgreSQL 数据库
2. `pis-minio` - MinIO 对象存储
3. `pis-minio-init` - MinIO 初始化容器
4. `pis-redis` - Redis 任务队列
5. `pis-worker` - 图片处理 Worker 服务

## 💾 存储卷命名

所有存储卷使用统一前缀：**`pis_`**（下划线分隔）

### 存储卷列表

#### Standalone 模式
- `pis_postgres_data` - PostgreSQL 数据目录
- `pis_minio_data` - MinIO 数据目录
- `pis_redis_data` - Redis 数据目录
- `pis_worker_logs` - Worker 日志目录
- `pis_web_logs` - Web 日志目录

#### 混合模式
- `pis_minio_data` - MinIO 数据目录
- `pis_redis_data` - Redis 数据目录

## 🔍 查看容器和存储卷

### 查看所有容器
```bash
docker ps -a | grep pis-
```

### 查看所有存储卷
```bash
docker volume ls | grep pis_
```

### 查看特定存储卷详情
```bash
docker volume inspect pis_postgres_data
docker volume inspect pis_minio_data
docker volume inspect pis_redis_data
```

### 查看容器使用的存储卷
```bash
docker inspect pis-postgres | grep -A 10 Mounts
```

## 🗑️ 清理存储卷

### 删除特定存储卷（⚠️ 会删除数据）
```bash
docker volume rm pis_postgres_data
docker volume rm pis_minio_data
docker volume rm pis_redis_data
```

### 删除所有 PIS 相关存储卷（⚠️ 危险操作）
```bash
docker volume ls | grep pis_ | awk '{print $2}' | xargs docker volume rm
```

### 停止并删除所有容器和存储卷
```bash
cd docker
docker compose down -v  # 删除容器和存储卷
```

## 📝 存储卷位置

Docker 默认将存储卷存储在：
- **Linux**: `/var/lib/docker/volumes/`
- **macOS/Windows**: Docker Desktop 虚拟机内部

### 查看存储卷实际路径
```bash
docker volume inspect pis_postgres_data | grep Mountpoint
```

## 🔐 一键部署自动生成密钥

是的！一键部署脚本（`scripts/deploy.sh`）**会自动生成**以下密钥：

### 自动生成的密钥

1. **MinIO 访问密钥**
   - `MINIO_ACCESS_KEY` - 8 字符十六进制
   - `MINIO_SECRET_KEY` - 16 字符十六进制

2. **PostgreSQL 密码**（Standalone 模式）
   - `POSTGRES_PASSWORD` - 16 字符十六进制（如果未提供）

3. **Worker API 密钥**（Standalone 模式）
   - `WORKER_API_KEY` - 32 字符十六进制

4. **会话密钥**（Standalone 模式）
   - `ALBUM_SESSION_SECRET` - 32 字符十六进制

5. **JWT 密钥**（如果使用 `.env.example` 中的 `AUTO_GENERATE_32`）
   - `AUTH_JWT_SECRET` - 32 字符十六进制

### 生成方式

使用 `openssl rand -hex` 命令：
```bash
generate_password() {
    openssl rand -hex ${1:-16}
}
```

### 密钥保存位置

所有密钥保存在项目根目录的 `.env` 文件中：
```
/opt/pis/.env  # 默认部署目录
```

### 查看生成的密钥

```bash
cat /opt/pis/.env | grep -E "(KEY|SECRET|PASSWORD)"
```

## 📋 总结

- ✅ **容器前缀**: `pis-`
- ✅ **存储卷前缀**: `pis_`
- ✅ **一键部署自动生成密钥**: 是
- ✅ **密钥保存位置**: `.env` 文件（项目根目录）

## 🔒 安全建议

1. **保护 `.env` 文件**
   ```bash
   chmod 600 .env
   ```

2. **备份密钥**
   - 将 `.env` 文件备份到安全位置
   - 不要将 `.env` 提交到 Git（已在 `.gitignore` 中）

3. **定期轮换密钥**
   - 定期更新 `WORKER_API_KEY`、`AUTH_JWT_SECRET` 等密钥
   - 更新后需要重启相关服务
