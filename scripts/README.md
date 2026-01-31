# PIS 脚本工具集

本目录包含 PIS 项目的各种实用脚本工具。

---

## 📋 脚本分类

### 🚀 部署相关

| 脚本 | 描述 | 用法 |
|------|------|------|
| `deploy.sh` | 一键部署脚本，支持本地和远程部署 | `bash scripts/deploy.sh [服务器IP] [用户名]` |
| `install.sh` | 一键安装脚本（克隆代码并运行部署向导） | `curl -sSL <URL> \| bash` |
| `setup.sh` | 引导式部署脚本，用于本地开发环境设置 | `bash scripts/setup.sh` |
| `start-internal-services.sh` | 只启动内网容器服务（MinIO、Redis、数据库等） | `bash scripts/start-internal-services.sh` |
| `verify-deployment.sh` | 部署验证脚本，端到端验证部署是否成功 | `bash scripts/verify-deployment.sh [SSH_HOST]` |
| `update-worker-on-server.sh` | Worker 更新脚本，在服务器上拉取最新代码并更新 Worker 服务 | `bash scripts/update-worker-on-server.sh` |

### 🔒 安全相关

| 脚本 | 描述 | 用法 |
|------|------|------|
| `check-security.sh` | 安全检查脚本，检查是否有敏感信息泄露风险 | `bash scripts/check-security.sh` |

**检查项**：
- 敏感文件是否被 Git 跟踪
- Git 历史中是否有敏感文件
- 硬编码的 JWT tokens
- 数据库配置泄露（PostgreSQL/Supabase）
- AWS Access Keys
- 硬编码密码
- 私人域名泄露
- .gitignore 配置

### 🎨 字体和资源

| 脚本 | 描述 | 用法 |
|------|------|------|
| `setup-fonts.sh` | 一键设置字体文件（推荐） | `bash scripts/setup-fonts.sh` |
| `download-fonts.sh` | 下载字体文件（已弃用，使用 setup-fonts.sh） | `bash scripts/download-fonts.sh` |

> **注意**: `download-fonts.sh` 已弃用，请使用 `setup-fonts.sh`。

### 🔧 开发工具

| 脚本 | 描述 | 用法 |
|------|------|------|
| `dev-with-ssl-fix.sh` | 开发环境 SSL 修复（macOS） | `bash scripts/dev-with-ssl-fix.sh` |
| `fix-ssl.sh` | SSL 证书修复脚本（macOS） | `bash scripts/fix-ssl.sh` |
| `fix-build.sh` | 构建修复脚本 | `bash scripts/fix-build.sh` |

### ☁️ CDN 缓存管理

| 脚本 | 描述 | 用法 |
|------|------|------|
| `purge-cloudflare-cache.ts` | Cloudflare CDN 缓存清除工具 | `tsx scripts/purge-cloudflare-cache.ts [选项]` |

**用法**：
```bash
# 手动清除指定 URL
tsx scripts/purge-cloudflare-cache.ts --urls <URL1> <URL2> ...

# 自动清除已删除照片的缓存
tsx scripts/purge-cloudflare-cache.ts --deleted-photos

# 查看帮助
tsx scripts/purge-cloudflare-cache.ts --help
```

**环境变量**：
- `CLOUDFLARE_ZONE_ID` - Cloudflare Zone ID (必需)
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token (必需)
- `NEXT_PUBLIC_MEDIA_URL` - 媒体服务器 URL (自动模式需要)
- `DATABASE_TYPE` - 数据库类型 (postgresql 或 supabase)
- `DATABASE_HOST` - PostgreSQL 主机 (PostgreSQL 模式需要)
- `SUPABASE_URL` - Supabase URL (Supabase 模式需要)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key (Supabase 模式需要)

### 🗄️ 数据库工具

