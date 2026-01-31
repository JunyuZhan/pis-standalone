# 迁移完成检查清单

> 从 Supabase 到 PostgreSQL 的迁移完成检查清单

## ✅ 核心功能迁移

### 数据库客户端
- [x] PostgreSQL 客户端库 (`apps/web/src/lib/database/postgresql-client.ts`)
- [x] 数据库适配器工厂 (`apps/web/src/lib/database/index.ts`)
- [x] 支持动态切换 (`DATABASE_TYPE` 环境变量)
- [x] Worker 端数据库适配器 (`services/worker/src/lib/database/index.ts`)

### 认证系统
- [x] 自定义认证系统 (`apps/web/src/lib/auth/index.ts`)
- [x] PostgreSQL 认证数据库适配器 (`apps/web/src/lib/auth/database.ts`)
- [x] JWT + HttpOnly Cookie 会话管理
- [x] 登录 API (`/api/auth/login`)
- [x] 登出 API (`/api/auth/signout`)
- [x] 修改密码 API (`/api/auth/change-password`)
- [x] 认证中间件 (`apps/web/src/lib/auth/middleware.ts`)
- [x] 认证 Hooks (`apps/web/src/hooks/use-auth.ts`)

### API 路由迁移
- [x] 所有 40+ 个 API 路由已迁移
- [x] 认证检查逻辑已更新（使用 `getCurrentUser`）
- [x] 查询语法已适配 PostgreSQL

### Server Components
- [x] 首页 (`app/page.tsx`)
- [x] 管理后台首页 (`app/admin/(dashboard)/page.tsx`)
- [x] 设置页 (`app/admin/(dashboard)/settings/page.tsx`)
- [x] 相册详情页 (`app/album/[slug]/page.tsx`)
- [x] 管理后台相册详情页 (`app/admin/(dashboard)/albums/[id]/page.tsx`)
- [x] 管理后台相册设置页 (`app/admin/(dashboard)/albums/[id]/settings/page.tsx`)
- [x] 管理后台布局 (`app/admin/(dashboard)/layout.tsx`)

### Client Components
- [x] 修改密码表单 (`components/admin/change-password-form.tsx`)
- [x] 侧边栏 (`components/admin/sidebar.tsx`)
- [x] 移动端侧边栏 (`components/admin/mobile-sidebar.tsx`)
- [x] 所有组件已更新使用新的认证系统

### Hooks
- [x] `use-auth.ts` - 已更新使用自定义认证
- [x] `use-photo-realtime.ts` - 已替换 Supabase Realtime 为轮询机制

### Middleware
- [x] 主中间件 (`middleware.ts`) - 已更新使用自定义认证中间件
- [x] 认证中间件 (`lib/auth/middleware.ts`) - 已实现

## ✅ 配置和脚本

### 环境变量
- [x] `.env.example` - 已创建，包含 PostgreSQL 和 Supabase 配置
- [x] `docs/ENVIRONMENT_VARIABLES.md` - 已更新
- [x] `turbo.json` - 已更新环境变量列表

### Docker 配置
- [x] `docker-compose.standalone.yml` - 已更新，PostgreSQL 作为主要选项
- [x] `docker-compose.postgresql.yml` - PostgreSQL 专用配置
- [x] `docker/web.Dockerfile` - 已更新，添加轮询配置
- [x] `docker/worker.Dockerfile` - 已更新
- [x] `docker/init-postgresql-db.sql` - 数据库初始化脚本
- [x] `docker/reset-postgresql-db.sql` - 数据库重置脚本
- [x] `docker/schema.sql` - 符号链接到 `init-postgresql-db.sql`

### 部署脚本
- [x] `scripts/setup.sh` - 已更新，PostgreSQL 作为主要选项
- [x] `scripts/deploy.sh` - 已更新
- [x] `docker/deploy.sh` - 已更新，支持两种部署模式
- [x] `scripts/create-admin.ts` - 已创建，支持 PostgreSQL
- [x] `scripts/cleanup-failed-photos.ts` - 已迁移到 PostgreSQL
- [x] `scripts/purge-cloudflare-cache.ts` - 已更新支持 PostgreSQL

### 工具脚本
- [x] `scripts/check-security.sh` - 已更新注释

## ✅ 文档更新

### 核心文档
- [x] `docs/ARCHITECTURE.md` - 已更新架构描述
- [x] `docs/DEVELOPMENT.md` - 已更新开发指南
- [x] `docs/i18n/zh-CN/DEPLOYMENT.md` - 已更新部署指南
- [x] `docs/i18n/en/DEPLOYMENT.md` - 已更新部署指南
- [x] `docs/ENVIRONMENT_VARIABLES.md` - 已更新环境变量说明
- [x] `docs/SECURITY.md` - 已更新安全文档

