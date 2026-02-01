# 📸 PIS - 私有化即时摄影分享系统

> Private Instant photo Sharing - 专为摄影师打造的私有化照片交付工具

<p align="center">
  <a href="https://github.com/JunyuZhan/pis-standalone/stargazers">
    <img src="https://img.shields.io/github/stars/JunyuZhan/pis-standalone?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <a href="https://star-history.com/#JunyuZhan/pis-standalone&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis-standalone&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis-standalone&type=Date" />
      <img src="https://api.star-history.com/svg?repos=JunyuZhan/pis-standalone&type=Date" alt="Star History Chart" />
    </picture>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/MinIO-Object%20Storage-C72E49?style=flat-square&logo=minio" alt="MinIO" />
  <img src="https://img.shields.io/badge/BullMQ-Redis-FF6B6B?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Sharp-图片处理-99CC00?style=flat-square" alt="Sharp" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <strong>📦 部署版本：</strong>
  <a href="https://github.com/JunyuZhan/pis-cloud">☁️ 云端版本</a> |
  <a href="https://github.com/JunyuZhan/pis-standalone">🏠 自托管版本</a> (当前)
</p>

---

## 🌟 核心功能

### ⚡ **即时交付与同步**
- 分钟级照片交付，实时同步
- FTP/命令行扫描同步，批量导入
- 分片上传，支持大文件

### 🖼️ **高级图片处理**
- 自动 EXIF 旋转 + 手动旋转
- 多尺寸：缩略图（400px）、预览图（2560px）、原图
- BlurHash 占位符，流畅加载
- BullMQ 并行处理（性能提升 13-33%）
- **NEW**: 图片风格预设（13种预设：人像、风景、通用）
  - 为整个相册应用统一的视觉风格
  - 实时预览（使用封面图）
  - 重新处理现有照片以应用新风格
  - 支持单张照片重新处理

### 🎨 **专业展示**
- 精美的瀑布流和网格布局
- 深色界面，移动端优化
- 灯箱模式，键盘导航
- 自定义启动页和动态海报生成

### 🖼️ **水印与保护**
- 最多 6 个水印同时使用
- 文字和 Logo 支持，9 宫格布局
- EXIF 隐私保护（自动移除 GPS）
- 批量水印处理

### 📦 **客户功能**
- 照片选择和批量 ZIP 下载
- **NEW**: 管理员控制的批量下载（默认关闭）
  - 批量下载需要管理员明确开启
  - 生成安全的 presigned URL
  - 一键下载已选照片
- 密码保护和过期时间
- 相册模板和访问统计

### 💰 **完全自托管部署**
- **架构**: 所有服务容器化（PostgreSQL + MinIO + Redis + Web + Worker + Nginx）
- **存储**: MinIO（自托管）
- **数据库**: PostgreSQL（自托管）
- **认证**: 自定义认证（用户名/密码）
- **Web 服务器**: Nginx 反向代理，支持 SSL
- 完全数据隐私，无外部依赖

---

## 🚀 快速开始

### 部署架构

**完全自托管部署**

- **前端**: 自托管（Docker + Nginx）
- **数据库**: PostgreSQL（自托管）
- **存储**: MinIO（自托管）
- **Worker**: 自托管（Docker）
- **认证**: 自定义认证（用户名/密码）

### 一键部署

**🚀 真正的一键部署（完全自动化，无需交互）**

```bash
# 一条命令完成所有部署（无需任何交互）
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/one-click-deploy.sh | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/one-click-deploy.sh | bash
```

此脚本会自动完成：
- ✅ 自动安装 Docker 和 Docker Compose（如果未安装）
- ✅ 自动克隆代码（如果不在项目目录）
- ✅ 自动生成所有配置文件和安全密钥
- ✅ 自动启动所有服务（PostgreSQL + MinIO + Redis + Web + Worker + Nginx）
- ✅ 自动创建管理员账户（首次登录时设置密码）

**📋 交互式部署（引导配置）**

```bash
# 交互式配置向导
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/install.sh | tr -d '\r' | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/install.sh | tr -d '\r' | bash
```

> 💡 **提示**: `tr -d '\r'` 命令可确保跨系统兼容性，移除 Windows 行尾。脚本本身也包含自动行尾清理机制作为备用方案。

或者手动安装：

```bash
git clone https://github.com/JunyuZhan/pis-standalone.git
cd pis-standalone/docker
bash deploy.sh
```

