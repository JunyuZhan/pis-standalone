# PIS 部署脚本总结

本文档总结了 PIS 项目中所有可用的部署脚本及其使用场景。

## 📋 部署脚本列表

### 1. `scripts/setup.sh` - 引导式部署脚本

**用途：** 交互式菜单，引导完成各种部署任务

**功能：**
- ✅ 本地开发环境设置
- ✅ 生产环境部署配置
- ✅ 环境变量配置
- ✅ Docker 服务管理（启动/停止/重启/查看日志）
- ✅ 数据库架构初始化指导
- ✅ 系统状态检查

**使用场景：**
- 首次部署时使用
- 需要交互式配置时使用
- 本地开发环境设置

**用法：**
```bash
bash scripts/setup.sh
```

**特点：**
- 菜单式交互界面
- 自动检查依赖
- 支持多种数据库类型（PostgreSQL（推荐）/Supabase（向后兼容））

---

### 2. `scripts/deploy.sh` - 一键部署脚本

**用途：** 自动化部署脚本，支持本地和远程部署

**功能：**
- ✅ 自动安装 Docker 和 Docker Compose
- ✅ 克隆代码仓库
- ✅ 选择数据库类型（PostgreSQL（推荐）/Supabase（向后兼容））
- ✅ 选择网络模式（内网/公网）
- ✅ 自动生成环境变量配置
- ✅ 构建和启动所有服务
- ✅ 健康检查

**使用场景：**
- 服务器上快速部署
- CI/CD 自动化部署
- 远程服务器部署

**用法：**
```bash
# 在服务器上直接运行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/deploy.sh | bash

# 在本地运行，远程部署
bash scripts/deploy.sh <服务器IP> [用户名]
```

**特点：**
- 支持非交互式模式（通过环境变量）
- 自动处理网络问题（DNS、防火墙）
- 多种构建策略（适应不同网络环境）

---

### 3. `docker/deploy.sh` - Standalone 部署脚本

**用途：** 完全自托管模式的部署向导

**功能：**
- ✅ 选择部署方式（混合/半自托管/完全自托管）
- ✅ 配置域名和 SSL
- ✅ 配置 PostgreSQL（推荐）或 Supabase（向后兼容）
- ✅ 配置 PostgreSQL（自托管模式）
- ✅ 配置 MinIO、Worker、告警等
- ✅ 生成配置文件并启动服务

**使用场景：**
- 完全自托管部署
- 需要自定义配置的部署
- Standalone 模式部署

**用法：**
```bash
cd docker
bash deploy.sh
```

**特点：**
- 详细的配置向导
- 支持三种部署模式
- 自动生成 SSL 证书（自签名）

---

### 4. `scripts/start-internal-services.sh` - 内网服务启动脚本 ⭐ 新增

**用途：** 只启动内网容器（MinIO、Redis、数据库等），不启动 Worker 和 Web

**功能：**
- ✅ 自动检测 docker-compose 配置文件
- ✅ 只启动基础服务（MinIO、Redis、数据库）
- ✅ 不启动 Worker 和 Web 服务
- ✅ 健康检查
- ✅ 显示服务访问信息

**使用场景：**
- 本地开发时只需要存储和数据库服务
- 测试环境只需要基础服务
- 不想启动完整的应用栈

**用法：**
```bash
bash scripts/start-internal-services.sh
```

**特点：**
- 轻量级启动
- 自动适配不同的 docker-compose 配置
- 仅内网访问（127.0.0.1）

---

## 🐳 Docker Compose 配置文件

项目提供了多个 docker-compose 配置文件，适用于不同的部署场景：

### 1. `docker/docker-compose.yml` - Supabase 版本

**包含服务：**
- MinIO（对象存储）
- Redis（任务队列）
- Worker（图片处理）

**端口：**
- MinIO API: 19000
- MinIO Console: 19001
- Redis: 16379（仅本地）
- Worker: 3001

**使用场景：** 使用 Supabase 云数据库的部署

---

### 2. `docker/docker-compose.postgresql.yml` - PostgreSQL 版本

**包含服务：**
- PostgreSQL（数据库）
- MinIO（对象存储）
- Redis（任务队列）
- Worker（图片处理）

