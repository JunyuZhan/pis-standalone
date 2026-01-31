# 📜 脚本工具总结

> 最后更新: 2026-01-31

## 📊 脚本统计

- **脚本总数**: 17 个
- **脚本文档**: 2 个（README.md + DEPLOYMENT_SCRIPTS.md）
- **脚本分类**: 部署、安全、字体、开发、CDN、数据库、图标、文档

---

## 🎯 脚本分类

### 🚀 部署相关（6 个）

| 脚本 | 用途 | 推荐度 |
|------|------|--------|
| `deploy.sh` | 一键部署（支持远程） | ⭐⭐⭐⭐⭐ |
| `install.sh` | 一键安装 | ⭐⭐⭐⭐ |
| `setup.sh` | 引导式设置 | ⭐⭐⭐⭐ |
| `start-internal-services.sh` | 启动内网服务 | ⭐⭐⭐⭐⭐ |
| `verify-deployment.sh` | 部署验证 | ⭐⭐⭐⭐ |
| `update-worker-on-server.sh` | Worker 更新 | ⭐⭐⭐ |

### 🔒 安全相关（1 个）

| 脚本 | 用途 | 推荐度 |
|------|------|--------|
| `check-security.sh` | 安全检查 | ⭐⭐⭐⭐⭐ |

### 🎨 字体和资源（2 个）

| 脚本 | 用途 | 状态 |
|------|------|------|
| `setup-fonts.sh` | 一键设置字体（推荐） | ✅ 推荐 |
| `download-fonts.sh` | 下载字体 | ⚠️ 已弃用 |

### 🔧 开发工具（3 个）

| 脚本 | 用途 | 推荐度 |
|------|------|--------|
| `dev-with-ssl-fix.sh` | SSL 修复（macOS） | ⭐⭐⭐ |
| `fix-ssl.sh` | SSL 证书修复 | ⭐⭐⭐ |
| `fix-build.sh` | 构建修复 | ⭐⭐⭐ |

### ☁️ CDN 缓存（1 个）

| 脚本 | 用途 | 推荐度 |
|------|------|--------|
| `purge-cloudflare-cache.ts` | Cloudflare 缓存清除 | ⭐⭐⭐⭐ |

### 🗄️ 数据库工具（2 个）

| 脚本 | 用途 | 推荐度 |
|------|------|--------|
| `create-admin.ts` | 创建管理员 | ⭐⭐⭐⭐⭐ |
| `cleanup-failed-photos.ts` | 清理失败照片 | ⭐⭐⭐ |

### 🎨 图标工具（1 个）

| 脚本 | 用途 | 推荐度 |
|------|------|--------|
| `icon-tools.js` | PWA 图标生成 | ⭐⭐⭐ |

### 📚 文档工具（1 个）

| 脚本 | 用途 | 推荐度 |
|------|------|--------|
| `create-example-docs.py` | 文档示例生成 | ⭐⭐⭐ |

---

## 📚 脚本文档

### 主文档

- **[scripts/README.md](../scripts/README.md)** - 所有脚本的快速参考和用法
- **[scripts/DEPLOYMENT_SCRIPTS.md](../scripts/DEPLOYMENT_SCRIPTS.md)** - 部署脚本详细说明

### 归档文档

- `docs/archive/development/SCRIPT_CHECKLIST.md` - 脚本检查清单（开发过程文档）

---

## 🎯 快速参考

### 最常用的脚本

1. **一键部署**: `bash scripts/deploy.sh`
2. **字体设置**: `bash scripts/setup-fonts.sh`
3. **安全检查**: `bash scripts/check-security.sh`
4. **启动内网服务**: `bash scripts/start-internal-services.sh`
5. **创建管理员**: `tsx scripts/create-admin.ts`

---

## ✅ 脚本状态

所有脚本已更新并支持：
- ✅ PostgreSQL（默认）
- ✅ Supabase（向后兼容）
- ✅ 环境变量配置
- ✅ 错误处理和用户友好的消息
- ✅ 清晰的文档和注释

---

## 📝 相关文档

- [脚本工具集](../scripts/README.md) - 完整的脚本文档
- [部署脚本说明](../scripts/DEPLOYMENT_SCRIPTS.md) - 部署脚本详细说明
- [部署指南](./i18n/zh-CN/DEPLOYMENT.md) - 部署指南
- [开发指南](./DEVELOPMENT.md) - 开发环境设置
