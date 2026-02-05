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
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

echo ""
echo "=========================================="
echo "处理管理员账户密码"
echo "=========================================="

# 如果设置了 ADMIN_PASSWORD 环境变量，使用它来更新密码
# 否则，password_hash 保持为 NULL，首次登录时需要设置密码
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "🔐 检测到 ADMIN_PASSWORD 环境变量，正在设置管理员密码..."
    
    # 使用 Node.js 生成 PBKDF2-SHA512 密码哈希
    # 格式: salt:iterations:hash
    PASSWORD_HASH=$(node -e "
        const crypto = require('crypto');
        const password = process.env.ADMIN_PASSWORD;
        const salt = crypto.randomBytes(32).toString('hex');
        const iterations = 100000;
        const keylen = 64;
        const digest = 'sha512';
        const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
        console.log(\`\${salt}:\${iterations}:\${derivedKey.toString('hex')}\`);
    ")
    
    # 转义单引号（SQL 注入防护）
    # 虽然密码哈希是十六进制字符串，但为了安全起见，仍然转义
    PASSWORD_HASH_ESC=$(echo "$PASSWORD_HASH" | sed "s/'/''/g")
    
    # 更新数据库中的密码哈希
    # 使用 HERE document 避免 shell 注入风险
    psql -v ON_ERROR_STOP=1 \
         --username "$POSTGRES_USER" \
         --dbname "$POSTGRES_DB" <<EOF
UPDATE users 
SET password_hash = '$PASSWORD_HASH_ESC', updated_at = NOW() 
WHERE email = 'admin@example.com' AND role = 'admin';
EOF
    
    echo "✅ 管理员密码已设置（使用 ADMIN_PASSWORD 环境变量）"
else
    echo "ℹ️  未设置 ADMIN_PASSWORD 环境变量"
    echo "   密码保持为未设置状态，首次登录时需要设置密码"
fi

echo ""
echo "=========================================="
echo "验证管理员账户"
echo "=========================================="

# 验证管理员账户状态
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$POSTGRES_DB" <<EOF
-- 显示管理员账户状态
DO \$\$
DECLARE
    admin_count INTEGER;
    admin_email_val TEXT := 'admin@example.com';
    has_password BOOLEAN;
BEGIN
    SELECT COUNT(*), COUNT(password_hash) > 0 INTO admin_count, has_password 
    FROM users WHERE email = LOWER(admin_email_val) AND role = 'admin';
    
    IF admin_count > 0 THEN
        IF has_password THEN
            RAISE NOTICE '✅ 默认管理员账户已就绪: %', admin_email_val;
            RAISE NOTICE '   - 密码已设置';
        ELSE
            RAISE NOTICE '✅ 默认管理员账户已就绪: %', admin_email_val;
            RAISE NOTICE '   - 首次登录时需要设置密码';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  未找到管理员账户，请检查初始化脚本';
    END IF;
END \$\$;
EOF

echo ""
echo "✅ 管理员账户验证完成！"
echo ""
echo "📝 管理员账户信息："
echo "   邮箱: admin@example.com"
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "   密码: 已通过 ADMIN_PASSWORD 环境变量设置"
else
    echo "   密码: 未设置（首次登录时需要设置）"
fi
echo ""
if [ -z "$ADMIN_PASSWORD" ]; then
    echo "💡 提示："
    echo "   - 首次登录时系统会提示设置密码"
    echo "   - 生产环境可通过环境变量 ADMIN_PASSWORD 预先设置密码"
fi
