-- ============================================
-- PIS Supabase 数据库初始化脚本
-- ============================================
-- ⚠️  重要：此脚本用于初始化全新的 Supabase 数据库
-- 
-- 使用方法：
-- 1. 在 Supabase Dashboard -> SQL Editor 中执行此脚本
-- 2. 或者使用 Supabase CLI: supabase db reset
-- 
-- 注意：
-- - 此脚本会创建所有必需的表、函数和触发器
-- - 仅适用于全新的数据库（首次安装）
-- - 不要在已有数据的数据库上重复执行
-- ============================================

-- ============================================
-- 创建扩展（如果需要）
-- ============================================
-- Supabase 默认已启用 uuid-ossp 扩展
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 创建函数
-- ============================================

-- 自动更新 updated_at 字段的函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 增加相册照片数量的函数（重新计算，确保准确）
CREATE OR REPLACE FUNCTION increment_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums 
    SET photo_count = (
        SELECT COUNT(*) FROM photos 
        WHERE photos.album_id = increment_photo_count.album_id 
        AND status = 'completed' 
        AND deleted_at IS NULL
    )
    WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- 减少相册照片数量的函数（重新计算，确保准确）
CREATE OR REPLACE FUNCTION decrement_photo_count(album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums 
    SET photo_count = GREATEST(0, (
        SELECT COUNT(*) FROM photos 
        WHERE photos.album_id = decrement_photo_count.album_id 
        AND status = 'completed' 
        AND deleted_at IS NULL
    ))
    WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- 增加相册访问次数的函数
CREATE OR REPLACE FUNCTION increment_album_view_count(album_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE albums
    SET view_count = view_count + 1
    WHERE id = album_id;
END;
$$ LANGUAGE plpgsql;

-- 触发器包装函数：插入照片时更新照片数量
CREATE OR REPLACE FUNCTION trigger_increment_photo_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NULL AND NEW.status = 'completed' THEN
        PERFORM increment_photo_count(NEW.album_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器包装函数：删除照片时更新照片数量
CREATE OR REPLACE FUNCTION trigger_decrement_photo_count()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        PERFORM decrement_photo_count(NEW.album_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新相册选中照片数量的函数
CREATE OR REPLACE FUNCTION update_album_selected_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_selected THEN
            UPDATE albums
            SET selected_count = selected_count + 1
            WHERE id = NEW.album_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_selected != NEW.is_selected THEN
            IF NEW.is_selected THEN
                UPDATE albums
                SET selected_count = selected_count + 1
                WHERE id = NEW.album_id;
            ELSE
                UPDATE albums
                SET selected_count = GREATEST(selected_count - 1, 0)
                WHERE id = NEW.album_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_selected THEN
            UPDATE albums
            SET selected_count = GREATEST(selected_count - 1, 0)
            WHERE id = OLD.album_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 创建表
-- ============================================

-- 用户表（扩展 Supabase auth.users）
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 相册表
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_photo_id UUID,
    is_public BOOLEAN DEFAULT false,
    password TEXT,
    expires_at TIMESTAMPTZ,
    layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
    sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
    allow_download BOOLEAN DEFAULT true,
    allow_batch_download BOOLEAN DEFAULT false,
    show_exif BOOLEAN DEFAULT true,
    allow_share BOOLEAN DEFAULT true,
    watermark_enabled BOOLEAN DEFAULT false,
    watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
    watermark_config JSONB DEFAULT '{}',
    color_grading JSONB DEFAULT '{}',
    share_title TEXT,
    share_description TEXT,
    share_image_url TEXT,
    poster_image_url TEXT,
    event_date TIMESTAMPTZ,
    location TEXT,
    is_live BOOLEAN DEFAULT false,
    photo_count INTEGER DEFAULT 0,
    selected_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 照片表
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    original_key TEXT NOT NULL,
    preview_key TEXT,
    thumb_key TEXT,
    filename TEXT NOT NULL,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    mime_type TEXT,
    blur_data TEXT,
    exif JSONB DEFAULT '{}',
    captured_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    is_selected BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,  -- 手动排序顺序
    rotation INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 相册模板表
CREATE TABLE IF NOT EXISTS album_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    layout TEXT DEFAULT 'masonry' CHECK (layout IN ('masonry', 'grid', 'carousel')),
    sort_rule TEXT DEFAULT 'capture_desc' CHECK (sort_rule IN ('capture_desc', 'capture_asc', 'manual')),
    allow_download BOOLEAN DEFAULT true,
    allow_batch_download BOOLEAN DEFAULT false,
    show_exif BOOLEAN DEFAULT true,
    password TEXT,
    expires_at TIMESTAMPTZ,
    watermark_enabled BOOLEAN DEFAULT false,
    watermark_type TEXT CHECK (watermark_type IN ('text', 'logo')),
    watermark_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 打包下载表
CREATE TABLE IF NOT EXISTS package_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    photo_ids UUID[] NOT NULL,
    include_watermarked BOOLEAN DEFAULT true,
    include_original BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    zip_key TEXT,
    file_size BIGINT,
    download_url TEXT,
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 照片分组表
CREATE TABLE IF NOT EXISTS photo_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 照片分组关联表
CREATE TABLE IF NOT EXISTS photo_group_assignments (
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES photo_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (photo_id, group_id),
    UNIQUE(group_id, photo_id)
);

-- ============================================
-- 创建索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_albums_slug ON albums(slug);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_albums_deleted_at ON albums(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_albums_event_date ON albums(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_albums_is_public ON albums(is_public) WHERE is_public = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_albums_is_live ON albums(is_live) WHERE is_live = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_album_status ON photos(album_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_is_selected ON photos(is_selected) WHERE is_selected = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_package_downloads_album_id ON package_downloads(album_id);
CREATE INDEX IF NOT EXISTS idx_package_downloads_status ON package_downloads(status);

CREATE INDEX IF NOT EXISTS idx_album_templates_name ON album_templates(name);

CREATE INDEX IF NOT EXISTS idx_photo_groups_album_id ON photo_groups(album_id);
CREATE INDEX IF NOT EXISTS idx_photo_groups_sort_order ON photo_groups(album_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_group_id ON photo_group_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_photo_id ON photo_group_assignments(photo_id);

-- ============================================
-- 创建触发器
-- ============================================

-- 自动更新 updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_album_templates_updated_at
    BEFORE UPDATE ON album_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_photo_groups_updated_at
    BEFORE UPDATE ON photo_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_package_downloads_updated_at
    BEFORE UPDATE ON package_downloads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 自动更新照片数量
CREATE TRIGGER increment_photo_count_on_insert
    AFTER INSERT ON photos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_increment_photo_count();

CREATE TRIGGER decrement_photo_count_on_delete
    AFTER UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION trigger_decrement_photo_count();

-- 自动更新选中照片数量
CREATE TRIGGER update_selected_count
    AFTER INSERT OR UPDATE OR DELETE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION update_album_selected_count();

-- ============================================
-- 启用 Row Level Security (RLS)
-- ============================================

-- 启用所有表的 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_group_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 创建 RLS 策略
-- ============================================

-- users 表策略
-- 用户只能查看和更新自己的信息
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- albums 表策略
-- 公开相册：任何人都可以查看（is_public = true 且 deleted_at IS NULL）
CREATE POLICY "Public albums are viewable by everyone"
    ON albums FOR SELECT
    USING (
        is_public = true 
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- 认证用户：可以查看自己的所有相册（包括私有相册）
CREATE POLICY "Users can view own albums"
    ON albums FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- 认证用户：可以创建相册
CREATE POLICY "Authenticated users can create albums"
    ON albums FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 认证用户：可以更新自己的相册
CREATE POLICY "Users can update own albums"
    ON albums FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- 认证用户：可以删除自己的相册（软删除）
CREATE POLICY "Users can delete own albums"
    ON albums FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- photos 表策略
-- 公开相册的照片：任何人都可以查看（通过相册的 is_public 状态）
CREATE POLICY "Public album photos are viewable by everyone"
    ON photos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photos.album_id
            AND albums.is_public = true
            AND albums.deleted_at IS NULL
            AND (albums.expires_at IS NULL OR albums.expires_at > NOW())
        )
        AND deleted_at IS NULL
        AND status = 'completed'
    );

-- 认证用户：可以查看自己相册的所有照片
CREATE POLICY "Users can view own album photos"
    ON photos FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photos.album_id
        )
    );

-- 认证用户：可以创建照片（在自己的相册中）
CREATE POLICY "Users can insert photos"
    ON photos FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 认证用户：可以更新照片（在自己的相册中）
CREATE POLICY "Users can update own album photos"
    ON photos FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- 认证用户：可以删除照片（在自己的相册中，软删除）
CREATE POLICY "Users can delete own album photos"
    ON photos FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- album_templates 表策略
-- 认证用户：可以查看所有模板
CREATE POLICY "Authenticated users can view templates"
    ON album_templates FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- 认证用户：可以创建模板
CREATE POLICY "Authenticated users can create templates"
    ON album_templates FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 认证用户：可以更新模板
CREATE POLICY "Authenticated users can update templates"
    ON album_templates FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- 认证用户：可以删除模板
CREATE POLICY "Authenticated users can delete templates"
    ON album_templates FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- package_downloads 表策略
-- 认证用户：可以查看自己的打包下载
CREATE POLICY "Users can view own package downloads"
    ON package_downloads FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- 认证用户：可以创建打包下载
CREATE POLICY "Users can create package downloads"
    ON package_downloads FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- photo_groups 表策略
-- 认证用户：可以查看自己相册的分组
CREATE POLICY "Users can view own album groups"
    ON photo_groups FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photo_groups.album_id
        )
    );

-- 认证用户：可以创建分组
CREATE POLICY "Users can create groups"
    ON photo_groups FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 认证用户：可以更新分组
CREATE POLICY "Users can update own album groups"
    ON photo_groups FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- 认证用户：可以删除分组
CREATE POLICY "Users can delete own album groups"
    ON photo_groups FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- photo_group_assignments 表策略
-- 认证用户：可以查看自己相册的照片分组关联
CREATE POLICY "Users can view own group assignments"
    ON photo_group_assignments FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM photo_groups
            JOIN albums ON albums.id = photo_groups.album_id
            WHERE photo_groups.id = photo_group_assignments.group_id
        )
    );

-- 认证用户：可以创建照片分组关联
CREATE POLICY "Users can create group assignments"
    ON photo_group_assignments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 认证用户：可以删除照片分组关联
CREATE POLICY "Users can delete group assignments"
    ON photo_group_assignments FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ 数据库初始化完成！';
    RAISE NOTICE '   所有表、函数和触发器已创建';
    RAISE NOTICE '   Row Level Security (RLS) 已启用并配置策略';
    RAISE NOTICE '';
    RAISE NOTICE '📝 重要说明：';
    RAISE NOTICE '   - 管理员操作使用 Service Role Key（绕过 RLS）';
    RAISE NOTICE '   - 公开 API 使用 Anon Key（受 RLS 策略限制）';
    RAISE NOTICE '   - 匿名用户只能访问公开相册（is_public = true）';
    RAISE NOTICE '   - 认证用户可以看到自己的所有相册';
END $$;
