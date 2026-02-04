-- ============================================
-- PIS 数据库初始化脚本（PostgreSQL）
-- ============================================
-- 此脚本在 PostgreSQL 容器首次启动时自动执行
-- 创建完整的数据库架构，无需手动执行迁移
-- ============================================

-- 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 用于全文搜索

-- ============================================
-- 用户表（自定义认证模式使用）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(500),  -- 允许 NULL，表示首次登录需要设置密码
    role VARCHAR(50) DEFAULT 'admin',  -- admin, viewer
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 相册表
-- ============================================
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    cover_photo_id UUID,
    photo_count INTEGER DEFAULT 0,
    password VARCHAR(255),  -- 相册访问密码（可选）
    upload_token VARCHAR(255), -- 上传令牌（用于 FTP/API 上传验证）
    expires_at TIMESTAMP WITH TIME ZONE,  -- 相册过期时间
    is_public BOOLEAN DEFAULT false,
    layout VARCHAR(50) DEFAULT 'masonry',
    sort_rule VARCHAR(50) DEFAULT 'capture_desc',  -- 排序规则（capture_desc, capture_asc, manual）
    allow_download BOOLEAN DEFAULT true,
    allow_batch_download BOOLEAN DEFAULT false,
    show_exif BOOLEAN DEFAULT true,
    allow_share BOOLEAN DEFAULT true,
    watermark_enabled BOOLEAN DEFAULT false,
    watermark_type VARCHAR(50) DEFAULT 'text',
    watermark_config JSONB DEFAULT '{}',
    color_grading JSONB DEFAULT '{}',
    enable_human_retouch BOOLEAN DEFAULT false, -- 开启人工修图
    enable_ai_retouch BOOLEAN DEFAULT false,    -- 开启 AI 智能修图
    ai_retouch_config JSONB DEFAULT '{}',       -- AI 修图配置
    -- 分享配置
    share_title VARCHAR(255),
    share_description TEXT,
    share_image_url VARCHAR(500),
    -- 海报配置
    poster_image_url VARCHAR(500),
    -- 活动元数据
    event_date TIMESTAMP WITH TIME ZONE,  -- 活动时间（实际活动日期，区别于相册创建时间）
    location TEXT,  -- 活动地点
    -- 直播模式
    is_live BOOLEAN DEFAULT false,
    -- 统计
    selected_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_albums_slug ON albums(slug);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_albums_deleted_at ON albums(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 照片表
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_key VARCHAR(500) NOT NULL,  -- MinIO 原图路径
    thumb_key VARCHAR(500),              -- 缩略图路径
    preview_key VARCHAR(500),            -- 预览图路径
    width INTEGER,
    height INTEGER,
    file_size BIGINT,
    mime_type VARCHAR(100),
    blur_data TEXT,                       -- BlurHash
    hash VARCHAR(64),                     -- SHA-256 文件哈希
    exif JSONB DEFAULT '{}',
    rotation INTEGER DEFAULT 0,           -- 旋转角度
    sort_order INTEGER DEFAULT 0,         -- 手动排序顺序
    status VARCHAR(50) DEFAULT 'pending', -- pending, pending_retouch, retouching, processing, completed, failed
    retoucher_id UUID,                    -- 负责修图的用户ID
    is_selected BOOLEAN DEFAULT false,    -- 访客是否选中此照片
    captured_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_hash ON photos(hash);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_deleted_at ON photos(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_album_status ON photos(album_id, status) WHERE deleted_at IS NULL;
-- Index for manual sorting (needed for ORDER BY sort_order queries)
CREATE INDEX IF NOT EXISTS idx_photos_album_sort_order ON photos(album_id, sort_order) WHERE deleted_at IS NULL;

-- ============================================
-- 打包下载表
-- ============================================
CREATE TABLE IF NOT EXISTS package_downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    photo_ids UUID[] NOT NULL,
    include_watermarked BOOLEAN DEFAULT true,
    include_original BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    zip_key VARCHAR(500),                 -- MinIO ZIP 文件路径
    file_size BIGINT,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_package_downloads_album_id ON package_downloads(album_id);
CREATE INDEX IF NOT EXISTS idx_package_downloads_status ON package_downloads(status);

-- ============================================
-- 相册模板表
-- ============================================
CREATE TABLE IF NOT EXISTS album_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    layout VARCHAR(50) DEFAULT 'masonry',
    sort_rule VARCHAR(50) DEFAULT 'capture_desc',
    allow_download BOOLEAN DEFAULT true,
    allow_batch_download BOOLEAN DEFAULT false,
    show_exif BOOLEAN DEFAULT true,
    password VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    watermark_enabled BOOLEAN DEFAULT false,
    watermark_type VARCHAR(50),
    watermark_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_album_templates_name ON album_templates(name);

-- ============================================
-- 照片分组表
-- ============================================
CREATE TABLE IF NOT EXISTS photo_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_photo_groups_album_id ON photo_groups(album_id);
CREATE INDEX IF NOT EXISTS idx_photo_groups_sort_order ON photo_groups(album_id, sort_order);

-- ============================================
-- 照片分组关联表
-- ============================================
CREATE TABLE IF NOT EXISTS photo_group_assignments (
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES photo_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (photo_id, group_id),
    UNIQUE(group_id, photo_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_group_id ON photo_group_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_photo_group_assignments_photo_id ON photo_group_assignments(photo_id);

-- ============================================
-- 辅助函数：增量更新相册照片数量
-- ============================================
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

-- ============================================
-- 辅助函数：减量更新相册照片数量
-- ============================================
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

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 albums 表创建触发器
DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
CREATE TRIGGER update_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 photos 表创建触发器
DROP TRIGGER IF EXISTS update_photos_updated_at ON photos;
CREATE TRIGGER update_photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 users 表创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 album_templates 表创建触发器
DROP TRIGGER IF EXISTS update_album_templates_updated_at ON album_templates;
CREATE TRIGGER update_album_templates_updated_at
    BEFORE UPDATE ON album_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 photo_groups 表创建触发器
DROP TRIGGER IF EXISTS update_photo_groups_updated_at ON photo_groups;
CREATE TRIGGER update_photo_groups_updated_at
    BEFORE UPDATE ON photo_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 package_downloads 表创建触发器
DROP TRIGGER IF EXISTS update_package_downloads_updated_at ON package_downloads;
CREATE TRIGGER update_package_downloads_updated_at
    BEFORE UPDATE ON package_downloads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 初始化完成提示
-- ============================================
-- 注意：默认管理员账户由 init-postgresql.sh 脚本创建
DO $$
BEGIN
    RAISE NOTICE '✅ PIS 数据库初始化完成！';
    RAISE NOTICE '   - users 表: 存储管理员账号（自定义认证模式）';
    RAISE NOTICE '   - albums 表: 存储相册信息';
    RAISE NOTICE '   - photos 表: 存储照片信息';
    RAISE NOTICE '   - album_templates 表: 存储相册模板';
    RAISE NOTICE '   - package_downloads 表: 存储打包下载任务';
    RAISE NOTICE '   - photo_groups 表: 存储照片分组';
    RAISE NOTICE '   - photo_group_assignments 表: 存储照片分组关联';
END $$;
