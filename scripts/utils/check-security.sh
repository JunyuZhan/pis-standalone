#!/bin/bash

# 🔒 PIS 项目安全检查脚本
# 用于在提交代码前检查是否有敏感信息泄露风险

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 开始安全检查..."
echo ""

ERRORS=0
WARNINGS=0

# 1. 检查敏感文件是否被 Git 跟踪
echo "1️⃣  检查敏感文件..."
SENSITIVE_FILES=$(git ls-files 2>/dev/null | grep -E "\.env$|\.env\.local$|\.key$|\.pem$|\.p12$|id_rsa$|id_dsa$" || true)

if [ -n "$SENSITIVE_FILES" ]; then
    echo -e "${RED}❌ 发现敏感文件被 Git 跟踪：${NC}"
    echo "$SENSITIVE_FILES"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有敏感文件被 Git 跟踪${NC}"
fi
echo ""

# 2. 检查 Git 历史中是否有敏感文件
echo "2️⃣  检查 Git 历史..."
HISTORY_FILES=$(git log --all --full-history --source --name-only --format="" 2>/dev/null | grep -E "\.env\.local$|\.env$" | sort -u || true)

if [ -n "$HISTORY_FILES" ]; then
    echo -e "${YELLOW}⚠️  警告：Git 历史中发现敏感文件：${NC}"
    echo "$HISTORY_FILES"
    echo -e "${YELLOW}建议：使用 git-filter-repo 从历史中删除这些文件${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ Git 历史中没有敏感文件${NC}"
fi
echo ""

