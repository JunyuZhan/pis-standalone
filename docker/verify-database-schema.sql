-- ============================================
-- 数据库 Schema 验证脚本
-- ============================================
-- 此脚本用于验证数据库 schema 是否与代码中的类型定义完全匹配
-- ============================================

-- 检查所有必需的表是否存在
DO $$
DECLARE
    required_tables TEXT[] := ARRAY[
        'users',
        'albums',
        'photos',
        'album_templates',
        'package_downloads',
        'photo_groups',
        'photo_group_assignments'
    ];
    missing_tables TEXT[] := '{}';
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = tbl
        ) THEN
            missing_tables := array_append(missing_tables, tbl);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION '缺少以下表: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✅ 所有必需的表都存在';
    END IF;
END $$;

-- 检查 albums 表的必需字段
DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'id', 'slug', 'title', 'description', 'cover_photo_id', 'is_public',
        'password', 'expires_at', 'layout', 'sort_rule', 'allow_download',
        'allow_batch_download', 'show_exif', 'allow_share', 'watermark_enabled',
        'watermark_type', 'watermark_config', 'color_grading', 'share_title',
        'share_description', 'share_image_url', 'poster_image_url', 'event_date',
        'location', 'is_live', 'photo_count', 'selected_count', 'view_count',
        'created_at', 'updated_at', 'deleted_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'albums' 
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'albums 表缺少以下字段: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ albums 表所有必需字段都存在';
    END IF;
END $$;

-- 检查 photos 表的必需字段
DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'id', 'album_id', 'original_key', 'preview_key', 'thumb_key', 'filename',
        'file_size', 'width', 'height', 'mime_type', 'blur_data', 'exif',
        'captured_at', 'status', 'is_selected', 'sort_order', 'rotation',
        'created_at', 'updated_at', 'deleted_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'photos' 
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'photos 表缺少以下字段: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ photos 表所有必需字段都存在';
    END IF;
END $$;

-- 检查 package_downloads 表的必需字段
DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'id', 'album_id', 'photo_ids', 'include_watermarked', 'include_original',
        'status', 'zip_key', 'file_size', 'download_url', 'expires_at',
        'created_at', 'updated_at', 'completed_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'package_downloads' 
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'package_downloads 表缺少以下字段: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ package_downloads 表所有必需字段都存在';
    END IF;
END $$;

-- 检查 album_templates 表的必需字段
DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'id', 'name', 'description', 'is_public', 'layout', 'sort_rule',
        'allow_download', 'allow_batch_download', 'show_exif', 'password',
        'expires_at', 'watermark_enabled', 'watermark_type', 'watermark_config',
        'created_at', 'updated_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'album_templates' 
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'album_templates 表缺少以下字段: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ album_templates 表所有必需字段都存在';
    END IF;
END $$;

-- 检查 photo_groups 表的必需字段
DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'id', 'album_id', 'name', 'description', 'sort_order',
        'created_at', 'updated_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'photo_groups' 
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'photo_groups 表缺少以下字段: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ photo_groups 表所有必需字段都存在';
    END IF;
END $$;

-- 检查 photo_group_assignments 表的必需字段
DO $$
DECLARE
    required_columns TEXT[] := ARRAY[
        'photo_id', 'group_id', 'created_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'photo_group_assignments' 
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'photo_group_assignments 表缺少以下字段: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ photo_group_assignments 表所有必需字段都存在';
    END IF;
END $$;

-- 检查关键索引是否存在
DO $$
DECLARE
    required_indexes TEXT[] := ARRAY[
        'idx_albums_slug',
        'idx_photos_album_id',
        'idx_photos_status',
        'idx_package_downloads_album_id',
        'idx_photo_groups_album_id',
        'idx_photo_group_assignments_group_id',
        'idx_photo_group_assignments_photo_id'
    ];
    missing_indexes TEXT[] := '{}';
    idx TEXT;
BEGIN
    FOREACH idx IN ARRAY required_indexes
    LOOP
        IF NOT EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = idx
        ) THEN
            missing_indexes := array_append(missing_indexes, idx);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE WARNING '缺少以下索引: %', array_to_string(missing_indexes, ', ');
    ELSE
        RAISE NOTICE '✅ 所有关键索引都存在';
    END IF;
END $$;

-- 检查触发器函数是否存在
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_proc 
        WHERE proname = 'update_updated_at_column'
    ) THEN
        RAISE EXCEPTION '缺少触发器函数: update_updated_at_column';
    ELSE
        RAISE NOTICE '✅ 触发器函数存在';
    END IF;
END $$;

RAISE NOTICE '========================================';
RAISE NOTICE '✅ 数据库 Schema 验证完成！';
RAISE NOTICE '========================================';
