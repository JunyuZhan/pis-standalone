# Docker Compose 文件说明

> PIS 项目包含多个 Docker Compose 配置文件，用于不同的部署场景

## 📋 文件列表

### 1. `docker-compose.standalone.yml` ⭐ **推荐**

**用途**: 完全自托管部署（所有服务都在本地）

**包含服务**:
- PostgreSQL - 数据库
- MinIO - 对象存储
- Redis - 任务队列/缓存
- Worker - 图片处理服务
- Web - Next.js 前端
- Nginx - 反向代理

**特点**:
- ✅ 数据库自动初始化（首次启动时）
- ✅ 包含所有必需的服务
- ✅ 适合完全自托管场景
- ✅ 推荐用于生产环境

**使用方法**:
```bash
cd docker
docker-compose -f docker-compose.standalone.yml up -d
```

---

### 2. `docker-compose.yml`

**用途**: 混合部署模式（Worker + 存储）

**包含服务**:
- MinIO - 对象存储
- Redis - 任务队列/缓存
- Worker - 图片处理服务

**特点**:
- ✅ 仅包含后端服务
- ✅ Web 前端部署在 Vercel（可选）
- ✅ 数据库使用外部 PostgreSQL 或 Supabase（向后兼容）
- ✅ 适合混合部署场景

**使用方法**:
```bash
cd docker
docker-compose up -d
```

---

### 3. `docker-compose.postgresql.yml`

**用途**: PostgreSQL 版本（仅 Worker + 存储，使用 Docker 内 PostgreSQL）

**包含服务**:
- PostgreSQL - 数据库（端口 15432）
- MinIO - 对象存储
- Redis - 任务队列/缓存
- Worker - 图片处理服务

**特点**:
- ✅ 包含 PostgreSQL 数据库（Docker 容器）
- ✅ 数据库自动初始化（首次启动时）
- ✅ 不包含 Web 和 Nginx（需要单独部署）
- ⚠️ 推荐使用 `docker-compose.standalone.yml` 替代

**使用方法**:
```bash
cd docker
docker-compose -f docker-compose.postgresql.yml up -d
```

---

## 🎯 选择指南

### 场景 1: 完全自托管（推荐）

**使用**: `docker-compose.standalone.yml`

**适用场景**:
- 所有服务都在本地服务器
- 需要完全控制所有组件
- 内网部署或私有云部署

**优点**:
- 数据完全私有
- 无需外部依赖
- 统一管理

---

### 场景 2: 混合部署

**使用**: `docker-compose.yml`

**适用场景**:
- Web 前端部署在 Vercel
- 数据库使用 Supabase（向后兼容）或外部 PostgreSQL
- Worker 和存储服务在本地服务器

**优点**:
- 前端部署简单（Vercel）
- 数据库托管（Supabase）
- 仅需管理 Worker 和存储

---

### 场景 3: 仅后端服务

**使用**: `docker-compose.postgresql.yml` 或 `docker-compose.yml`

**适用场景**:
- Web 前端部署在其他地方
- 需要本地 PostgreSQL 数据库
- 仅需要 Worker 和存储服务

**注意**: 推荐使用 `docker-compose.standalone.yml` 替代

---

## 🔄 数据库初始化

### 自动初始化（推荐）

以下配置文件支持自动数据库初始化：
- ✅ `docker-compose.standalone.yml` - 自动初始化
- ✅ `docker-compose.postgresql.yml` - 自动初始化

**说明**: PostgreSQL 容器会在首次启动时自动执行 `init-postgresql-db.sql`

### 手动初始化

如果使用外部数据库或数据卷已存在：

```bash
# 外部 PostgreSQL
psql -U pis -d pis -f docker/init-postgresql-db.sql

# Docker 容器内执行
docker exec -i pis-postgres psql -U pis -d pis < docker/init-postgresql-db.sql
```

---

## 📊 对比表

| 特性 | standalone.yml | docker-compose.yml | postgresql.yml |
|------|----------------|-------------------|----------------|
| PostgreSQL | ✅ (自动初始化) | ❌ (外部) | ✅ (自动初始化) |
| MinIO | ✅ | ✅ | ✅ |
| Redis | ✅ | ✅ | ✅ |
| Worker | ✅ | ✅ | ✅ |
| Web | ✅ | ❌ | ❌ |
| Nginx | ✅ | ❌ | ❌ |
| 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## 🚀 快速开始

### 完全自托管（推荐）

```bash
cd docker
docker-compose -f docker-compose.standalone.yml up -d
```

### 混合部署

```bash
cd docker
docker-compose up -d
```

---

## 📝 注意事项

1. **数据库初始化**: `standalone.yml` 和 `postgresql.yml` 支持自动初始化
2. **端口冲突**: `postgresql.yml` 使用 15432 端口避免冲突
3. **环境变量**: 所有配置文件都使用根目录的 `.env` 文件
4. **数据卷**: 不同配置文件使用不同的数据卷名称

---

## 🔗 相关文档

- [Docker 部署指南](./README.md)
- [存储卷管理](./VOLUMES.md)
- [环境变量配置](../docs/ENVIRONMENT_VARIABLES.md)
