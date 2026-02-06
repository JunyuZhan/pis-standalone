-- ============================================
-- PIS 数据库初始化脚本（PostgreSQL）
-- ============================================
-- 此脚本在 PostgreSQL 容器首次启动时自动执行
-- 创建完整的数据库架构，无需手动执行迁移
-- ============================================

-- 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 用于全文搜索

-- 创建 vector 扩展（可选，用于人脸识别功能）
-- 如果扩展不可用（如开发环境使用 postgres:16-alpine），会跳过但不影响其他功能
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'vector 扩展不可用，跳过创建（不影响其他功能）';
END $$;

-- ============================================
-- 用户表（自定义认证模式使用）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(500),  -- 允许 NULL，表示首次登录需要设置密码
    role VARCHAR(50) DEFAULT 'admin',  -- 用户角色: 'admin' (管理员), 'photographer' (摄影师), 'retoucher' (修图师), 'guest' (访客)
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE  -- 软删除时间戳
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

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
-- 人脸特征表
-- ============================================
CREATE TABLE IF NOT EXISTS face_embeddings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    embedding vector(512), -- InsightFace usually generates 512d vectors
    face_location JSONB,   -- {x, y, w, h}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 向量搜索函数
CREATE OR REPLACE FUNCTION search_faces(
  query_embedding vector(512),
  match_threshold float,
  match_count int,
  filter_album_id uuid
)
RETURNS TABLE (
  photo_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    face_embeddings.photo_id,
    1 - (face_embeddings.embedding <=> query_embedding) as similarity
  FROM face_embeddings
  WHERE 1 - (face_embeddings.embedding <=> query_embedding) > match_threshold
  AND album_id = filter_album_id
  ORDER BY face_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

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
-- 创建默认用户账户（各角色）
-- ============================================
-- 用户账户在初始化时创建，但 password_hash 为 NULL
-- 部署完成后，首次登录时会提示设置密码
-- 这是安全的最佳实践：避免在初始化时设置默认密码
-- 
-- 注意：如需自定义邮箱或批量创建，请使用 pnpm init-users 脚本

-- 管理员账户
INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    'admin@pis.com',
    NULL,  -- 密码未设置，首次登录时需要设置
    'admin',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- 摄影师账户
INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    'photographer@pis.com',
    NULL,  -- 密码未设置，首次登录时需要设置
    'photographer',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- 修图师账户
INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    'retoucher@pis.com',
    NULL,  -- 密码未设置，首次登录时需要设置
    'retoucher',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- 访客账户
INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    'guest@pis.com',
    NULL,  -- 密码未设置，首次登录时需要设置
    'guest',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 系统设置表（用于后台可视化配置）
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,        -- 设置键名
    value JSONB NOT NULL DEFAULT '{}',       -- 设置值（支持复杂数据结构）
    category VARCHAR(50) NOT NULL,           -- 分类: brand, site, feature, social, seo
    description TEXT,                        -- 设置说明
    is_public BOOLEAN DEFAULT false,         -- 是否公开（前台可访问）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON system_settings(is_public) WHERE is_public = true;

-- 为 system_settings 表创建触发器
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 初始化默认系统设置
-- 品牌设置
INSERT INTO system_settings (key, value, category, description, is_public) VALUES
('brand_name', '"PIS Photography"', 'brand', '品牌/工作室名称', true),
('brand_tagline', '"专业活动摄影"', 'brand', '品牌标语', true),
('brand_logo', 'null', 'brand', 'Logo 图片 URL', true),
('brand_favicon', 'null', 'brand', 'Favicon URL', true)
ON CONFLICT (key) DO NOTHING;

-- 版权与备案
INSERT INTO system_settings (key, value, category, description, is_public) VALUES
('copyright_text', '""', 'brand', '版权声明文字（留空则使用品牌名称）', true),
('icp_number', '""', 'brand', 'ICP 备案号', true),
('police_number', '""', 'brand', '公安备案号', true)
ON CONFLICT (key) DO NOTHING;

-- 站点设置
INSERT INTO system_settings (key, value, category, description, is_public) VALUES
('site_title', '"PIS - 即时影像分享"', 'site', '站点标题', true),
('site_description', '"专业级私有化即时摄影分享系统"', 'site', '站点描述', true),
('site_keywords', '"摄影,相册,分享,活动摄影"', 'site', 'SEO 关键词', true)
ON CONFLICT (key) DO NOTHING;

-- 功能开关
INSERT INTO system_settings (key, value, category, description, is_public) VALUES
('allow_public_home', 'true', 'feature', '是否允许游客访问首页', false),
('default_watermark_enabled', 'false', 'feature', '新相册默认启用水印', false),
('default_allow_download', 'true', 'feature', '新相册默认允许下载', false),
('default_show_exif', 'true', 'feature', '新相册默认显示 EXIF', false),
('polling_interval', '3000', 'feature', '实时更新轮询间隔（毫秒）', false)
ON CONFLICT (key) DO NOTHING;

-- 社交链接
INSERT INTO system_settings (key, value, category, description, is_public) VALUES
('social_wechat_qrcode', 'null', 'social', '微信二维码图片 URL', true),
('social_weibo', '""', 'social', '微博链接', true),
('social_instagram', '""', 'social', 'Instagram 链接', true),
('social_email', '""', 'social', '联系邮箱', true),
('social_phone', '""', 'social', '联系电话', true)
ON CONFLICT (key) DO NOTHING;

-- 主题设置
INSERT INTO system_settings (key, value, category, description, is_public) VALUES
('theme_mode', '"system"', 'theme', '主题模式: light, dark, system', true),
('theme_primary_color', '"#4F46E5"', 'theme', '主色调', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 数据统计表
-- ============================================

-- 相册访问记录表
CREATE TABLE IF NOT EXISTS album_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    viewer_ip VARCHAR(45),                       -- IPv4/IPv6 地址
    viewer_ua TEXT,                              -- User-Agent
    viewer_referer TEXT,                         -- 来源页面
    viewer_country VARCHAR(100),                 -- 国家/地区
    viewer_city VARCHAR(100),                    -- 城市
    device_type VARCHAR(20),                     -- 设备类型: desktop, mobile, tablet
    browser VARCHAR(50),                         -- 浏览器
    os VARCHAR(50),                              -- 操作系统
    session_id VARCHAR(100),                     -- 会话标识
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_album_views_album_id ON album_views(album_id);
CREATE INDEX IF NOT EXISTS idx_album_views_viewed_at ON album_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_album_views_session ON album_views(album_id, session_id);

-- 照片查看记录表
CREATE TABLE IF NOT EXISTS photo_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    viewer_ip VARCHAR(45),
    session_id VARCHAR(100),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_views_photo_id ON photo_views(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_views_album_id ON photo_views(album_id);
CREATE INDEX IF NOT EXISTS idx_photo_views_viewed_at ON photo_views(viewed_at);

-- 下载记录表
CREATE TABLE IF NOT EXISTS download_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    download_type VARCHAR(20) NOT NULL,          -- single, batch, all
    file_count INTEGER DEFAULT 1,
    total_size BIGINT,
    downloader_ip VARCHAR(45),
    session_id VARCHAR(100),
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_logs_photo_id ON download_logs(photo_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_album_id ON download_logs(album_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_at ON download_logs(downloaded_at);

-- 每日统计汇总表
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL,
    album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    photo_view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stat_date, album_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_album ON daily_stats(album_id);

DROP TRIGGER IF EXISTS update_daily_stats_updated_at ON daily_stats;
CREATE TRIGGER update_daily_stats_updated_at
    BEFORE UPDATE ON daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 初始化完成提示
-- ============================================
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin' AND is_active = true;
    
    RAISE NOTICE '✅ PIS 数据库初始化完成！';
    RAISE NOTICE '   - users 表: 存储管理员账号（自定义认证模式）';
    RAISE NOTICE '   - albums 表: 存储相册信息';
    RAISE NOTICE '   - photos 表: 存储照片信息';
    RAISE NOTICE '   - album_templates 表: 存储相册模板';
    RAISE NOTICE '   - package_downloads 表: 存储打包下载任务';
    RAISE NOTICE '   - photo_groups 表: 存储照片分组';
    RAISE NOTICE '   - photo_group_assignments 表: 存储照片分组关联';
    RAISE NOTICE '   - system_settings 表: 存储系统设置';
    RAISE NOTICE '';
    RAISE NOTICE '👤 默认用户账户:';
    RAISE NOTICE '   - 管理员: admin@pis.com';
    RAISE NOTICE '   - 摄影师: photographer@pis.com';
    RAISE NOTICE '   - 修图师: retoucher@pis.com';
    RAISE NOTICE '   - 访客: guest@pis.com';
    RAISE NOTICE '   - 密码: 未设置（首次登录时需要设置）';
    RAISE NOTICE '   - 活跃管理员数量: %', admin_count;
    RAISE NOTICE '';
    RAISE NOTICE '💡 提示: 可以使用 pnpm init-users 脚本批量创建或自定义用户账户';
END $$;