# 3. 检查代码中是否有硬编码的 JWT tokens（排除 .env 文件和 .gitignore 中的文件）
echo "3️⃣  检查硬编码的 JWT tokens..."
# 排除 .gitignore 中的文件（如 cookies.txt）
JWT_TOKENS=$(grep -r "eyJ[A-Za-z0-9_-]\{50,\}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude="*.md" --exclude="*.example" --exclude=".env" --exclude="cookies.txt" --exclude="*.cookies" . 2>/dev/null || true)

if [ -n "$JWT_TOKENS" ]; then
    echo -e "${RED}❌ 发现可能的硬编码 JWT token：${NC}"
    echo "$JWT_TOKENS" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有发现硬编码的 JWT tokens${NC}"
fi
echo ""

# 4. 检查 Supabase 项目 URL 和密钥（仅在混合模式下使用，不应硬编码）
echo "4️⃣  检查 Supabase 配置..."
SUPABASE_URLS=$(grep -r "https://[a-z0-9]\{20\}\.supabase\.co" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude="*.md" --exclude="*.example" --exclude=".env" . 2>/dev/null || true)

if [ -n "$SUPABASE_URLS" ]; then
    echo -e "${RED}❌ 发现硬编码的 Supabase URL（应使用环境变量）：${NC}"
    echo "$SUPABASE_URLS" | head -3
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有发现硬编码的 Supabase URL${NC}"
fi
echo ""

# 4. 检查 AWS Access Keys
echo "5️⃣  检查 AWS Access Keys..."
AWS_KEYS=$(grep -r "AKIA[0-9A-Z]\{16\}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude="*.md" --exclude="*.example" . 2>/dev/null || true)

if [ -n "$AWS_KEYS" ]; then
    echo -e "${RED}❌ 发现可能的 AWS Access Key：${NC}"
    echo "$AWS_KEYS"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有发现 AWS Access Keys${NC}"
fi
echo ""

# 5. 检查硬编码的密码（排除测试脚本中的默认值、UI 代码和构建缓存）
echo "6️⃣  检查硬编码的密码..."
PASSWORDS=$(grep -ri "password.*=.*['\"][^'\"]\{8,\}" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=.turbo --exclude-dir=.shared \
    --exclude-dir=coverage --exclude-dir=dist --exclude-dir=out \
    --exclude="*.md" --exclude="*.example" --exclude="*.test.*" --exclude=".env" --exclude="*.pyc" --exclude="*.csv" \
    --exclude="*.tar.zst" --exclude="*.tar.gz" --exclude="*.zip" --exclude="*.log" \
    --exclude="check-security.sh" --exclude="deploy.sh" --exclude="install.sh" . 2>/dev/null | \
    grep -v "password123" | grep -v "minioadmin" | grep -v "your-" | grep -v "PIS_ADMIN_PASSWORD" | grep -v "test-password" | \
    grep -v "show.*Password" | grep -v "showConfirmPassword" | grep -v "type.*password" | grep -v "input.*password" | grep -v "Eye" | \
    grep -v "MSG_.*PASSWORD" | grep -v "Password:" | grep -v "password:" | grep -v "get_input" | \
    grep -v "passwordValue" | grep -v "PASSWORDS=" | grep -v "\.turbo" | grep -v "cache" || true)

if [ -n "$PASSWORDS" ]; then
    echo -e "${YELLOW}⚠️  警告：发现可能的硬编码密码：${NC}"
    echo "$PASSWORDS" | head -5
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ 没有发现硬编码的密码${NC}"
fi
echo ""

# 6. 检查 .env.example 文件是否包含真实密钥
echo "7️⃣  检查 .env.example 文件..."
if [ -f ".env.example" ]; then
    # 检查是否包含真实的 Supabase 项目 ID（20+ 字符的字母数字组合）
    # 检查是否包含完整的 JWT token（以 eyJ 开头，包含多个点分隔的部分）
    REAL_KEYS=$(grep -E "[a-z0-9]{20,}\.supabase\.co|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+" .env.example 2>/dev/null || true)
    if [ -n "$REAL_KEYS" ]; then
        echo -e "${RED}❌ .env.example 可能包含真实密钥！${NC}"
        echo -e "${YELLOW}请检查以下内容：${NC}"
        echo "$REAL_KEYS" | head -3
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ .env.example 只包含占位符${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  警告：未找到 .env.example 文件${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 7. 检查硬编码的私人域名
echo "8️⃣  检查硬编码的私人域名..."
# 排除示例域名、公共 CDN、镜像站和常见占位符
EXCLUDE_DOMAINS="yourdomain\.com|example\.com|localhost|127\.0\.0\.1|0\.0\.0\.0|test\.com|demo\.com|placeholder\.com"
# 公共域名白名单（这些是公开的，不是私人域名）
PUBLIC_DOMAINS="github\.com|npmjs\.com|npm\.com|vercel\.com|vercel\.app|netlify\.app|supabase\.co|supabase\.com|amazonaws\.com|aliyuncs\.com|myqcloud\.com|googleapis\.com|cloudflare\.com|jsdelivr\.net|unpkg\.com|cdnjs\.com|eslint\.org|turbo\.build|mirrors\.aliyun\.com|mirrors\.tuna\.tsinghua\.edu\.cn|dl-cdn\.alpinelinux\.org|registry\.npmjs\.org|registry\.yarnpkg\.com|nodejs\.org|docs\.docker\.com|w3\.org|dl\.min\.io|raw\.githubusercontent\.com|get\.docker\.com|fonts\.gstatic\.com|fonts\.googleapis\.com|ko-fi\.com|patreon\.com|nextjs\.org|yourname|picsum\.photos|source\.unsplash\.com|curl\.se|telegram\.org|api\.telegram\.org|ghproxy\.com"
# 查找可能的真实域名（排除示例域名和公共域名）
# 匹配 http:// 或 https:// 开头的 URL，但排除示例域名和公共域名
# 排除二进制文件（jpg, png, jpeg, gif, svg, ico, pdf 等）
PRIVATE_DOMAINS=$(grep -rE "https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=.turbo --exclude-dir=.shared --exclude-dir=coverage --exclude-dir=dist \
    --exclude="*.md" --exclude="*.example" --exclude=".env" --exclude="*.test.*" --exclude="*.spec.*" \
    --exclude="pnpm-lock.yaml" --exclude="package-lock.json" --exclude="yarn.lock" \
    --exclude="*.jpg" --exclude="*.jpeg" --exclude="*.png" --exclude="*.gif" --exclude="*.svg" --exclude="*.ico" --exclude="*.pdf" \
    --exclude="*.d.ts" --exclude="*.log" . 2>/dev/null | \
    grep -vE "$EXCLUDE_DOMAINS" | \
    grep -vE "$PUBLIC_DOMAINS" | \
    grep -vE "\.example\.|example\.|your-|placeholder|schema\.json|yourname|istanbul\.js\.org" || true)

if [ -n "$PRIVATE_DOMAINS" ]; then
    echo -e "${RED}❌ 发现可能的硬编码私人域名：${NC}"
    echo "$PRIVATE_DOMAINS" | head -10
    echo ""
    echo -e "${YELLOW}提示：请确保这些域名是示例域名，如果是私人域名，请使用环境变量。${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ 没有发现硬编码的私人域名${NC}"
fi
echo ""

# 8. 检查 .gitignore 配置
echo "9️⃣  检查 .gitignore 配置..."
if [ -f ".gitignore" ]; then
    # 检查是否配置了 .env 文件（支持多种格式：.env, .env.local, .env.*.local 等）
    if grep -qE "^\.env$|^\.env\." .gitignore || grep -qE "\.env\*|\.env\." .gitignore; then
        echo -e "${GREEN}✅ .gitignore 正确配置了环境变量文件${NC}"
    else
        echo -e "${RED}❌ .gitignore 缺少环境变量文件配置${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ 未找到 .gitignore 文件${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ 安全检查通过！可以安全地公开仓库。${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  发现 $WARNINGS 个警告，建议修复后再公开仓库。${NC}"
    exit 0
else
    echo -e "${RED}❌ 发现 $ERRORS 个错误和 $WARNINGS 个警告！${NC}"
    echo -e "${RED}请修复这些问题后再公开仓库。${NC}"
    echo ""
    echo "查看 SECURITY_CHECK.md 了解如何修复这些问题。"
    exit 1
fi
