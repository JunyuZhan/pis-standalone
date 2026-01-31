# 问题检查清单

> 生成时间: 2026-01-31

## 🔴 阻塞性问题（必须修复）

### 1. Web 应用构建失败 - 字体文件路径错误 ❌

**错误信息**:
```
Module not found: Can't resolve '../../public/fonts/Inter-Regular.woff2'
```

**问题**: Next.js `localFont` 的路径解析不正确

**解决方案**:
- 选项 A: 将字体文件移到 `src/app/fonts/` 目录
- 选项 B: 使用绝对路径（从项目根目录）
- 选项 C: 使用系统字体（最快）

**状态**: 🔴 **阻塞构建**

---

## ⚠️ 潜在问题

### 2. 环境变量依赖

**构建时需要的环境变量**:
- `NEXT_PUBLIC_APP_URL` - 有默认值 ✅
- `NEXT_PUBLIC_MEDIA_URL` - 有默认值 ✅
- `NEXT_PUBLIC_WORKER_URL` - 有默认值 ✅
- `NEXT_PUBLIC_SUPABASE_URL` - 可选（向后兼容）✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 可选（向后兼容）✅

**运行时需要的环境变量**:
- `DATABASE_TYPE` - 必需
- `DATABASE_HOST`, `DATABASE_NAME`, etc. - 必需（PostgreSQL）
- `WORKER_API_KEY` - 必需
- `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` - 必需
- `ALBUM_SESSION_SECRET` - 必需（生产环境）

**状态**: ⚠️ **需要配置，但有默认值**

---

### 3. 测试失败

**当前状态**: 328 失败 / 268 通过

**主要问题**:
- 验证逻辑变化导致状态码不匹配
- 测试用例需要更新以适配新的验证系统

**影响**: ⚠️ **不影响部署，但需要修复**

---

### 4. TypeScript `any` 类型警告

**当前状态**: ~455 个 `any` 类型

**已修复**:
- ✅ 生产代码 API 路由中的 `any` 已替换
- ✅ 数据库客户端中的 `any` 已替换

**待修复**:
- ⚠️ 测试文件中的 `any`（优先级较低）
- ⚠️ 其他库文件中的 `any`

**影响**: ⚠️ **不影响功能，但有警告**

---

### 5. 未使用的变量警告

**发现的警告**:
- `protocol`, `host` 变量未使用（多个文件）
- `NextResponse` 导入但未使用（多个文件）
- `createClient`, `createSuccessResponse` 导入但未使用

**影响**: ⚠️ **不影响功能，但有警告**

---

### 6. Console.log 语句

**发现位置**:
- `apps/web/src/app/api/admin/albums/[id]/upload/route.ts` - 多个 console.error
- `apps/web/src/components/album/masonry.tsx` - console.log/warn/error
- `apps/web/src/components/ui/optimized-image.tsx` - console.warn/error

**影响**: ⚠️ **不影响功能，但生产环境应移除或使用 logger**

---

## ✅ 已解决的问题

1. ✅ Worker 服务构建错误 - 已修复
2. ✅ Logger 类型错误 - 已修复
3. ✅ HTTP 模块导入缺失 - 已修复
4. ✅ PostgresQueryBuilder 方法缺失 - 已修复

---

## 🎯 优先级修复建议

### 高优先级（阻塞部署）

1. **修复字体文件路径** 🔴
   - 这是唯一阻塞构建的问题
   - 必须修复才能部署

### 中优先级（建议修复）

2. **清理未使用的导入和变量** ⚠️
   - 提高代码质量
   - 减少警告

3. **更新测试用例** ⚠️
   - 适配新的验证系统
   - 提高测试可靠性

### 低优先级（可选）

4. **移除或替换 console.log** ⚠️
   - 使用 logger 替代
   - 生产环境优化

5. **继续减少 `any` 类型** ⚠️
   - 逐步改进
   - 不影响功能

---

## 📋 快速修复清单

### 立即修复（必须）

- [ ] 修复字体文件路径问题

### 建议修复（可选）

- [ ] 清理未使用的导入
- [ ] 移除 console.log 或使用 logger
- [ ] 更新失败的测试用例

---

## 🔧 修复字体路径的三种方案

### 方案 1: 移动字体文件到 src/app/fonts/（推荐）

```bash
mkdir -p apps/web/src/app/fonts
# 下载字体文件到这里
```

然后修改 `layout.tsx`:
```typescript
path: './fonts/Inter-Regular.woff2'
```

### 方案 2: 使用绝对路径

```typescript
path: path.join(process.cwd(), 'apps/web/public/fonts/Inter-Regular.woff2')
```

### 方案 3: 使用系统字体（最快）

见 `docs/QUICK_FIX.md`
