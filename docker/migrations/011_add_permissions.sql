-- Migration: 011_add_permissions.sql
-- Description: 添加权限管理表
-- Date: 2026-02-06

-- ============================================
-- 权限定义表
-- ============================================
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,           -- 权限代码，如 album:create
    name VARCHAR(200) NOT NULL,                  -- 权限名称
    description TEXT,                            -- 权限描述
    category VARCHAR(50) NOT NULL,               -- 权限分类：album, photo, customer, system 等
    is_system BOOLEAN DEFAULT false,             -- 是否为系统内置权限
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

COMMENT ON TABLE permissions IS '权限定义表';

-- ============================================
-- 角色权限关联表
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,                   -- 角色：admin, photographer, retoucher, viewer
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),        -- 授权人
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS '角色权限关联表';

-- ============================================
-- 用户特殊权限表（覆盖角色权限）
-- ============================================
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true,                -- true=授予, false=撤销（覆盖角色权限）
    granted_by UUID REFERENCES users(id),        -- 授权人
    expires_at TIMESTAMP WITH TIME ZONE,         -- 过期时间（可选）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);

COMMENT ON TABLE user_permissions IS '用户特殊权限表，用于覆盖角色默认权限';

-- ============================================
-- 插入系统内置权限
-- ============================================
INSERT INTO permissions (code, name, description, category, is_system) VALUES
    -- 相册权限
    ('album:view', '查看相册', '查看相册列表和详情', 'album', true),
    ('album:create', '创建相册', '创建新相册', 'album', true),
    ('album:edit', '编辑相册', '编辑相册信息和设置', 'album', true),
    ('album:delete', '删除相册', '删除相册（软删除）', 'album', true),
    ('album:publish', '发布相册', '公开或取消公开相册', 'album', true),
    ('album:share', '分享相册', '生成分享链接和海报', 'album', true),
    
    -- 照片权限
    ('photo:view', '查看照片', '查看照片列表和详情', 'photo', true),
    ('photo:upload', '上传照片', '上传新照片', 'photo', true),
    ('photo:edit', '编辑照片', '编辑照片信息', 'photo', true),
    ('photo:delete', '删除照片', '删除照片', 'photo', true),
    ('photo:download', '下载照片', '下载原图或处理后的照片', 'photo', true),
    ('photo:retouch', '修图', 'AI 修图功能', 'photo', true),
    
    -- 客户权限
    ('customer:view', '查看客户', '查看客户列表和详情', 'customer', true),
    ('customer:create', '创建客户', '创建新客户', 'customer', true),
    ('customer:edit', '编辑客户', '编辑客户信息', 'customer', true),
    ('customer:delete', '删除客户', '删除客户', 'customer', true),
    ('customer:notify', '发送通知', '向客户发送通知', 'customer', true),
    
    -- 统计权限
    ('analytics:view', '查看统计', '查看数据统计', 'analytics', true),
    ('analytics:export', '导出统计', '导出统计报表', 'analytics', true),
    
    -- 系统权限
    ('system:settings', '系统设置', '修改系统设置', 'system', true),
    ('system:upgrade', '系统升级', '执行系统升级', 'system', true),
    ('system:users', '用户管理', '管理系统用户', 'system', true),
    ('system:permissions', '权限管理', '管理用户权限', 'system', true),
    ('system:audit', '审计日志', '查看操作日志', 'system', true),
    ('system:backup', '数据备份', '执行数据备份', 'system', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 为现有角色分配默认权限
-- ============================================

-- 管理员拥有所有权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- 摄影师权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'photographer', id FROM permissions 
WHERE code IN (
    'album:view', 'album:create', 'album:edit', 'album:publish', 'album:share',
    'photo:view', 'photo:upload', 'photo:edit', 'photo:delete', 'photo:download',
    'customer:view', 'customer:create', 'customer:edit', 'customer:notify',
    'analytics:view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 修图师权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'retoucher', id FROM permissions 
WHERE code IN (
    'album:view',
    'photo:view', 'photo:edit', 'photo:retouch', 'photo:download'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 查看者权限（只读）
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions 
WHERE code IN (
    'album:view',
    'photo:view',
    'analytics:view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

SELECT 'Permissions tables created and default permissions assigned' as status;
