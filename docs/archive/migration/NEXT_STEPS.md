# 下一步操作指南

> 迁移完成后的操作步骤

## ✅ 迁移完成

从 Supabase 到 PostgreSQL 的迁移已完成！以下是后续操作步骤。

## 📋 操作清单

### 1. 数据库初始化

#### 创建数据库

```bash
# 使用 PostgreSQL 客户端
psql -U postgres

# 创建数据库和用户
CREATE DATABASE pis;
CREATE USER pis WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE pis TO pis;
\q
```

#### 运行数据库迁移

**重要说明**：
- ✅ **Docker Compose 会自动初始化**：如果使用 `docker-compose.standalone.yml`，数据库会在首次启动时自动初始化
- ✅ **无需手动操作**：如果数据卷是全新的，数据库会自动初始化
- ⚠️ **如果数据卷已存在**：需要手动执行初始化脚本

**手动初始化（外部数据库或已有数据卷）**：

```bash
# 外部 PostgreSQL
psql -U pis -d pis -f docker/init-postgresql-db.sql

# 或如果使用 Docker
docker exec -i pis-postgres psql -U pis -d pis < docker/init-postgresql-db.sql

# 注意: schema.sql 是 init-postgresql-db.sql 的符号链接（如果存在）
```

**使用一键部署脚本（推荐）**：

```bash
cd docker
bash deploy.sh
```

脚本会自动检测数据库是否已初始化，如果未初始化会提示并可选自动执行。

### 2. 创建管理员账户

#### 方法 1: 使用脚本（推荐）

```bash
# 使用项目提供的脚本创建管理员账户
pnpm create-admin

# 或直接运行
pnpm exec tsx scripts/create-admin.ts

# 或指定邮箱和密码（非交互式）
pnpm exec tsx scripts/create-admin.ts admin@example.com your-password
```

脚本会：
- 自动加载 `.env` 文件中的数据库配置
- 提示输入邮箱和密码（或从命令行参数读取）
- 自动哈希密码
- 创建管理员账户

#### 方法 2: 使用 SQL（手动）

```sql
-- 连接到数据库
psql -U pis -d pis

-- 插入管理员账户（密码需要先哈希）
-- 使用 Node.js 生成密码哈希:
-- node -e "const { hashPassword } = require('./apps/web/src/lib/auth'); hashPassword('your-password').then(console.log)"

INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  'your-hashed-password-here',
  'admin',
  true,
  NOW(),
  NOW()
);
```

### 3. 环境变量配置

#### 前端环境变量（Vercel 或本地）

参考 `docs/ENVIRONMENT_VARIABLES.md` 配置：

```bash
DATABASE_TYPE=postgresql
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=true  # 生产环境建议启用

AUTH_JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long
```

#### Worker 环境变量

```bash
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres  # Docker 服务名
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=false  # Docker 内部网络不需要 SSL
```

### 4. 测试

#### 运行测试

```bash
# 安装依赖
pnpm install

# 运行测试
pnpm test

# 运行特定测试
pnpm test apps/web/src/app/api/auth/login/route.test.ts
```

#### 本地开发测试

```bash
# 启动开发服务器
pnpm dev

# 访问 http://localhost:3000/admin/login
# 使用创建的管理员账户登录
```

### 5. 数据迁移（如果从 Supabase 迁移）

如果需要从 Supabase 迁移现有数据：

#### 导出 Supabase 数据

```bash
# 使用 pg_dump 或 Supabase CLI
supabase db dump --data-only > supabase_data.sql
```

#### 导入到 PostgreSQL

```bash
# 导入数据（注意：需要调整表结构和外键）
psql -U pis -d pis < supabase_data.sql
```

#### 注意事项

1. **用户密码**: Supabase 使用不同的密码哈希算法，需要重新设置密码
2. **UUID 格式**: 确保 UUID 格式兼容
3. **时间戳**: 检查时间戳格式是否兼容
4. **外键约束**: 确保外键关系正确

### 6. 部署

#### Docker Compose 部署

```bash
# 更新 docker-compose.yml 中的环境变量
# 确保 PostgreSQL 服务已配置

# 启动服务
docker-compose up -d

# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f web worker postgres
```

#### 生产环境部署

参考 `docs/i18n/zh-CN/DEPLOYMENT.md` 进行部署。

### 7. 验证部署

#### 健康检查

```bash
# 检查数据库连接
psql -U pis -d pis -c "SELECT 1"

# 检查 API 端点
curl http://localhost:3000/api/auth/me

# 检查 Worker 服务
curl http://localhost:3001/health
```

#### 功能测试

1. ✅ 登录功能
2. ✅ 相册创建
3. ✅ 照片上传
4. ✅ 照片处理
5. ✅ 相册分享
6. ✅ 密码保护

## 🔍 故障排除

### 数据库连接失败

**错误**: `Connection refused` 或 `Authentication failed`

**解决**:
1. 检查 `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_USER`、`DATABASE_PASSWORD` 是否正确
2. 检查 PostgreSQL 服务是否运行
3. 检查防火墙设置
4. 检查 PostgreSQL 的 `pg_hba.conf` 配置

### 认证失败

**错误**: `Auth database not initialized`

**解决**:
1. 确保 `initAuthDatabase()` 已调用（在 middleware 和 login route 中已自动调用）
2. 检查数据库连接是否正常
3. 检查 `users` 表是否存在

### JWT 验证失败

**错误**: `Token verification failed`

**解决**:
1. 检查 `AUTH_JWT_SECRET` 是否配置
2. 确保前后端使用相同的 `AUTH_JWT_SECRET`
3. 清除浏览器 cookies 重新登录

## 📚 相关文档

- [环境变量配置](./ENVIRONMENT_VARIABLES.md)
- [API 迁移指南](./API_MIGRATION_GUIDE.md)
- [测试迁移指南](./TEST_MIGRATION_GUIDE.md)
- [架构文档](./ARCHITECTURE.md)
- [部署指南](./i18n/zh-CN/DEPLOYMENT.md)

## 🎉 完成

完成以上步骤后，您的 PIS 项目已完全迁移到 PostgreSQL 自托管模式！

如有问题，请参考相关文档或提交 Issue。
