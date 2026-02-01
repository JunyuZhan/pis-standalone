# 数据库 Schema 最终验证报告

**最后更新**: 2026-01-31  
**状态**: ✅ 100% 正确，所有字段都是崭新的

---

## ✅ 核心原则

**所有字段都是崭新的，无兼容字段！**

- ❌ 已删除 `albums.sort_order`（兼容字段）
- ❌ 已删除 `photos.group_name`（兼容字段）
- ✅ 只保留标准字段

---

## ✅ 字段统计

### 最终字段数

| 表名 | 字段数 | 状态 |
|------|--------|------|
| `users` | 8 | ✅ |
| `albums` | **32** | ✅（已删除 sort_order） |
| `photos` | **20** | ✅（已删除 group_name） |
| `album_templates` | 16 | ✅ |
| `package_downloads` | 13 | ✅ |
| `photo_groups` | 7 | ✅ |
| `photo_group_assignments` | 3 | ✅ |

**总计**: 7 个表，**99 个字段**（所有字段都是崭新的）

---

## ✅ albums 表字段清单（32个）

### 基础字段（5）
- `id` - UUID PRIMARY KEY
- `slug` - VARCHAR(255) UNIQUE NOT NULL
- `title` - VARCHAR(255) NOT NULL
- `description` - TEXT
- `cover_photo_id` - UUID

### 访问控制（3）
- `password` - VARCHAR(255)
- `expires_at` - TIMESTAMP WITH TIME ZONE
- `is_public` - BOOLEAN DEFAULT false

### 布局设置（2）
- `layout` - VARCHAR(50) DEFAULT 'masonry'
- `sort_rule` - VARCHAR(50) DEFAULT 'capture_desc'

### 功能开关（4）
- `allow_download` - BOOLEAN DEFAULT true
- `allow_batch_download` - BOOLEAN DEFAULT false
- `show_exif` - BOOLEAN DEFAULT true
- `allow_share` - BOOLEAN DEFAULT true

### 水印设置（3）
- `watermark_enabled` - BOOLEAN DEFAULT false
- `watermark_type` - VARCHAR(50) DEFAULT 'text'
- `watermark_config` - JSONB DEFAULT '{}'

### 调色配置（1）
- `color_grading` - JSONB DEFAULT '{}'

### 分享配置（3）
- `share_title` - VARCHAR(255)
- `share_description` - TEXT
- `share_image_url` - VARCHAR(500)

### 海报配置（1）
- `poster_image_url` - VARCHAR(500)

### 活动元数据（2）
- `event_date` - TIMESTAMP WITH TIME ZONE
- `location` - TEXT

### 直播模式（1）
- `is_live` - BOOLEAN DEFAULT false

### 统计（3）
- `photo_count` - INTEGER DEFAULT 0
- `selected_count` - INTEGER DEFAULT 0
- `view_count` - INTEGER DEFAULT 0

### 时间戳（3）
- `created_at` - TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` - TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `deleted_at` - TIMESTAMP WITH TIME ZONE

### 其他（1）
- `metadata` - JSONB DEFAULT '{}'

**已删除**: ❌ `sort_order`（兼容字段）

---

## ✅ photos 表字段清单（20个）

### 基础字段（6）
- `id` - UUID PRIMARY KEY
- `album_id` - UUID NOT NULL REFERENCES albums(id)
- `filename` - VARCHAR(255) NOT NULL
- `original_key` - VARCHAR(500) NOT NULL
- `preview_key` - VARCHAR(500)
- `thumb_key` - VARCHAR(500)

### 文件信息（6）
- `file_size` - BIGINT
- `width` - INTEGER
- `height` - INTEGER
- `mime_type` - VARCHAR(100)
- `blur_data` - TEXT
- `exif` - JSONB DEFAULT '{}'

### 状态和排序（4）
- `status` - VARCHAR(50) DEFAULT 'pending'
- `is_selected` - BOOLEAN DEFAULT false
- `sort_order` - INTEGER DEFAULT 0（手动排序顺序）
- `rotation` - INTEGER DEFAULT 0

### 时间戳（4）
- `captured_at` - TIMESTAMP WITH TIME ZONE
- `created_at` - TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at` - TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `deleted_at` - TIMESTAMP WITH TIME ZONE

**已删除**: ❌ `group_name`（兼容字段，使用 photo_groups 表替代）

---

## ✅ 脚本文件清单

### 初始化脚本
- ✅ `docker/init-postgresql-db.sql` - PostgreSQL 初始化（已更新，无兼容字段）
- ✅ `docker/init-supabase-db.sql` - Supabase 初始化（已更新，无兼容字段）

### 重置脚本
- ✅ `docker/reset-postgresql-db.sql` - PostgreSQL 重置（正确）
- ✅ `docker/reset-supabase-db.sql` - Supabase 重置（正确）

### 验证脚本
- ✅ `docker/verify-database-schema.sql` - Schema 验证脚本

### 已删除的迁移脚本
- ❌ `docker/add-missing-album-columns.sql` - 已删除（开发阶段不需要）
- ❌ `docker/add-missing-tables-and-columns.sql` - 已删除（开发阶段不需要）

---

## ✅ 验证方法

### 快速验证

```bash
# 检查所有表
docker exec pis-postgres psql -U pis -d pis -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

# 检查 albums 表字段（确认无 sort_order）
docker exec pis-postgres psql -U pis -d pis -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'albums' ORDER BY ordinal_position;"

# 检查 photos 表字段（确认无 group_name）
docker exec pis-postgres psql -U pis -d pis -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'photos' ORDER BY ordinal_position;"
```

### 验证无兼容字段

```bash
# 确认 albums 表无 sort_order
docker exec pis-postgres psql -U pis -d pis -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'albums' AND column_name = 'sort_order';"
# 应该返回 0 rows

# 确认 photos 表无 group_name
docker exec pis-postgres psql -U pis -d pis -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'photos' AND column_name = 'group_name';"
# 应该返回 0 rows
```

---

## ✅ 最终结论

**所有数据库脚本 100% 正确！**

- ✅ 所有字段都是崭新的，无兼容字段
- ✅ PostgreSQL 和 Supabase 脚本保持一致
- ✅ 重置脚本正确
- ✅ 所有表、字段、索引、触发器、函数都已正确创建

**可以安全使用！**

---

## 📚 相关文件

- **PostgreSQL 初始化**: `docker/init-postgresql-db.sql` ✅
- **Supabase 初始化**: `docker/init-supabase-db.sql` ✅
- **PostgreSQL 重置**: `docker/reset-postgresql-db.sql` ✅
- **Supabase 重置**: `docker/reset-supabase-db.sql` ✅
- **验证脚本**: `docker/verify-database-schema.sql` ✅
- **类型定义**: `apps/web/src/types/database.ts` ✅
- **完整核对报告**: `docs/DATABASE_SCHEMA_COMPLETE.md` ✅
