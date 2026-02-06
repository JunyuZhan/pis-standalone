-- Migration: 012_add_collaborators.sql
-- Description: 添加相册协作者表，支持多摄影师协作
-- Date: 2026-02-06

-- ============================================
-- 相册协作者表
-- ============================================
CREATE TABLE IF NOT EXISTS album_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 协作角色
    role VARCHAR(50) NOT NULL DEFAULT 'editor',  -- owner, editor, viewer
    -- 权限控制
    can_upload BOOLEAN DEFAULT true,             -- 可以上传照片
    can_edit BOOLEAN DEFAULT true,               -- 可以编辑照片
    can_delete BOOLEAN DEFAULT false,            -- 可以删除照片
    can_manage BOOLEAN DEFAULT false,            -- 可以管理相册设置
    can_invite BOOLEAN DEFAULT false,            -- 可以邀请其他协作者
    -- 邀请信息
    invited_by UUID REFERENCES users(id),        -- 邀请人
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,        -- 接受邀请时间
    -- 状态
    status VARCHAR(20) DEFAULT 'pending',        -- pending, accepted, rejected, removed
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- 唯一约束
    UNIQUE(album_id, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_album_collaborators_album ON album_collaborators(album_id);
CREATE INDEX IF NOT EXISTS idx_album_collaborators_user ON album_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_album_collaborators_status ON album_collaborators(status);
CREATE INDEX IF NOT EXISTS idx_album_collaborators_role ON album_collaborators(role);

COMMENT ON TABLE album_collaborators IS '相册协作者表，支持多用户协作管理相册';
COMMENT ON COLUMN album_collaborators.role IS '协作角色：owner-所有者, editor-编辑者, viewer-查看者';
COMMENT ON COLUMN album_collaborators.status IS '状态：pending-待接受, accepted-已接受, rejected-已拒绝, removed-已移除';

-- ============================================
-- 协作邀请表
-- ============================================
CREATE TABLE IF NOT EXISTS collaboration_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    -- 邀请方式：通过邮箱或链接
    invite_type VARCHAR(20) NOT NULL DEFAULT 'email',  -- email, link
    -- 邮箱邀请
    email VARCHAR(255),                          -- 被邀请人邮箱
    -- 链接邀请
    invite_code VARCHAR(32) UNIQUE,              -- 邀请码
    -- 邀请设置
    role VARCHAR(50) DEFAULT 'editor',           -- 被邀请人角色
    can_upload BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT true,
    can_delete BOOLEAN DEFAULT false,
    can_manage BOOLEAN DEFAULT false,
    can_invite BOOLEAN DEFAULT false,
    -- 邀请人
    invited_by UUID NOT NULL REFERENCES users(id),
    -- 状态
    status VARCHAR(20) DEFAULT 'pending',        -- pending, accepted, expired, cancelled
    expires_at TIMESTAMP WITH TIME ZONE,         -- 过期时间
    used_at TIMESTAMP WITH TIME ZONE,            -- 使用时间
    used_by UUID REFERENCES users(id),           -- 使用者
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_collaboration_invites_album ON collaboration_invites(album_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_invites_email ON collaboration_invites(email);
CREATE INDEX IF NOT EXISTS idx_collaboration_invites_code ON collaboration_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_collaboration_invites_status ON collaboration_invites(status);

COMMENT ON TABLE collaboration_invites IS '协作邀请表';

-- ============================================
-- 为相册添加所有者字段（如果不存在）
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'albums' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE albums ADD COLUMN owner_id UUID REFERENCES users(id);
        
        -- 设置现有相册的所有者为创建者（如果有 created_by 字段）
        -- 或者设置为第一个管理员
        UPDATE albums SET owner_id = (
            SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1
        ) WHERE owner_id IS NULL;
        
        COMMENT ON COLUMN albums.owner_id IS '相册所有者';
    END IF;
END $$;

SELECT 'Collaborators tables created successfully' as status;
