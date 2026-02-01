# PIS 脚本工具集

本目录包含 PIS 项目的各种实用脚本工具，按功能分类组织。

## 📁 目录结构

```
scripts/
├── deploy/          # 部署相关脚本
├── test/           # 测试相关脚本
├── utils/          # 工具脚本（数据库、CDN、图标等）
└── README.md       # 本文件
```

## 🚀 部署脚本 (`deploy/`)

部署相关的所有脚本，包括本地部署、远程部署、环境设置等。

**快速开始**：
```bash
# 一键部署（推荐）
bash scripts/deploy/install.sh

# 或从本地部署到远程服务器
bash scripts/deploy/deploy.sh <服务器IP> [用户名]
```

详细说明请参考：[部署脚本文档](./deploy/README.md)

## 🧪 测试脚本 (`test/`)

所有测试相关的脚本，包括单元测试、集成测试、E2E 测试等。

**快速开始**：
```bash
# 运行所有测试
bash scripts/test/run-tests.sh

# 运行完整测试套件
bash scripts/test/comprehensive-test.sh
```

详细说明请参考：[测试脚本文档](./test/README.md)

## 🔧 工具脚本 (`utils/`)

各种实用工具脚本，包括：
- 数据库工具（创建管理员、清理数据等）
- CDN 缓存管理
- 图标处理
- 安全检查
- 字体设置
- 日志查看

**常用工具**：
```bash
# 创建管理员账户
tsx scripts/utils/create-admin.ts [email] [password]

# 安全检查
bash scripts/utils/check-security.sh

# 设置字体
bash scripts/utils/setup-fonts.sh
```

详细说明请参考：[工具脚本文档](./utils/README.md)

---

## 🎯 快速参考

### 一键部署
```bash
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/deploy/install.sh | bash
```

### 本地开发环境设置
```bash
bash scripts/deploy/setup.sh
bash scripts/deploy/start-internal-services.sh
```

### 运行测试
```bash
bash scripts/test/run-tests.sh
```

### 创建管理员
```bash
tsx scripts/utils/create-admin.ts admin@example.com password
```

---

## 🔧 依赖要求

- **Node.js** >= 20.0.0 (用于 TypeScript/JavaScript 脚本)
- **Python** >= 3.6 (用于 Python 脚本)
- **tsx** (用于运行 TypeScript 脚本): `pnpm add -g tsx`
- **sharp** (用于图标处理): 已包含在 `apps/web/node_modules` 中

---

## 📚 相关文档

- [部署指南](../docs/i18n/zh-CN/DEPLOYMENT.md) - 详细部署步骤
- [开发指南](../docs/DEVELOPMENT.md) - 开发环境设置
- [安全指南](../docs/SECURITY.md) - 安全最佳实践
- [字体配置指南](../docs/FONTS.md) - 字体文件下载和配置
