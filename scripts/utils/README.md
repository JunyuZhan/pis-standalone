# 工具脚本

本目录包含各种实用工具脚本。

## 📋 脚本分类

### 🗄️ 数据库工具

| 脚本 | 描述 | 用法 |
|------|------|------|
| `create-admin.ts` | 创建管理员账户 | `tsx scripts/utils/create-admin.ts [email] [password]` |
| `cleanup-failed-photos.ts` | 清理失败的照片 | `tsx scripts/utils/cleanup-failed-photos.ts` |

**示例**：
```bash
# 创建管理员（交互式）
tsx scripts/utils/create-admin.ts

# 创建管理员（非交互式）
tsx scripts/utils/create-admin.ts admin@example.com your-password

# 清理失败的照片
tsx scripts/utils/cleanup-failed-photos.ts
```

### ☁️ CDN 缓存管理

| 脚本 | 描述 | 用法 |
|------|------|------|
| `purge-cloudflare-cache.ts` | Cloudflare CDN 缓存清除工具 | `tsx scripts/utils/purge-cloudflare-cache.ts [选项]` |

**用法**：
```bash
# 手动清除指定 URL
tsx scripts/utils/purge-cloudflare-cache.ts --urls <URL1> <URL2> ...

# 自动清除已删除照片的缓存
tsx scripts/utils/purge-cloudflare-cache.ts --deleted-photos

# 查看帮助
tsx scripts/utils/purge-cloudflare-cache.ts --help
```

**环境变量**：
- `CLOUDFLARE_ZONE_ID` - Cloudflare Zone ID (必需)
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token (必需)
- `NEXT_PUBLIC_MEDIA_URL` - 媒体服务器 URL (自动模式需要)
- `DATABASE_TYPE` - 数据库类型 (postgresql 或 supabase)
- `DATABASE_HOST` - PostgreSQL 主机 (PostgreSQL 模式需要)
- `SUPABASE_URL` - Supabase URL (Supabase 模式需要)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key (Supabase 模式需要)

### 🎨 图标工具

| 脚本 | 描述 | 用法 |
|------|------|------|
| `icon-tools.js` | PWA 图标工具集，支持生成图标和去除水印 | `node scripts/utils/icon-tools.js [命令]` |

**命令**：
- `generate` - 生成 PWA 图标（各种尺寸）
- `remove-watermark` - 去除图标水印

**示例**：
```bash
# 生成图标
node scripts/utils/icon-tools.js generate

# 去除水印（使用默认文件）
node scripts/utils/icon-tools.js remove-watermark

# 去除水印（指定文件并裁剪）
node scripts/utils/icon-tools.js remove-watermark icon.png \
  --crop-x=10 --crop-y=10 --crop-width=492 --crop-height=492
```

### 🔒 安全检查

| 脚本 | 描述 | 用法 |
|------|------|------|
| `check-security.sh` | 安全检查脚本，检查是否有敏感信息泄露风险 | `bash scripts/utils/check-security.sh` |

**检查项**：
- 敏感文件是否被 Git 跟踪
- Git 历史中是否有敏感文件
- 硬编码的 JWT tokens
- 数据库配置泄露（PostgreSQL/Supabase）
- AWS Access Keys
- 硬编码密码
- 私人域名泄露
- .gitignore 配置

**用法**：
```bash
# 提交代码前检查
bash scripts/utils/check-security.sh
```

### 🎨 字体设置

| 脚本 | 描述 | 用法 |
|------|------|------|
| `setup-fonts.sh` | 一键设置字体文件 | `bash scripts/utils/setup-fonts.sh` |

**用法**：
```bash
# 一键设置字体文件（推荐）
bash scripts/utils/setup-fonts.sh
```

### 📚 文档工具

| 脚本 | 描述 | 用法 |
|------|------|------|
| `create-example-docs.py` | 创建文档的示例版本，用占位符替换敏感信息 | `python3 scripts/utils/create-example-docs.py` |

**功能**：
- 自动检测并替换敏感信息（Supabase URLs、JWT tokens、API keys 等）
- 为文档创建 `.example.md` 版本
- 添加警告信息，提示这是示例文档

### 📋 日志查看

| 脚本 | 描述 | 用法 |
|------|------|------|
| `view-logs.sh` | 查看服务日志 | `bash scripts/utils/view-logs.sh [服务名]` |

**用法**：
```bash
# 查看所有服务日志
bash scripts/utils/view-logs.sh

# 查看特定服务日志
bash scripts/utils/view-logs.sh web
bash scripts/utils/view-logs.sh worker
```

---

## 🔧 依赖要求

- **Node.js** >= 20.0.0 (用于 TypeScript/JavaScript 脚本)
- **Python** >= 3.6 (用于 Python 脚本)
- **tsx** (用于运行 TypeScript 脚本): `pnpm add -g tsx`
- **sharp** (用于图标处理): 已包含在 `apps/web/node_modules` 中
