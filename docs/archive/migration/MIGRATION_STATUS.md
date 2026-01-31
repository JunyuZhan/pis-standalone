# 迁移状态总结

> 从 Supabase 到 PostgreSQL 的迁移状态

## ✅ 已完成

### 核心功能迁移
- ✅ **Docker 部署脚本** - `docker/deploy.sh` 已更新支持 PostgreSQL 作为主要选项
- ✅ **数据库客户端适配器** - `lib/database/index.ts` 支持动态切换
- ✅ **认证系统** - 自定义 JWT + HttpOnly Cookie 认证
- ✅ **所有 API 路由** - 40+ 个 API 路由已迁移
- ✅ **所有 Server Components** - 7 个页面组件已迁移
- ✅ **Client Components** - 所有组件已更新使用新的认证系统
- ✅ **Hooks** - `use-auth.ts`, `use-photo-realtime.ts` 已更新
- ✅ **Middleware** - 自定义认证中间件已实现

### 配置和脚本
- ✅ **环境变量配置** - `.env.example` 已创建
- ✅ **Docker 配置** - `docker-compose.standalone.yml` 已更新
- ✅ **部署脚本** - `scripts/setup.sh`, `scripts/create-admin.ts`, `scripts/deploy.sh` 已更新
- ✅ **Docker 部署脚本** - `docker/deploy.sh` 已更新支持 PostgreSQL 和 Supabase 两种模式
- ✅ **清理脚本** - `scripts/cleanup-failed-photos.ts` 已迁移
- ✅ **CDN 缓存清除脚本** - `scripts/purge-cloudflare-cache.ts` 已更新支持 PostgreSQL

### 文档
- ✅ **架构文档** - `docs/ARCHITECTURE.md` 已更新
- ✅ **开发文档** - `docs/DEVELOPMENT.md` 已更新
- ✅ **部署文档** - `docs/i18n/*/DEPLOYMENT.md` 已更新
- ✅ **环境变量文档** - `docs/ENVIRONMENT_VARIABLES.md` 已更新
- ✅ **迁移指南** - `docs/MIGRATION_PLAN.md`, `docs/NEXT_STEPS.md` 已创建

### 组件和类型
- ✅ **组件类型** - `mobile-sidebar.tsx` 已更新使用 `AuthUser`
- ✅ **测试辅助函数** - `test/integration-helpers.ts` 已更新

### Docker 和部署
- ✅ **Docker 部署脚本** - `docker/deploy.sh` 支持完全自托管和混合部署两种模式
- ✅ **数据库重置脚本** - `docker/reset-postgresql-db.sql` 已创建

## 🔄 向后兼容保留

以下内容保留作为向后兼容层，支持通过 `DATABASE_TYPE` 环境变量切换：

- ✅ **`lib/supabase/` 目录** - 保留所有 Supabase 客户端实现
- ✅ **Supabase 依赖** - `@supabase/ssr`, `@supabase/supabase-js` 保留在 `package.json`
- ✅ **数据库适配器** - `lib/database/index.ts` 自动选择使用 Supabase 或 PostgreSQL

## 📝 待完成（可选）

### 测试文件更新
以下测试文件仍在使用 `@/lib/supabase/server`，可以逐步更新：

- `apps/web/src/app/api/public/albums/[slug]/view/route.test.ts`
- `apps/web/src/app/api/public/albums/[slug]/groups/route.test.ts`
- `apps/web/src/app/api/public/albums/[slug]/route.test.ts`
- `apps/web/src/app/api/public/albums/[slug]/download-selected/route.test.ts`
- `apps/web/src/app/api/public/albums/[slug]/verify-password/route.test.ts`
- `apps/web/src/app/api/public/photos/[id]/select/route.test.ts`
- `apps/web/src/app/api/public/download/[id]/route.test.ts`
- `apps/web/src/app/api/admin/albums/[id]/upload/route.test.ts`
- `apps/web/src/app/api/admin/albums/[id]/route.test.ts`
- `apps/web/src/app/api/admin/albums/route.test.ts`
- `apps/web/src/app/api/admin/photos/process/route.test.ts`
- `apps/web/src/app/api/admin/photos/restore/route.test.ts`
- `apps/web/src/app/api/admin/photos/[id]/cleanup/route.test.ts`
- `apps/web/src/app/api/admin/photos/[id]/rotate/route.test.ts`
- `apps/web/src/app/api/admin/photos/permanent-delete/route.test.ts`
- `apps/web/src/app/api/admin/photos/reprocess/route.test.ts`
- `apps/web/src/app/api/admin/photos/reorder/route.test.ts`
- `apps/web/src/app/api/admin/upload-proxy/route.test.ts`
- `apps/web/src/app/api/auth/signout/route.test.ts`

**更新方法**：
```typescript
// 旧代码
import { createClient } from '@/lib/supabase/server'
const client = await createClient()

// 新代码
import { createClient } from '@/lib/database'
const client = await createClient()
```

### Supabase 依赖清理（可选）

如果确定不再需要 Supabase 支持，可以：

1. 移除 `lib/supabase/` 目录
2. 从 `package.json` 移除 `@supabase/ssr` 和 `@supabase/supabase-js`
3. 简化 `lib/database/index.ts` 只支持 PostgreSQL

**注意**：这会使项目失去向后兼容性，无法再切换回 Supabase。

## 📊 迁移统计

- **API 路由**: 40+ 个 ✅
- **Server Components**: 7 个 ✅
- **Client Components**: 5+ 个 ✅
- **Hooks**: 2 个 ✅
- **脚本**: 3 个 ✅
- **文档**: 10+ 个 ✅
- **测试文件**: 部分更新（22 个文件待更新）

## 🎯 下一步

1. **数据库初始化** - 参考 `docs/NEXT_STEPS.md`
2. **创建管理员账户** - 运行 `pnpm create-admin`
3. **运行测试** - 验证功能正常
4. **部署到生产环境** - 参考 `docs/i18n/*/DEPLOYMENT.md`

## 📚 相关文档

- [迁移计划](./MIGRATION_PLAN.md)
- [下一步操作](./NEXT_STEPS.md)
- [迁移完成总结](./MIGRATION_COMPLETE.md)
- [API 迁移指南](./API_MIGRATION_GUIDE.md)
- [测试迁移指南](./TEST_MIGRATION_GUIDE.md)