交互式脚本会引导您完成：
- ✅ 配置 PostgreSQL 数据库
- ✅ 自动生成安全密钥
- ✅ 配置存储（MinIO）
- ✅ 配置域名和 SSL
- ✅ 启动所有服务（PostgreSQL + MinIO + Redis + Web + Worker + Nginx）
- ✅ 创建管理员账号

> 📖 **详细指南**: [部署文档](docs/i18n/zh-CN/DEPLOYMENT.md)

---

### 本地开发

```bash
pnpm install
pnpm setup
pnpm dev
```

> 📖 **开发指南**: [开发文档](docs/DEVELOPMENT.md)

### 手动部署

<details>
<summary>点击展开手动部署步骤</summary>

#### 1. 配置 PostgreSQL 数据库

1. 启动 PostgreSQL 服务（通过 Docker Compose）
2. **执行数据库架构**：
   - 连接到 PostgreSQL 数据库
   - 执行数据库迁移脚本（参见部署文档）
   - ✅ 完成！
3. **创建管理员账号**：
   - 通过部署脚本自动创建
   - 或手动在数据库中创建用户
   - ✅ 此账号将用于登录 `/admin/login` 管理后台

#### 2. 配置环境变量

**统一配置** (根目录 `.env` 文件):
> ✅ **重要**: PIS 使用**统一的根目录配置**，`apps/web` 和 `services/worker` 都从根目录的 `.env` 读取配置。

```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 并填入你的配置
```

**示例 `.env` 文件**:
```bash
# 数据库配置
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/pis

# 存储配置（MinIO）
STORAGE_TYPE=minio
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=pis-photos

# Worker 服务
NEXT_PUBLIC_WORKER_URL=http://localhost:3001
WORKER_API_KEY=your-secret-api-key

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3. 启动服务

```bash
# 启动 Docker 服务
pnpm docker:up

# 启动开发服务器
pnpm dev
```

</details>

### 访问应用

| 地址 | 说明 |
|------|------|
| http://localhost:8080 | 首页 |
| http://localhost:8080/admin/login | 管理后台（使用部署脚本创建的管理员账号登录） |
| http://localhost:9001 | MinIO 控制台（用户名：`minioadmin`，密码：`minioadmin`，仅本地调试） |

> **注意**：生产环境使用 8080 端口，配合 frpc/ddnsto 内网穿透访问。详见 [部署指南](docs/i18n/zh-CN/DEPLOYMENT.md)。

> 💡 **首次登录**：使用部署脚本创建的管理员账号登录管理后台。

---

## 🌐 生产环境部署

### 选项 1：引导式部署（推荐）

引导式部署脚本提供交互式设置体验，并自动生成所有安全密钥。

```bash
# 克隆项目
git clone https://github.com/JunyuZhan/pis-standalone.git
cd pis-standalone

