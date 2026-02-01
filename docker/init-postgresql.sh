#!/bin/bash
# ============================================
# PIS PostgreSQL 数据库初始化脚本（创建管理员账户）
# ============================================
# 此脚本在数据库初始化后创建默认管理员账户
# PostgreSQL 容器会在首次启动时自动执行此脚本
# 执行顺序：init-postgresql-db.sql -> init-postgresql.sh
# ============================================

set -e

# 读取环境变量
DOMAIN="${DOMAIN:-localhost}"
POSTGRES_DB="${POSTGRES_DB:-pis}"
POSTGRES_USER="${POSTGRES_USER:-pis}"

# 确定管理员邮箱
if [ "$DOMAIN" = "localhost" ]; then
    ADMIN_EMAIL="admin@example.com"
else
    ADMIN_EMAIL="admin@${DOMAIN}"
fi

# SQL 注入防护：转义单引号
ADMIN_EMAIL_ESC=$(echo "$ADMIN_EMAIL" | sed "s/'/''/g")

echo ""
echo "=========================================="
echo "创建默认管理员账户"
echo "=========================================="
echo "管理员邮箱: ${ADMIN_EMAIL}"
echo "=========================================="

# 创建默认管理员账户（如果不存在）
# 注意：ADMIN_EMAIL_ESC 已经转义了单引号，防止 SQL 注入
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$POSTGRES_DB" <<EOF
-- 创建默认管理员账户（如果不存在）
INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
VALUES (
    LOWER('${ADMIN_EMAIL_ESC}'),
    NULL,  -- 首次登录需要设置密码
    'admin',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- 显示创建结果
DO \$\$
DECLARE
    user_count INTEGER;
    admin_email_val TEXT := '${ADMIN_EMAIL_ESC}';
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE email = LOWER(admin_email_val);
    IF user_count > 0 THEN
        RAISE NOTICE '✅ 默认管理员账户已就绪: %', admin_email_val;
        RAISE NOTICE '   - 首次登录时需要设置密码';
    END IF;
END \$\$;
EOF

echo ""
echo "✅ 管理员账户初始化完成！"
