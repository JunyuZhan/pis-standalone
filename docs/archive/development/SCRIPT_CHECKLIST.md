# 脚本检查清单

> 所有脚本的检查和更新状态

## ✅ 已完成的更新

### 1. 部署脚本
- ✅ `scripts/deploy.sh` - 已更新仓库 URL，支持 PostgreSQL 和 Supabase
- ✅ `scripts/install.sh` - 已更新仓库 URL
- ✅ `docker/deploy.sh` - 已添加自动数据库初始化检测

### 2. 服务管理脚本
- ✅ `scripts/start-internal-services.sh` - 已更新支持 PostgreSQL 和混合部署模式
- ✅ `scripts/update-worker-on-server.sh` - 已改进项目目录检测，支持环境变量

### 3. 验证脚本
- ✅ `scripts/verify-deployment.sh` - 已添加 PostgreSQL 检查，支持动态数据库类型检测
- ✅ `scripts/check-security.sh` - 已更新 Supabase 检查注释

### 4. 配置脚本
- ✅ `scripts/setup.sh` - 已更新数据库初始化说明，强调自动初始化

### 5. TypeScript 工具脚本
- ✅ `scripts/create-admin.ts` - 已使用 PostgreSQL，无需更新
- ✅ `scripts/cleanup-failed-photos.ts` - 已使用 PostgreSQL，无需更新
- ✅ `scripts/purge-cloudflare-cache.ts` - 已支持 PostgreSQL 和 Supabase

### 6. 其他脚本
- ✅ `scripts/dev-with-ssl-fix.sh` - 开发工具，无需更新
- ✅ `scripts/fix-ssl.sh` - 开发工具，无需更新
- ✅ `scripts/icon-tools.js` - 工具脚本，无需更新
- ✅ `scripts/create-example-docs.py` - 文档工具，无需更新

## 📋 脚本功能说明

### 部署相关
- **`scripts/deploy.sh`** - 一键部署脚本（支持远程部署）
- **`scripts/install.sh`** - 一键安装脚本（克隆代码并运行部署向导）
- **`docker/deploy.sh`** - Docker 部署向导（支持完全自托管和混合部署）

### 服务管理
- **`scripts/start-internal-services.sh`** - 启动内网服务（MinIO、Redis、PostgreSQL）
- **`scripts/update-worker-on-server.sh`** - 更新 Worker 服务

### 验证和检查
- **`scripts/verify-deployment.sh`** - 部署验证脚本（检查服务状态、健康检查）
- **`scripts/check-security.sh`** - 安全检查脚本（检查硬编码密钥、URL 等）

### 配置
- **`scripts/setup.sh`** - 引导式配置脚本（本地开发/生产环境）

### 数据库工具
- **`scripts/create-admin.ts`** - 创建管理员账户（PostgreSQL）
- **`scripts/cleanup-failed-photos.ts`** - 清理失败的照片（PostgreSQL）

### 其他工具
- **`scripts/purge-cloudflare-cache.ts`** - Cloudflare CDN 缓存清除（支持 PostgreSQL 和 Supabase）
- **`scripts/dev-with-ssl-fix.sh`** - 开发环境 SSL 修复（macOS）
- **`scripts/fix-ssl.sh`** - SSL 证书修复脚本（macOS）
- **`scripts/icon-tools.js`** - PWA 图标生成工具
- **`scripts/create-example-docs.py`** - 文档示例生成工具

## 🔧 最佳实践

### 1. 路径处理
- ✅ 使用环境变量替代硬编码路径（如 `DEPLOY_DIR`, `ENV_FILE_PATH`, `PROJECT_DIR`）
- ✅ 支持自动检测项目目录
- ✅ 支持相对路径和绝对路径

### 2. 数据库支持
- ✅ 所有脚本默认支持 PostgreSQL
- ✅ 向后兼容 Supabase（通过 `DATABASE_TYPE` 环境变量）
- ✅ 自动检测数据库类型

### 3. 错误处理
- ✅ 使用 `set -e` 确保错误时退出
- ✅ 提供清晰的错误消息
- ✅ 支持非交互模式（通过环境变量）

### 4. 文档和注释
- ✅ 所有脚本都有清晰的注释
- ✅ 说明使用方法和环境变量
- ✅ 标记向后兼容功能

## 📝 注意事项

### 硬编码路径
以下脚本仍使用默认路径（但支持环境变量覆盖）：
- `scripts/verify-deployment.sh` - 默认 `/opt/pis/.env`（可通过 `ENV_FILE_PATH` 覆盖）
- `scripts/deploy.sh` - 默认 `/opt/pis`（可通过 `DEPLOY_DIR` 覆盖）
- `scripts/update-worker-on-server.sh` - 自动检测多个常见路径（支持 `PROJECT_DIR` 环境变量）

### 向后兼容
以下脚本保留 Supabase 支持（向后兼容）：
- `scripts/verify-deployment.sh` - 自动检测数据库类型
- `scripts/purge-cloudflare-cache.ts` - 支持两种数据库类型
- `scripts/start-internal-services.sh` - 支持两种部署模式

## ✅ 检查完成

所有脚本已检查并更新，符合最佳实践：
- ✅ 支持 PostgreSQL（默认）
- ✅ 向后兼容 Supabase
- ✅ 使用环境变量替代硬编码路径
- ✅ 清晰的文档和注释
- ✅ 错误处理和用户友好的消息