# 运行引导式部署（交互式）
bash docker/deploy.sh
```

脚本会引导你完成：
- ✅ 配置 PostgreSQL 数据库
- ✅ 自动生成安全密钥（API 密钥、密码）
- ✅ 配置存储（MinIO）
- ✅ 启动所有服务（PostgreSQL + MinIO + Redis + Web + Worker + Nginx）

**远程服务器部署：**

```bash
# 部署到远程服务器
bash docker/deploy.sh <服务器IP> <SSH用户>
# 示例: bash docker/deploy.sh 192.168.1.100 root
```

> 📖 **部署指南**: [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md)

### 选项 2：手动部署

1. **配置数据库** - 设置 PostgreSQL
2. **配置存储** - 设置 MinIO
3. **配置 Nginx** - 设置反向代理和 SSL
4. **启动服务** - 使用 Docker Compose 启动所有服务

> 📖 **详细部署指南**: [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md)

---

---

## 🏗️ 系统架构

**所有服务容器化：**

**Web** (Next.js) → **Nginx** (反向代理) → **Worker** (BullMQ + Sharp) → **存储** (MinIO)  
**数据库** (PostgreSQL) + **队列** (Redis) + **全部自托管**

---

## 🛠️ 常用命令

```bash
pnpm setup      # 引导式部署
pnpm dev        # 启动开发
pnpm build      # 构建生产版本
pnpm docker:up  # 启动 Docker 服务（MinIO + Redis）
pnpm lint       # 运行代码检查
```

---

## 📁 环境变量

关键变量: `DATABASE_URL`, `STORAGE_TYPE`, `STORAGE_ENDPOINT`, `NEXT_PUBLIC_APP_URL`, `WORKER_API_KEY`, `ALBUM_SESSION_SECRET`

**自动生成密钥**: 部署脚本会自动为以下变量生成安全的随机值：
- `STORAGE_ACCESS_KEY`、`STORAGE_SECRET_KEY`（MinIO 凭证）
- `WORKER_API_KEY`（Worker API 认证）
- `ALBUM_SESSION_SECRET`（JWT 会话签名）
- `DATABASE_PASSWORD`（PostgreSQL 密码）

> 📖 **完整配置指南**: 查看 [.env.example](.env.example) 了解所有可用选项

---

## 📄 许可证

MIT License © 2026 junyuzhan

查看 [LICENSE](LICENSE) 文件了解详情。

---

## 👤 作者

**junyuzhan**
- 邮箱: junyuzhan@outlook.com
- GitHub: [@junyuzhan](https://github.com/junyuzhan)

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

查看 [AUTHORS.md](AUTHORS.md) 了解贡献者列表。

---

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [PostgreSQL](https://www.postgresql.org/) - 关系型数据库
- [MinIO](https://min.io/) - 对象存储
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [BullMQ](https://docs.bullmq.io/) - 队列管理

---

## 🎨 新功能（最新版本）

### 图片风格预设
为整个相册应用专业的调色风格，提供13种精心调校的预设：
- **人像类**：清新人像、日系人像、写实人像、暖调人像、冷调人像
- **风景类**：自然风景、城市风光、日落风景、清新风景
- **通用类**：标准、高对比、柔和

**功能特点：**
- ✅ 相册级别统一风格应用
- ✅ 实时预览（使用封面图）
- ✅ 重新处理现有照片以应用新风格
- ✅ 支持单张照片重新处理
- ✅ 新上传照片自动应用风格

### 增强的批量下载
- ✅ 管理员控制的批量下载（默认关闭）
- ✅ 安全的 presigned URL 生成
- ✅ 一键下载已选照片

> 📖 **了解更多**：查看 [快速开始指南](./docs/QUICK_START.md) 和 [使用指南](./docs/USER_GUIDE.md)

---

## 📚 更多文档

- **[快速开始指南](./docs/QUICK_START.md)** - 3步上手新功能
- **[使用指南](./docs/USER_GUIDE.md)** - 图片风格预设和批量下载完整指南
- **[实现状态](./docs/IMPLEMENTATION_STATUS.md)** - 功能实现跟踪
- **[移动端优化](./docs/MOBILE_OPTIMIZATION.md)** - 移动端用户体验改进
- **[脚本工具集](./scripts/README.md)** - 所有可用脚本和工具

> 📚 **完整文档索引**: [docs/README.md](./docs/README.md)

### 快速开始
- [部署指南](docs/i18n/zh-CN/DEPLOYMENT.md) - 详细的部署步骤（包含一键部署快速开始）
- [部署检查清单](docs/DEPLOYMENT_CHECKLIST.md) - 部署前检查清单
- [脚本工具集](scripts/README.md) - 所有可用脚本和工具

### 开发与安全
- [开发指南](docs/DEVELOPMENT.md) - 开发环境搭建、代码规范、功能文档和所有功能说明
- [安全指南](docs/SECURITY.md) - 安全最佳实践、部署检查清单和开源前安全检查清单
- [脚本工具集](scripts/README.md) - 所有可用脚本和工具

---

## 🌍 语言

- [English](README.md)
- [中文 (Chinese)](README.zh-CN.md) (当前)

---

## ☕ 支持项目

如果这个项目对你有帮助，欢迎支持项目的持续开发！您的支持将帮助：
- 🐛 更快地修复 Bug
- ✨ 添加新功能
- 📚 完善文档
- 🎨 提升用户体验

<p align="center">
  <table>
    <tr>
      <td align="center">
        <img src="./assets/support/WeChat.jpg" alt="微信支付" width="200" />
        <br />
        <strong>微信支付</strong>
      </td>
      <td align="center" style="padding-left: 30px;">
        <img src="./assets/support/Alipay.jpg" alt="支付宝" width="200" />
        <br />
        <strong>支付宝</strong>
      </td>
    </tr>
  </table>
</p>

<p align="center">
  <strong>请我喝杯茶 ☕</strong>
</p>
