# 部署脚本

本目录包含所有部署相关的脚本。

## 📋 脚本列表

| 脚本 | 描述 | 用法 |
|------|------|------|
| `install.sh` | 一键安装脚本（克隆代码并运行部署向导） | `curl -sSL <URL> \| bash` |
| `deploy.sh` | 一键部署脚本，支持本地和远程部署 | `bash scripts/deploy/deploy.sh [服务器IP] [用户名]` |
| `setup.sh` | 引导式部署脚本，用于本地开发环境设置 | `bash scripts/deploy/setup.sh` |
| `one-click-deploy.sh` | 一键部署脚本（简化版） | `bash scripts/deploy/one-click-deploy.sh` |
| `start-internal-services.sh` | 只启动内网容器服务（MinIO、Redis、数据库等） | `bash scripts/deploy/start-internal-services.sh` |
| `verify-deployment.sh` | 部署验证脚本，端到端验证部署是否成功 | `bash scripts/deploy/verify-deployment.sh [SSH_HOST]` |
| `update-worker-on-server.sh` | Worker 更新脚本，在服务器上拉取最新代码并更新 Worker 服务 | `bash scripts/deploy/update-worker-on-server.sh` |

## 🚀 快速开始

### 方法一：一键安装（推荐）

```bash
# 在服务器上直接运行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/deploy/install.sh | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/deploy/install.sh | bash
```

### 方法二：本地部署到远程服务器

```bash
bash scripts/deploy/deploy.sh <服务器IP> [用户名]
```

### 方法三：本地开发环境设置

```bash
# 引导式设置
bash scripts/deploy/setup.sh

# 只启动内网服务（MinIO、Redis、数据库）
bash scripts/deploy/start-internal-services.sh
```

## 📖 详细文档

更多详细信息请参考：[部署脚本详细说明](./DEPLOYMENT_SCRIPTS.md)