### 迁移文档
- [x] `docs/MIGRATION_PLAN.md` - 迁移计划（已标记为历史文档）
- [x] `docs/MIGRATION_COMPLETE.md` - 迁移完成总结
- [x] `docs/MIGRATION_FINAL_SUMMARY.md` - 迁移最终总结
- [x] `docs/MIGRATION_STATUS.md` - 迁移状态
- [x] `docs/MIGRATION_PROGRESS.md` - 迁移进度（已标记为已完成）
- [x] `docs/NEXT_STEPS.md` - 下一步操作指南
- [x] `docs/API_MIGRATION_GUIDE.md` - API 迁移指南
- [x] `docs/TEST_MIGRATION_GUIDE.md` - 测试迁移指南
- [x] `docs/RESET_DATABASE.md` - 数据库重置指南

### Docker 文档
- [x] `docker/README.md` - 已更新
- [x] `docker/VOLUMES.md` - 已更新
- [x] `services/worker/src/lib/database/README.md` - 已更新

### 其他文档
- [x] `README.md` - 已更新
- [x] `README.zh-CN.md` - 已更新
- [x] `CONTRIBUTING.md` - 已更新
- [x] `LEGAL.md` - 已更新第三方库列表
- [x] `docs/README.md` - 已添加迁移文档索引

## ✅ 代码清理

### 生产代码
- [x] 所有 API 路由已迁移
- [x] 所有 Server Components 已迁移
- [x] 所有 Client Components 已更新
- [x] 所有 Hooks 已更新
- [x] 所有 Middleware 已更新

### 配置文件
- [x] `apps/web/next.config.ts` - Supabase CSP 配置标记为可选
- [x] `apps/web/public/sw.js` - Service Worker 中 Supabase 跳过逻辑标记为向后兼容
- [x] `package.json` - `db:types` 脚本已更新
- [x] `apps/web/src/types/database.ts` - 注释已更新

### Worker 服务
- [x] `services/worker/src/lib/database/supabase-compat.ts` - 注释已更新
- [x] `services/worker/src/index.ts` - 已支持两种数据库模式

### 向后兼容层注释
- [x] `apps/web/src/lib/supabase/client.ts` - 注释已更新，说明向后兼容性
- [x] `apps/web/src/lib/supabase/server.ts` - 注释已更新，说明向后兼容性
- [x] `apps/web/src/lib/supabase/admin.ts` - 注释已更新，说明向后兼容性
- [x] `apps/web/src/lib/auth/compat.ts` - 注释已更新，说明向后兼容性

## 🔄 向后兼容保留

以下内容保留用于向后兼容，可通过 `DATABASE_TYPE=supabase` 启用：

- [x] `apps/web/src/lib/supabase/` - Supabase 客户端库
- [x] `apps/web/src/lib/auth/compat.ts` - Supabase Auth 兼容层
- [x] `services/worker/src/lib/database/supabase-adapter.ts` - Supabase 适配器
- [x] Supabase 依赖 (`@supabase/ssr`, `@supabase/supabase-js`)

## 📝 可选任务

### 测试文件更新（可选）
以下测试文件仍使用 `@/lib/supabase/server`，可以逐步更新（参考 `docs/TEST_MIGRATION_GUIDE.md`）：

- [ ] 22 个测试文件（可选更新）

### Supabase 依赖清理（可选）
如果确定不再需要 Supabase 支持：

- [ ] 移除 `lib/supabase/` 目录
- [ ] 从 `package.json` 移除 Supabase 依赖
- [ ] 简化 `lib/database/index.ts` 只支持 PostgreSQL

**注意**：这会使项目失去向后兼容性。

## 📊 迁移统计

- **修改文件数**: 90+ 个文件
- **新增代码**: 2000+ 行
- **删除代码**: 1500+ 行
- **净增代码**: 500+ 行
- **API 路由**: 40+ 个 ✅
- **Server Components**: 7 个 ✅
- **Client Components**: 5+ 个 ✅
- **Hooks**: 2 个 ✅
- **脚本**: 5+ 个 ✅
- **文档**: 15+ 个 ✅
- **测试文件**: 部分更新（22 个文件可选更新）

## 🎯 验证步骤

### 1. 数据库初始化
```bash
# 创建数据库
createdb pis

# 执行初始化脚本
psql -U pis -d pis -f docker/init-postgresql-db.sql
```

### 2. 创建管理员账户
```bash
pnpm create-admin
```

### 3. 环境变量配置
```bash
# 复制示例文件
cp .env.example .env

# 编辑配置文件，确保设置：
# DATABASE_TYPE=postgresql
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=pis
# DATABASE_USER=pis
# DATABASE_PASSWORD=your-password
# AUTH_JWT_SECRET=your-jwt-secret
```

### 4. 运行测试
```bash
pnpm test
```

### 5. 启动开发服务器
```bash
pnpm dev
```

## ✅ 迁移完成确认

- [x] 所有核心功能已迁移
- [x] 所有配置文件已更新
- [x] 所有文档已更新
- [x] 向后兼容性已保留
- [x] 数据库初始化脚本已创建
- [x] 管理员账户创建脚本已创建
- [x] Docker 配置已更新
- [x] 部署脚本已更新

## 🎉 迁移完成

**迁移日期**: 2026-01-31  
**状态**: ✅ 已完成

所有主要迁移工作已完成！项目现在完全支持 PostgreSQL 自托管模式（推荐），同时保留 Supabase 向后兼容性。

**下一步**：参考 `docs/NEXT_STEPS.md` 进行数据库初始化、测试和部署。
