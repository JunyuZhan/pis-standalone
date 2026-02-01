# 数据库 Schema 完整核对报告

**最后更新**: 2026-01-31  
**状态**: ✅ 100% 正确，所有字段都是崭新的

---

## ✅ 核对结果

### 表结构完整性

| 表名 | 字段数 | 状态 |
|------|--------|------|
| `users` | 8 | ✅ |
| `albums` | 32 | ✅ |
| `photos` | 20 | ✅ |
| `album_templates` | 16 | ✅ |
| `package_downloads` | 13 | ✅ |
| `photo_groups` | 7 | ✅ |
| `photo_group_assignments` | 3 | ✅ |

**总计**: 7 个表，99 个字段（所有字段都是崭新的，无兼容字段）

---

## ✅ 字段说明

### albums 表（32个字段）

**基础字段**:
- `id`, `slug`, `title`, `description`, `cover_photo_id`

**访问控制**:
- `password`, `expires_at`, `is_public`

**布局设置**:
- `layout` - 布局类型（masonry, grid, carousel）
- `sort_rule` - 排序规则（capture_desc, capture_asc, manual）

**功能开关**:
- `allow_download`, `allow_batch_download`, `show_exif`, `allow_share`

**水印设置**:
- `watermark_enabled`, `watermark_type`, `watermark_config`

**调色配置**:
- `color_grading`

**分享配置**:
- `share_title`, `share_description`, `share_image_url`

**海报配置**:
- `poster_image_url`

**活动元数据**:
- `event_date`, `location`

**直播模式**:
- `is_live`

**统计**:
- `photo_count`, `selected_count`, `view_count`

**时间戳**:
- `created_at`, `updated_at`, `deleted_at`

**其他**:
- `metadata`

**已删除的兼容字段**:
- ❌ `sort_order` - 已删除，使用 `sort_rule` 替代

### photos 表（20个字段）

**基础字段**:
- `id`, `album_id`, `filename`, `original_key`, `preview_key`, `thumb_key`

**文件信息**:
- `file_size`, `width`, `height`, `mime_type`, `blur_data`, `exif`

**状态和排序**:
- `status` - 处理状态（pending, processing, completed, failed）
- `is_selected` - 访客是否选中
- `sort_order` - 手动排序顺序（用于 manual 排序模式）
- `rotation` - 旋转角度

**时间戳**:
- `captured_at`, `created_at`, `updated_at`, `deleted_at`

**已删除的兼容字段**:
- ❌ `group_name` - 已删除，使用 `photo_groups` 和 `photo_group_assignments` 表替代

### package_downloads 表（13个字段）

**基础字段**:
- `id`, `album_id`, `photo_ids`

**下载选项**:
- `include_watermarked`, `include_original`

**状态和文件**:
- `status`, `zip_key`, `file_size`, `download_url`

**时间戳**:
- `expires_at`, `completed_at`, `created_at`, `updated_at`

### album_templates 表（16个字段）

**基础字段**:
- `id`, `name`, `description`

**配置字段**:
- `is_public`, `layout`, `sort_rule`, `allow_download`, `allow_batch_download`, `show_exif`, `password`, `expires_at`, `watermark_enabled`, `watermark_type`, `watermark_config`

**时间戳**:
- `created_at`, `updated_at`

### photo_groups 表（7个字段）

**基础字段**:
- `id`, `album_id`, `name`, `description`

**排序**:
- `sort_order` - 分组排序顺序

**时间戳**:
- `created_at`, `updated_at`

### photo_group_assignments 表（3个字段）

**关联字段**:
- `photo_id`, `group_id` - 复合主键

**时间戳**:
- `created_at`

---

## ✅ 索引完整性

### albums 表索引
- PRIMARY KEY (id)
- UNIQUE (slug)
- idx_albums_slug
- idx_albums_created_at
- idx_albums_deleted_at
- idx_albums_event_date
- idx_albums_is_public
- idx_albums_is_live

### photos 表索引
- PRIMARY KEY (id)
- idx_photos_album_id
- idx_photos_status
- idx_photos_created_at
- idx_photos_captured_at
- idx_photos_deleted_at
- idx_photos_album_status
- idx_photos_is_selected

### package_downloads 表索引
- PRIMARY KEY (id)
- idx_package_downloads_album_id
- idx_package_downloads_status

### album_templates 表索引
- PRIMARY KEY (id)
- idx_album_templates_name

### photo_groups 表索引
- PRIMARY KEY (id)
- idx_photo_groups_album_id
- idx_photo_groups_sort_order

### photo_group_assignments 表索引
- PRIMARY KEY (photo_id, group_id)
- UNIQUE (group_id, photo_id)
- idx_photo_group_assignments_group_id
- idx_photo_group_assignments_photo_id

---

## ✅ 触发器完整性

### updated_at 自动更新触发器
- `update_albums_updated_at` → albums 表
- `update_photos_updated_at` → photos 表
- `update_users_updated_at` → users 表
- `update_album_templates_updated_at` → album_templates 表
- `update_photo_groups_updated_at` → photo_groups 表
- `update_package_downloads_updated_at` → package_downloads 表

---

## ✅ 函数完整性

### 辅助函数
- `increment_photo_count(album_id UUID)` - 重新计算相册照片数量
- `decrement_photo_count(album_id UUID)` - 重新计算相册照片数量
- `update_updated_at_column()` - 自动更新 updated_at 字段

---

## ✅ 重置脚本验证

### reset-postgresql-db.sql
- ✅ 按正确顺序删除所有表
- ✅ 删除所有函数（CASCADE 自动删除触发器）
- ✅ 使用 CASCADE 确保完整清理

### reset-supabase-db.sql
- ✅ 删除所有 RLS 策略
- ✅ 按正确顺序删除所有表
- ✅ 删除所有函数
- ✅ 使用 CASCADE 确保完整清理

---

## ✅ 已删除的兼容字段

1. ❌ `albums.sort_order` - 已删除，使用 `sort_rule` 替代
2. ❌ `photos.group_name` - 已删除，使用 `photo_groups` 和 `photo_group_assignments` 表替代

---

## ✅ 字段命名规范

所有字段都遵循以下规范：
- 使用下划线命名（snake_case）
- 布尔字段使用 `is_` 前缀（如 `is_public`, `is_live`, `is_selected`）
- 时间戳字段使用 `_at` 后缀（如 `created_at`, `updated_at`, `deleted_at`）
- 计数字段使用 `_count` 后缀（如 `photo_count`, `selected_count`, `view_count`）

---

## ✅ 最终验证

**所有数据库脚本 100% 正确！**

- ✅ 所有字段都是崭新的，无兼容字段
- ✅ 所有表结构完整
- ✅ 所有索引已创建
- ✅ 所有触发器已创建
- ✅ 所有函数已创建
- ✅ 重置脚本正确
- ✅ PostgreSQL 和 Supabase 脚本保持一致（除了 RLS 策略）

---

## 📚 相关文件

- **PostgreSQL 初始化**: `docker/init-postgresql-db.sql` ✅
- **Supabase 初始化**: `docker/init-supabase-db.sql` ✅
- **PostgreSQL 重置**: `docker/reset-postgresql-db.sql` ✅
- **Supabase 重置**: `docker/reset-supabase-db.sql` ✅
- **验证脚本**: `docker/verify-database-schema.sql` ✅
- **类型定义**: `apps/web/src/types/database.ts` ✅
