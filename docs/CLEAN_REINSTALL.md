# 完全清理并重新部署指南

## ⚠️ 警告

**此操作会删除所有数据！** 包括：
- 数据库中的所有数据（相册、照片、用户等）
- MinIO 中的所有文件
- Redis 中的所有缓存
- 所有日志文件

## 清理步骤

### 1. 停止并删除所有容器

```bash
cd /opt/pis-standalone/docker
docker compose -f docker-compose.standalone.yml down
```

### 2. 删除所有持久化卷

```bash
# 查看所有卷
docker volume ls | grep pis_

# 删除所有 PIS 相关卷
docker volume rm pis_postgres_data pis_minio_data pis_redis_data pis_worker_logs pis_web_logs 2>/dev/null || true
```

或者一键删除：

```bash
docker volume ls | grep pis_ | awk '{print $2}' | xargs docker volume rm 2>/dev/null || true
```

### 3. 清理 Docker 镜像（可选）

```bash
# 删除 PIS 相关镜像（如果需要重新构建）
docker images | grep pis- | awk '{print $3}' | xargs docker rmi 2>/dev/null || true
```

## 重新部署步骤

### 1. 确保代码是最新的

```bash
cd /opt/pis-standalone
git pull origin main
```

### 2. 使用一键部署脚本

```bash
cd /opt/pis-standalone
bash scripts/deploy/quick-deploy.sh
```

脚本会自动：
- ✅ 检查项目目录
- ✅ 生成配置文件（`.env`）
- ✅ 生成所有密钥（数据库密码、MinIO 密钥、JWT Secret 等）
- ✅ 启动所有 Docker 容器
- ✅ **自动创建管理员账户**（通过 `init-postgresql.sh`）

### 3. 等待服务启动

```bash
cd /opt/pis-standalone/docker
docker compose ps
```

所有服务状态应该是 `healthy` 或 `Up`。

### 4. 查看日志确认管理员账户创建

```bash
# 查看 PostgreSQL 初始化日志
docker compose logs postgres | grep -i "管理员\|admin\|创建"

# 应该看到类似输出：
# ✅ 默认管理员账户已就绪: admin@<your-domain>
#    - 首次登录时需要设置密码
```

### 5. 验证管理员账户

```bash
# 连接到数据库检查
docker exec -it pis-postgres psql -U pis -d pis -c "SELECT email, role, is_active FROM users;"

# 应该看到：
#        email         | role  | is_active
# ---------------------+-------+-----------
#  admin@example.com  | admin | t
```

## 管理员账户信息

### 默认管理员账户

- **邮箱**: `admin@<DOMAIN>`（从 `.env` 文件的 `DOMAIN` 变量读取）
  - 如果 `DOMAIN=localhost`，则使用 `admin@example.com`
  - 如果 `DOMAIN=yourdomain.com`，则使用 `admin@yourdomain.com`
- **密码**: **未设置**（首次登录时需要设置）
- **角色**: `admin`
- **状态**: `active`

### 首次登录

1. 访问管理后台：`http://your-domain:8081/admin/login`
2. 输入管理员邮箱（如 `admin@example.com`）
3. 点击"首次登录"或"设置密码"
4. 设置新密码
5. 完成登录

## 故障排查

### 问题 1: 管理员账户未创建

**检查 PostgreSQL 初始化日志**：

```bash
docker compose logs postgres | tail -50
```

**手动创建管理员账户**：

```bash
docker exec -it pis-postgres psql -U pis -d pis <<EOF
INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    'admin@example.com',  -- 替换为你的邮箱
    NULL,  -- 首次登录需要设置密码
    'admin',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;
EOF
```

### 问题 2: 容器启动失败

**检查容器状态**：

```bash
docker compose ps -a
docker compose logs <service-name>
```

**重新构建并启动**：

```bash
docker compose down
docker compose up -d --build
```

### 问题 3: 数据库初始化脚本未执行

PostgreSQL 的初始化脚本只在**首次启动**时执行（数据目录为空时）。

如果数据目录已存在，需要：
1. 删除数据卷：`docker volume rm pis_postgres_data`
2. 重新启动容器：`docker compose up -d postgres`

## 验证清单

部署完成后，请验证：

- [ ] 所有容器状态为 `healthy` 或 `Up`
- [ ] PostgreSQL 日志显示"数据库初始化完成"
- [ ] PostgreSQL 日志显示"管理员账户已就绪"
- [ ] 数据库中存在管理员账户（`SELECT * FROM users;`）
- [ ] 可以访问管理后台登录页面
- [ ] MinIO Console 可以访问（`http://your-domain:8081/minio-console/`）

## 快速命令总结

```bash
# 完全清理
cd /opt/pis-standalone/docker
docker compose -f docker-compose.standalone.yml down -v
docker volume ls | grep pis_ | awk '{print $2}' | xargs docker volume rm 2>/dev/null || true

# 重新部署
cd /opt/pis-standalone
git pull origin main
bash scripts/deploy/quick-deploy.sh

# 验证
cd /opt/pis-standalone/docker
docker compose ps
docker compose logs postgres | grep -i "管理员\|admin"
```
