# 数据库适配器

## 概述

PIS 支持多种数据库后端。本目录包含数据库适配器的实现和测试，支持 PostgreSQL（自托管）和 Supabase（向后兼容）。

## 架构

- **PostgreSQLAdapter**: PostgreSQL 数据库适配器实现（推荐）
- **SupabaseAdapter**: Supabase 数据库适配器实现（向后兼容）
- **postgresql-compat**: PostgreSQL 兼容层，提供统一的数据库操作接口
- **supabase-compat**: Supabase 兼容层，提供统一的数据库操作接口
- **types**: 数据库适配器类型定义
- **index.ts**: 适配器工厂，根据 `DATABASE_TYPE` 环境变量选择适配器

## 运行测试

### 安装依赖

```bash
cd services/worker
pnpm install
```

### 运行所有测试

```bash
pnpm test
```

### 监听模式运行测试

```bash
pnpm test:watch
```

### 生成测试覆盖率报告

```bash
pnpm test:coverage
```

## 测试结构

### Supabase 适配器测试 (`supabase-adapter.test.ts`)

测试覆盖：
- ✅ 构造函数和配置验证
- ✅ `findOne` - 单条记录查询
- ✅ `findMany` - 多条记录查询（包括分页、排序、字段选择）
- ✅ `insert` - 插入记录（单条和批量）
- ✅ `update` - 更新记录
- ✅ `delete` - 删除记录
- ✅ `count` - 计数查询
- ✅ 错误处理

### 适配器工厂测试 (`index.test.ts`)

测试覆盖：
- ✅ 从配置创建 Supabase 适配器
- ✅ 从环境变量创建适配器
- ✅ 单例模式
- ✅ 错误处理（配置缺失）

## 配置

### PostgreSQL（推荐）

环境变量：
- `DATABASE_TYPE=postgresql`
- `DATABASE_HOST`: PostgreSQL 主机地址
- `DATABASE_PORT`: PostgreSQL 端口（默认 5432）
- `DATABASE_NAME`: 数据库名称
- `DATABASE_USER`: 数据库用户名
- `DATABASE_PASSWORD`: 数据库密码
- `DATABASE_SSL`: 是否使用 SSL（true/false）

### Supabase（向后兼容）

环境变量：
- `DATABASE_TYPE=supabase`
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key

## 注意事项

1. **数据库选择**: 通过 `DATABASE_TYPE` 环境变量选择数据库类型
2. **PostgreSQL 认证**: 使用用户名和密码进行认证
3. **Supabase 认证**: 使用 Service Role Key 绕过 RLS（Row Level Security）
4. **环境变量**: 确保正确配置数据库凭证
5. **单例模式**: 适配器使用单例模式，避免重复创建连接
