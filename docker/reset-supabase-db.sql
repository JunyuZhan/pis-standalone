-- ============================================
-- PIS Supabase 数据库重置脚本
-- ============================================
-- ⚠️  警告：此脚本会删除所有数据！
-- 使用方法：
-- 1. 在 Supabase Dashboard -> SQL Editor 中执行
-- 2. 或者使用 Supabase CLI: supabase db reset
-- ============================================

-- 禁用外键约束检查（临时）
SET session_replication_role = 'replica';

-- ============================================
-- 删除所有 RLS 策略（如果存在）
-- ============================================
-- 注意：删除表时会自动删除策略，但显式删除更清晰

-- 删除 users 表策略
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- 删除 albums 表策略
DROP POLICY IF EXISTS "Public albums are viewable by everyone" ON albums;
DROP POLICY IF EXISTS "Users can view own albums" ON albums;
DROP POLICY IF EXISTS "Authenticated users can create albums" ON albums;
DROP POLICY IF EXISTS "Users can update own albums" ON albums;
DROP POLICY IF EXISTS "Users can delete own albums" ON albums;

-- 删除 photos 表策略
DROP POLICY IF EXISTS "Public album photos are viewable by everyone" ON photos;
DROP POLICY IF EXISTS "Users can view own album photos" ON photos;
DROP POLICY IF EXISTS "Users can insert photos" ON photos;
DROP POLICY IF EXISTS "Users can update own album photos" ON photos;
DROP POLICY IF EXISTS "Users can delete own album photos" ON photos;

-- 删除 album_templates 表策略
DROP POLICY IF EXISTS "Authenticated users can view templates" ON album_templates;
DROP POLICY IF EXISTS "Authenticated users can create templates" ON album_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON album_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON album_templates;

-- 删除 package_downloads 表策略
DROP POLICY IF EXISTS "Users can view own package downloads" ON package_downloads;
DROP POLICY IF EXISTS "Users can create package downloads" ON package_downloads;

-- 删除 photo_groups 表策略
DROP POLICY IF EXISTS "Users can view own album groups" ON photo_groups;
DROP POLICY IF EXISTS "Users can create groups" ON photo_groups;
DROP POLICY IF EXISTS "Users can update own album groups" ON photo_groups;
DROP POLICY IF EXISTS "Users can delete own album groups" ON photo_groups;

-- 删除 photo_group_assignments 表策略
DROP POLICY IF EXISTS "Users can view own group assignments" ON photo_group_assignments;
DROP POLICY IF EXISTS "Users can create group assignments" ON photo_group_assignments;
DROP POLICY IF EXISTS "Users can delete group assignments" ON photo_group_assignments;

-- 删除 package_downloads 表策略（补充）
DROP POLICY IF EXISTS "Users can update package downloads" ON package_downloads;

-- ============================================
-- 删除所有表（按依赖顺序，CASCADE 会自动删除关联的触发器和约束）
-- ============================================
-- 注意：使用 CASCADE 会自动删除表上的所有触发器和策略，但上面已显式删除策略

-- 删除关联表（先删除）
DROP TABLE IF EXISTS photo_group_assignments CASCADE;
DROP TABLE IF EXISTS photo_groups CASCADE;
DROP TABLE IF EXISTS package_downloads CASCADE;
DROP TABLE IF EXISTS album_templates CASCADE;

-- 删除主表
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 删除所有函数
-- ============================================
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS increment_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS decrement_photo_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_album_view_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_album_selected_count() CASCADE;

-- ============================================
-- 重新启用外键约束检查
-- ============================================
SET session_replication_role = 'origin';

-- ============================================
-- 重新初始化数据库架构
-- ============================================
-- 执行 init-supabase-db.sql 来重新创建表结构
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ 数据库重置完成！';
    RAISE NOTICE '   所有表、函数和触发器已删除';
    RAISE NOTICE '   请执行 docker/init-supabase-db.sql 重新创建表结构';
END $$;