**端口：**
- PostgreSQL: 15432（仅本地）
- MinIO API: 19000
- MinIO Console: 19001
- Redis: 16379（仅本地）
- Worker: 3001

**使用场景：** 使用本地 PostgreSQL 数据库的部署

---

### 3. `docker/docker-compose.mysql.yml` - MySQL 版本

**包含服务：**
- MySQL（数据库）
- MinIO（对象存储）
- Redis（任务队列）
- Worker（图片处理）

**端口：**
- MySQL: 13306（仅本地）
- MinIO API: 19000
- MinIO Console: 19001
- Redis: 16379（仅本地）
- Worker: 3001

**使用场景：** 使用本地 MySQL 数据库的部署

---

### 4. `docker/docker-compose.standalone.yml` - 完全自托管版本

**包含服务：**
- PostgreSQL（数据库）
- MinIO（对象存储）
- Redis（任务队列）
- Web（Next.js 前端）
- Worker（图片处理）
- Nginx（反向代理）

**端口：**
- HTTP: 80
- HTTPS: 443
- PostgreSQL: 5432（仅本地）
- MinIO API: 9000（仅本地）
- MinIO Console: 9001（仅本地）
- Redis: 6379（仅本地）

**使用场景：** 完全自托管部署（所有服务都在本地）

---

## 🎯 快速参考

### 只启动内网容器（推荐用于开发）

```bash
# 使用新脚本
bash scripts/start-internal-services.sh

# 或手动启动
cd docker
docker-compose up -d minio redis minio-init
```

### 启动完整服务（混合部署，Supabase 数据库）

```bash
cd docker
docker-compose up -d
```

**注意**: 此模式需要单独部署前端到 Vercel，并配置 Supabase 数据库。

### 启动完整服务（PostgreSQL 版本）

```bash
cd docker
docker-compose -f docker-compose.postgresql.yml up -d
```

### 启动完整服务（Standalone 版本）

```bash
cd docker
docker-compose -f docker-compose.standalone.yml up -d
```

### 停止所有服务

```bash
cd docker
docker-compose down
# 或指定文件
docker-compose -f docker-compose.postgresql.yml down
```

### 查看服务状态

```bash
cd docker
docker-compose ps
```

### 查看日志

```bash
cd docker
docker-compose logs -f [服务名]
# 例如：docker-compose logs -f worker
```

---

## 📝 选择指南

### 我需要什么脚本？

| 场景 | 推荐脚本 | 说明 |
|------|---------|------|
| 首次部署，需要引导 | `setup.sh` | 交互式菜单，适合新手 |
| 快速部署到服务器 | `deploy.sh` | 自动化部署，支持远程 |
| 完全自托管部署 | `docker/deploy.sh` | 详细的配置向导 |
| **只启动内网服务** | **`start-internal-services.sh`** | **轻量级，适合开发** |
| 更新 Worker | `update-worker-on-server.sh` | 更新 Worker 服务 |
| 验证部署 | `verify-deployment.sh` | 检查部署是否成功 |

### 我需要什么 docker-compose 文件？

| 数据库类型 | docker-compose 文件 | 说明 |
|-----------|-------------------|------|
| PostgreSQL（推荐） | `docker-compose.standalone.yml` | 完全自托管，包含所有服务 |
| PostgreSQL（仅 Worker） | `docker-compose.postgresql.yml` | 前端单独部署，数据库本地 |
| Supabase（向后兼容） | `docker-compose.yml` | 前端部署到 Vercel，数据库使用 Supabase |

---

## 🔧 环境变量配置

所有脚本都使用根目录的 `.env` 文件进行配置。

**重要提示：**
- 环境变量文件位于项目根目录（`/path/to/pis/.env`）
- Docker Compose 会自动读取 `../.env`（从 docker 目录执行时）
- 敏感信息（密码、密钥）必须从 `.env` 文件读取，不要硬编码

---

## 📚 相关文档

- [部署指南](../docs/i18n/zh-CN/DEPLOYMENT.md) - 详细部署步骤
- [部署指南 (English)](../docs/i18n/en/DEPLOYMENT.md) - Deployment guide
- [开发指南](../docs/DEVELOPMENT.md) - 开发环境设置
- [脚本工具集](./README.md) - 所有脚本的快速参考