| 脚本 | 描述 | 用法 |
|------|------|------|
| `create-admin.ts` | 创建管理员账户 | `tsx scripts/create-admin.ts [email] [password]` |
| `cleanup-failed-photos.ts` | 清理失败的照片 | `tsx scripts/cleanup-failed-photos.ts` |

### 🎨 图标工具

| 脚本 | 描述 | 用法 |
|------|------|------|
| `icon-tools.js` | PWA 图标工具集，支持生成图标和去除水印 | `node scripts/icon-tools.js [命令]` |

**命令**：
- `generate` - 生成 PWA 图标（各种尺寸）
- `remove-watermark` - 去除图标水印

**示例**：
```bash
# 生成图标
node scripts/icon-tools.js generate

# 去除水印（使用默认文件）
node scripts/icon-tools.js remove-watermark

# 去除水印（指定文件并裁剪）
node scripts/icon-tools.js remove-watermark icon.png \
  --crop-x=10 --crop-y=10 --crop-width=492 --crop-height=492
```

### 📚 文档工具

| 脚本 | 描述 | 用法 |
|------|------|------|
| `create-example-docs.py` | 创建文档的示例版本，用占位符替换敏感信息 | `python3 scripts/create-example-docs.py` |

**功能**：
- 自动检测并替换敏感信息（Supabase URLs、JWT tokens、API keys 等）
- 为文档创建 `.example.md` 版本
- 添加警告信息，提示这是示例文档

---

## 🎯 快速参考

### 一键部署（推荐）

```bash
# 在服务器上直接运行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/deploy.sh | bash

# 或从本地部署到远程服务器
bash scripts/deploy.sh <服务器IP> [用户名]
```

### 本地开发环境设置

```bash
# 引导式设置
bash scripts/setup.sh

# 只启动内网服务（MinIO、Redis、数据库）
bash scripts/start-internal-services.sh
```

### 字体文件设置

```bash
# 一键设置字体文件（推荐）
bash scripts/setup-fonts.sh
```

### 安全检查

```bash
# 提交代码前检查
bash scripts/check-security.sh
```

---

## 🔧 依赖要求

- **Node.js** >= 20.0.0 (用于 TypeScript/JavaScript 脚本)
- **Python** >= 3.6 (用于 Python 脚本)
- **tsx** (用于运行 TypeScript 脚本): `pnpm add -g tsx`
- **sharp** (用于图标处理): 已包含在 `apps/web/node_modules` 中

---

## 📝 脚本整合说明

为了简化维护，以下脚本已被整合：

### 已整合的脚本

1. **Cloudflare 缓存清除**
   - ❌ `purge-cf-cache.sh` (已删除)
   - ❌ `purge-deleted-photos-cache.ts` (已删除)
   - ✅ `purge-cloudflare-cache.ts` (整合版)

2. **图标处理**
   - ❌ `generate-icons.js` (已删除)
   - ❌ `remove-watermark.js` (已删除)
   - ✅ `icon-tools.js` (整合版)

3. **Worker 管理**
   - ❌ `setup-worker-api-key.sh` (已删除，功能已包含在 `update-worker-on-server.sh` 中)

4. **字体设置**
   - ✅ `setup-fonts.sh` (推荐使用)
   - ⚠️ `download-fonts.sh` (已弃用，保留向后兼容)

---

## 📚 相关文档

- [部署指南](../docs/i18n/zh-CN/DEPLOYMENT.md) - 详细部署步骤
- [开发指南](../docs/DEVELOPMENT.md) - 开发环境设置
- [安全指南](../docs/SECURITY.md) - 安全最佳实践
- [字体配置指南](../docs/FONTS.md) - 字体文件下载和配置
- [部署脚本总结](./DEPLOYMENT_SCRIPTS.md) - 部署脚本详细说明

---

## ✅ 脚本状态

所有脚本已更新并支持：
- ✅ PostgreSQL（默认）
- ✅ Supabase（向后兼容）
- ✅ 环境变量配置
- ✅ 错误处理和用户友好的消息
- ✅ 清晰的文档和注释
