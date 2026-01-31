# Docker 存储卷命名规范

## 统一的卷命名规则

PIS 支持多种部署架构，所有 Docker Compose 文件使用统一的存储卷命名规范：

### 存储卷
- **PostgreSQL**: `pis_postgres_data` - 数据库（完全自托管模式）
- **MinIO**: `pis_minio_data` - 对象存储
- **Redis**: `pis_redis_data` - 缓存/队列

## 命名格式

格式：`pis_<服务名>_<类型>`

- `pis_`: 项目前缀
- `<服务名>`: 服务名称（postgres, minio, redis, nginx）
- `<类型>`: 数据类型（data, logs, certs）

## 不同架构的卷配置

### 完全自托管 (`docker-compose.standalone.yml`)
- `pis_postgres_data` - PostgreSQL 数据库
- `pis_minio_data` - MinIO 对象存储
- `pis_redis_data` - Redis 缓存/队列
- `pis_nginx_logs` - Nginx 日志
- `pis_certs` - SSL 证书

### 混合部署 (`docker-compose.yml`)
- `pis_minio_data` - MinIO 对象存储
- `pis_redis_data` - Redis 缓存/队列

**注意**: 
- 混合部署模式下，数据库由 Supabase 托管（向后兼容），前端由 Vercel 托管，无需本地数据库卷
- 推荐使用完全自托管模式（`docker-compose.standalone.yml`），所有服务都在本地

## 卷管理命令

```bash
# 查看所有卷
docker volume ls | grep pis_

# 查看卷详情
docker volume inspect pis_minio_data

# 备份 MinIO 卷
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio_backup.tar.gz /data

# 备份 Redis 卷
docker run --rm -v pis_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis_backup.tar.gz /data

# 备份 PostgreSQL 卷（完全自托管模式）
docker run --rm -v pis_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# 删除卷（谨慎操作）
# 完全自托管模式
docker volume rm pis_postgres_data pis_minio_data pis_redis_data pis_nginx_logs pis_certs

# 混合部署模式
docker volume rm pis_minio_data pis_redis_data
```
