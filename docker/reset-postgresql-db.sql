-- ============================================
-- PIS PostgreSQL 数据库重置脚本
-- ============================================
-- ⚠️  警告：此脚本会删除所有数据！
-- 使用方法：
-- 1. 连接到数据库: psql -U pis -d pis
-- 2. 执行此脚本: \i docker/reset-postgresql-db.sql
-- 3. 重新初始化: \i docker/init-postgresql-db.sql
-- ============================================

-- 禁用外键约束检查（临时）
SET session_replication_role = 'replica';

-- ============================================
-- 删除所有表（按依赖顺序）
-- ============================================

-- 删除照片分组关联表
DROP TABLE IF EXISTS photo_group_assignments CASCADE;

-- 删除照片分组表
DROP TABLE IF EXISTS photo_groups CASCADE;

-- 删除打包下载表
DROP TABLE IF EXISTS package_downloads CASCADE;

-- 删除相册模板表
DROP TABLE IF EXISTS album_templates CASCADE;

-- 删除照片表
DROP TABLE IF EXISTS photos CASCADE;

-- 删除相册表
DROP TABLE IF EXISTS albums CASCADE;

-- 删除用户表
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 删除所有函数和触发器
-- ============================================

-- 删除触发器
DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
DROP TRIGGER IF EXISTS update_photos_updated_at ON photos;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS increment_photo_count_trigger ON photos;
DROP TRIGGER IF EXISTS decrement_photo_count_trigger ON photos;
DROP TRIGGER IF EXISTS increment_album_view_count_trigger ON albums;
DROP TRIGGER IF EXISTS update_album_selected_count_trigger ON photos;

-- 删除函数
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS increment_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS decrement_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_album_view_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_album_selected_count() CASCADE;

-- 恢复外键约束检查
SET session_replication_role = 'origin';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 数据库重置完成！';
    RAISE NOTICE '   所有表、函数和触发器已删除';
    RAISE NOTICE '';
    RAISE NOTICE '📝 下一步:';
    RAISE NOTICE '   执行 docker/init-postgresql-db.sql 重新创建表结构';
END $$;
