-- ============================================
-- 数据统计表迁移脚本
-- ============================================
-- 此脚本用于已部署的系统添加数据统计功能
-- 新部署会通过 init-postgresql-db.sql 自动创建这些表
-- ============================================

-- ============================================
-- 相册访问记录表
-- ============================================
CREATE TABLE IF NOT EXISTS album_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    viewer_ip VARCHAR(45),                       -- IPv4/IPv6 地址
    viewer_ua TEXT,                              -- User-Agent
    viewer_referer TEXT,                         -- 来源页面
    viewer_country VARCHAR(100),                 -- 国家/地区（可选，通过 IP 解析）
    viewer_city VARCHAR(100),                    -- 城市（可选）
    device_type VARCHAR(20),                     -- 设备类型: desktop, mobile, tablet
    browser VARCHAR(50),                         -- 浏览器
    os VARCHAR(50),                              -- 操作系统
    session_id VARCHAR(100),                     -- 会话标识（用于去重）
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_album_views_album_id ON album_views(album_id);
CREATE INDEX IF NOT EXISTS idx_album_views_viewed_at ON album_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_album_views_session ON album_views(album_id, session_id);

-- ============================================
-- 照片查看记录表
-- ============================================
CREATE TABLE IF NOT EXISTS photo_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    viewer_ip VARCHAR(45),
    session_id VARCHAR(100),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_photo_views_photo_id ON photo_views(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_views_album_id ON photo_views(album_id);
CREATE INDEX IF NOT EXISTS idx_photo_views_viewed_at ON photo_views(viewed_at);

-- ============================================
-- 下载记录表
-- ============================================
CREATE TABLE IF NOT EXISTS download_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    download_type VARCHAR(20) NOT NULL,          -- single, batch, all
    file_count INTEGER DEFAULT 1,                -- 下载文件数量
    total_size BIGINT,                           -- 总大小（字节）
    downloader_ip VARCHAR(45),
    session_id VARCHAR(100),
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_download_logs_photo_id ON download_logs(photo_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_album_id ON download_logs(album_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_at ON download_logs(downloaded_at);

-- ============================================
-- 每日统计汇总表（用于快速查询）
-- ============================================
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL,
    album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 0,                -- 当日访问量
    unique_visitors INTEGER DEFAULT 0,           -- 独立访客数
    photo_view_count INTEGER DEFAULT 0,          -- 照片查看数
    download_count INTEGER DEFAULT 0,            -- 下载次数
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stat_date, album_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_album ON daily_stats(album_id);

-- ============================================
-- 更新触发器
-- ============================================
DROP TRIGGER IF EXISTS update_daily_stats_updated_at ON daily_stats;
CREATE TRIGGER update_daily_stats_updated_at
    BEFORE UPDATE ON daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 数据清理：自动清理 90 天前的详细记录
-- 保留汇总数据，清理详细访问记录以节省存储空间
-- ============================================
-- 注意：此清理需要通过定时任务执行，这里只是示例

-- 示例清理语句（可通过 cron job 定期执行）：
-- DELETE FROM album_views WHERE viewed_at < NOW() - INTERVAL '90 days';
-- DELETE FROM photo_views WHERE viewed_at < NOW() - INTERVAL '90 days';
-- DELETE FROM download_logs WHERE downloaded_at < NOW() - INTERVAL '90 days';
