# 重置数据库指南

## ⚠️ 警告

**重置数据库会删除所有数据！** 请确保：
- 已备份重要数据
- 了解重置的影响
- 在生产环境谨慎操作

## PostgreSQL（推荐）

### 方法一：使用 SQL 脚本（推荐）

```bash
# 连接到数据库
psql -U pis -d pis

# 执行重置脚本（删除所有表）
\i docker/reset-postgresql-db.sql

# 重新初始化数据库
\i docker/init-postgresql-db.sql
```

### 方法二：使用 Docker

```bash
# 停止服务
docker-compose -f docker/docker-compose.standalone.yml down

# 删除数据库卷（⚠️ 这会删除所有数据）
docker volume rm pis_postgres_data

# 重新启动服务（会自动初始化数据库）
docker-compose -f docker/docker-compose.standalone.yml up -d postgres
```

### 方法三：手动删除表

```sql
-- 连接到数据库
psql -U pis -d pis

-- 删除所有表（按依赖顺序）
DROP TABLE IF EXISTS photo_group_assignments CASCADE;
DROP TABLE IF EXISTS photo_groups CASCADE;
DROP TABLE IF EXISTS package_downloads CASCADE;
DROP TABLE IF EXISTS album_templates CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除所有函数和触发器
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS increment_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS decrement_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_album_view_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_album_selected_count() CASCADE;

-- 重新初始化数据库
\i docker/init-postgresql-db.sql
```

## Supabase（向后兼容）

### 方法一：使用 SQL 脚本

1. **打开 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目

2. **进入 SQL Editor**
   - 点击左侧菜单的 **SQL Editor**
   - 点击 **New query**

3. **执行重置脚本**
   ```sql
   -- 复制 docker/reset-supabase-db.sql 的全部内容
   -- 粘贴到 SQL Editor
   -- 点击 Run 执行
   ```

4. **重新初始化数据库**
   - 执行 `docker/init-supabase-db.sql` 重新创建表结构

### 方法二：使用 Supabase CLI

```bash
# 安装 Supabase CLI（如果未安装）
npm install -g supabase

# 登录 Supabase
supabase login

# 链接项目
supabase link --project-ref your-project-ref

# 重置数据库（会删除所有数据并重新运行迁移）
supabase db reset
```

## 方法三：手动删除表

在 Supabase Dashboard -> SQL Editor 中执行：

```sql
-- 删除所有表（按依赖顺序）
DROP TABLE IF EXISTS photo_group_assignments CASCADE;
DROP TABLE IF EXISTS photo_groups CASCADE;
DROP TABLE IF EXISTS package_downloads CASCADE;
DROP TABLE IF EXISTS album_templates CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除所有函数
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS increment_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS decrement_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_album_view_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_album_selected_count() CASCADE;
```

然后执行 `docker/init-supabase-db.sql` 重新创建表结构。

## 方法四：通过 Supabase Dashboard

1. 进入 **Database** → **Tables**
2. 逐个删除表（从依赖表开始）
3. 删除所有函数和触发器
4. 重新执行初始化脚本

## 重新初始化数据库

重置后，需要重新创建表结构：

### 使用 init-supabase-db.sql（推荐）

```sql
-- 在 Supabase SQL Editor 中执行 docker/init-supabase-db.sql
-- 此脚本会创建所有必需的表、函数和触发器
```

## 验证重置

执行以下查询验证表是否已创建：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 应该看到以下表：
-- - users
-- - albums
-- - photos
-- - album_templates
-- - package_downloads
-- - photo_groups
-- - photo_group_assignments
```

## 注意事项

1. **备份数据**：重置前务必备份重要数据
2. **存储文件**：重置数据库不会删除 MinIO/S3 中的图片文件
3. **环境变量**：确保 `.env` 文件中的数据库配置正确
4. **RLS 策略**：如果使用 Supabase，可能需要重新设置 Row Level Security (RLS) 策略

## 相关文件

- `docker/reset-supabase-db.sql` - 重置脚本（删除所有表和数据）
- `docker/init-supabase-db.sql` - 初始化脚本（创建所有表、函数和触发器）
