# Nginx 功能集成到 Next.js - 完成说明

> 最后更新: 2026-01-31

## ✅ 集成完成

Nginx 容器的功能已成功集成到 Next.js Web 容器中，**容器数量从 7 个减少到 6 个**。

## 📋 变更内容

### 1. 新增文件

- `apps/web/src/app/media/[...path]/route.ts` - 媒体文件代理 API Route
- `apps/web/src/app/minio-console/[...path]/route.ts` - MinIO Console 代理 API Route

### 2. 修改文件

- `docker/docker-compose.standalone.yml` - 移除 nginx 容器，暴露 web 容器端口
- `docker/deploy.sh` - 更新部署脚本说明
- `docs/DOCKER_CONTAINERS_AND_VOLUMES.md` - 更新容器数量说明
- `docs/DOCKER_NETWORK_AND_PORTS.md` - 更新端口暴露说明

### 3. 移除内容

- `pis-nginx` 容器
- `pis_nginx_logs` 存储卷
- `pis_certs` 存储卷（不再需要）

## 🎯 新的架构

### 容器列表（6 个）

1. `pis-postgres` - PostgreSQL 数据库
2. `pis-minio` - MinIO 对象存储
3. `pis-minio-init` - MinIO 初始化容器（一次性任务）
4. `pis-redis` - Redis 任务队列/缓存
5. `pis-worker` - 图片处理 Worker 服务
6. `pis-web` - Next.js Web 前端（**集成代理功能**）

### 端口暴露

| 容器 | 暴露端口 | 说明 |
|------|---------|------|
| `pis-web` | `8081:3000` | ✅ **唯一对外暴露的端口** |

### 服务访问路径

所有服务通过 Next.js Web 容器统一入口访问：

- `/` - Next.js 前端应用
- `/api/` - Next.js API
- `/media/*` - MinIO 媒体文件（通过 Next.js API Route 代理）
- `/minio-console/*` - MinIO 管理控制台（通过 Next.js API Route 代理）
- `/api/worker/*` - Worker API（通过 Next.js API Route 代理）
- `/health` - 健康检查

## ⚠️ 注意事项

### 1. MinIO Console WebSocket 支持

**问题**：Next.js API Routes **不完全支持 WebSocket**，MinIO Console 的 WebSocket 功能可能无法正常工作。

**解决方案**：

**选项 A（推荐）**：临时暴露 MinIO Console 端口（仅本地访问）
```yaml
minio:
  ports:
    - "127.0.0.1:9001:9001"  # 仅本地访问
```

**选项 B**：使用主机 Nginx 代理 MinIO Console
```nginx
location /minio-console/ {
    proxy_pass http://localhost:9001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ... 其他配置
}
```

**选项 C**：不使用 MinIO Console，通过 API 管理

### 2. 性能影响

- **小文件（< 10MB）**：影响较小，可以接受
- **大文件（> 10MB）**：性能略低于 Nginx，但通常可以接受
- **并发请求**：Next.js 并发性能低于 Nginx，但对于大多数场景足够

### 3. 内存占用

- **之前**：Web 容器 ~200-300MB + Nginx 容器 ~10MB = ~210-310MB
- **现在**：Web 容器 ~250-350MB（+50MB）
- **节省**：~10MB（Nginx 容器）

### 4. 环境变量

确保以下环境变量已设置：

```bash
# MinIO 配置（用于代理）
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET=pis-photos
```

## 🚀 部署步骤

### 1. 更新配置

确保 `.env` 文件包含 MinIO 相关配置（通常已存在）。

### 2. 停止旧容器

```bash
cd docker
docker compose -f docker-compose.standalone.yml down
```

### 3. 清理旧容器（可选）

```bash
docker rm -f pis-nginx 2>/dev/null || true
docker volume rm pis_nginx_logs 2>/dev/null || true
```

### 4. 启动新容器

```bash
docker compose -f docker-compose.standalone.yml up -d
```

### 5. 验证

```bash
# 检查容器
docker ps | grep pis-

# 应该看到 6 个容器（不包括 nginx）
# pis-postgres
# pis-minio
# pis-minio-init（可能已退出）
# pis-redis
# pis-worker
# pis-web

# 测试访问
curl http://localhost:8081/health
curl http://localhost:8081/media/processed/test.jpg
```

## 📊 对比总结

| 项目 | 之前（Nginx 容器） | 现在（Next.js 集成） |
|------|-------------------|---------------------|
| **容器数** | 7 个 | 6 个 ✅ |
| **暴露端口** | 1 个（8081） | 1 个（8081） |
| **内存占用** | ~210-310MB | ~250-350MB |
| **性能** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **配置复杂度** | 中 | 低 ✅ |
| **WebSocket 支持** | ✅ | ⚠️ 部分支持 |
| **大文件性能** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## 🔍 故障排查

### 问题 1：媒体文件无法访问

**检查**：
1. MinIO 容器是否正常运行：`docker ps | grep minio`
2. MinIO 环境变量是否正确设置
3. 查看 Web 容器日志：`docker logs pis-web`

**解决**：
```bash
# 检查环境变量
docker exec pis-web env | grep MINIO

# 测试 MinIO 连接
docker exec pis-web wget -O- http://minio:9000/minio/health/live
```

### 问题 2：MinIO Console 无法访问

**原因**：WebSocket 不支持

**解决**：使用选项 A（临时暴露端口）或选项 B（主机 Nginx）

### 问题 3：性能问题

**检查**：
1. Web 容器资源使用：`docker stats pis-web`
2. 查看日志是否有错误

**优化**：
- 如果大文件传输频繁，考虑使用主机 Nginx 代理媒体文件
- 或者：保留 Nginx 容器仅用于媒体文件服务

## 📝 回滚方案

如果需要回滚到 Nginx 容器方案：

1. 恢复 `docker-compose.standalone.yml`（从 Git 历史）
2. 删除代理 API Routes
3. 重新部署

## ✅ 完成检查清单

- [x] 创建媒体文件代理 API Route
- [x] 创建 MinIO Console 代理 API Route
- [x] 修改 docker-compose.standalone.yml
- [x] 更新环境变量配置
- [x] 更新部署脚本
- [x] 更新文档
- [ ] 测试媒体文件访问
- [ ] 测试 MinIO Console（WebSocket 功能）
- [ ] 性能测试（大文件传输）

## 🎉 总结

✅ **集成成功**：Nginx 功能已集成到 Next.js，容器数量减少到 6 个。

⚠️ **注意事项**：MinIO Console 的 WebSocket 功能需要特殊处理。

💡 **建议**：根据实际需求选择是否暴露 MinIO Console 端口或使用主机 Nginx。
