#!/bin/bash

# ============================================
# PIS 用户体验测试脚本
# 用途: 测试页面加载速度、响应式设计、错误提示、表单验证等
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="http://localhost:8081"
TIMEOUT=10
PASSED=0
FAILED=0
WARNINGS=0

test_step() {
    local name=$1
    local command=$2
    local is_warning=${3:-false}
    
    echo -n "  $name... "
    
    if eval "$command" > /tmp/ux-test.log 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASSED++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️  警告${NC}"
            cat /tmp/ux-test.log | head -2
            ((WARNINGS++))
        else
            echo -e "${RED}❌ 失败${NC}"
            cat /tmp/ux-test.log | head -3
            ((FAILED++))
        fi
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 用户体验测试                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. 页面加载速度测试
# ============================================
echo -e "${CYAN}1️⃣  页面加载速度测试${NC}"

# 测试首页加载时间
start_time=$(date +%s%N)
homepage=$(curl -s --max-time $TIMEOUT "$BASE_URL/" > /dev/null 2>&1)
end_time=$(date +%s%N)
homepage_time=$(( (end_time - start_time) / 1000000 ))

if [ $homepage_time -lt 2000 ]; then
    echo -e "  首页加载时间: ${GREEN}${homepage_time}ms${NC} ✅"
    ((PASSED++))
elif [ $homepage_time -lt 5000 ]; then
    echo -e "  首页加载时间: ${YELLOW}${homepage_time}ms${NC} ⚠️"
    ((WARNINGS++))
else
    echo -e "  首页加载时间: ${RED}${homepage_time}ms${NC} ❌"
    ((FAILED++))
fi

# 测试登录页面加载时间
start_time=$(date +%s%N)
login_page=$(curl -s --max-time $TIMEOUT "$BASE_URL/admin/login" > /dev/null 2>&1)
end_time=$(date +%s%N)
login_time=$(( (end_time - start_time) / 1000000 ))

if [ $login_time -lt 2000 ]; then
    echo -e "  登录页加载时间: ${GREEN}${login_time}ms${NC} ✅"
    ((PASSED++))
elif [ $login_time -lt 5000 ]; then
    echo -e "  登录页加载时间: ${YELLOW}${login_time}ms${NC} ⚠️"
    ((WARNINGS++))
else
    echo -e "  登录页加载时间: ${RED}${login_time}ms${NC} ❌"
    ((FAILED++))
fi

# 测试 API 响应时间
start_time=$(date +%s%N)
api_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/health" > /dev/null 2>&1)
end_time=$(date +%s%N)
api_time=$(( (end_time - start_time) / 1000000 ))

if [ $api_time -lt 100 ]; then
    echo -e "  API 响应时间: ${GREEN}${api_time}ms${NC} ✅"
    ((PASSED++))
elif [ $api_time -lt 500 ]; then
    echo -e "  API 响应时间: ${YELLOW}${api_time}ms${NC} ⚠️"
    ((WARNINGS++))
else
    echo -e "  API 响应时间: ${RED}${api_time}ms${NC} ❌"
    ((FAILED++))
fi
echo ""

# ============================================
# 2. 页面内容检查
# ============================================
echo -e "${CYAN}2️⃣  页面内容检查${NC}"

# 检查登录页面是否包含必要元素
login_html=$(curl -s --max-time $TIMEOUT "$BASE_URL/admin/login")

test_step "登录页面包含标题" "echo '$login_html' | grep -qiE '(login|登录|sign in)'"
test_step "登录页面包含表单" "echo '$login_html' | grep -qiE '(form|input|button)'"
test_step "登录页面包含用户名输入" "echo '$login_html' | grep -qiE '(username|用户名|admin)'"
test_step "登录页面包含密码输入" "echo '$login_html' | grep -qiE '(password|密码|type.*password)'"
test_step "登录页面包含提交按钮" "echo '$login_html' | grep -qiE '(button|submit|登录|login)'"

# 检查页面是否有基本的 HTML 结构
test_step "页面有基本 HTML 结构" "echo '$login_html' | grep -qiE '(html|head|body)'"
echo ""

# ============================================
# 3. 错误提示友好性测试
# ============================================
echo -e "${CYAN}3️⃣  错误提示友好性测试${NC}"

# 测试空邮箱错误提示
empty_email_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"","password":"test"}')

test_step "空邮箱错误提示友好" "echo '$empty_email_response' | grep -qiE '(email|邮箱|不能为空|required|请输入)'"

# 测试空密码错误提示
empty_password_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":""}')

test_step "空密码错误提示友好" "echo '$empty_password_response' | grep -qiE '(password|密码|不能为空|required|请输入)'"

# 测试无效邮箱格式错误提示
invalid_email_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid","password":"test"}')

test_step "无效邮箱格式错误提示友好" "echo '$invalid_email_response' | grep -qiE '(email|邮箱|valid|有效|格式)'"

# 测试错误密码错误提示
wrong_password_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrong"}')

test_step "错误密码提示友好" "echo '$wrong_password_response' | grep -qiE '(error|错误|password|密码|incorrect|不正确)'"
echo ""

# ============================================
# 4. 表单验证用户体验
# ============================================
echo -e "${CYAN}4️⃣  表单验证用户体验${NC}"

# 检查前端是否有客户端验证提示（通过检查 HTML 中的验证属性）
login_html=$(curl -s --max-time $TIMEOUT "$BASE_URL/admin/login")

test_step "表单有验证属性" "echo '$login_html' | grep -qiE '(required|pattern|minlength|maxlength|type=\"email\")' || echo '$login_html' | grep -qiE '(validate|validation)'" true

# 测试 API 验证响应速度（应该在客户端验证之前）
start_time=$(date +%s%N)
validation_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid","password":""}')
end_time=$(date +%s%N)
validation_time=$(( (end_time - start_time) / 1000000 ))

if [ $validation_time -lt 200 ]; then
    echo -e "  表单验证响应时间: ${GREEN}${validation_time}ms${NC} ✅"
    ((PASSED++))
else
    echo -e "  表单验证响应时间: ${YELLOW}${validation_time}ms${NC} ⚠️"
    ((WARNINGS++))
fi
echo ""

# ============================================
# 5. 响应式设计检查
# ============================================
echo -e "${CYAN}5️⃣  响应式设计检查${NC}"

login_html=$(curl -s --max-time $TIMEOUT "$BASE_URL/admin/login")

# 检查是否有 viewport meta 标签
test_step "页面有 viewport meta 标签" "echo '$login_html' | grep -qiE 'viewport|meta.*name.*viewport'"

# 检查是否有响应式 CSS（通过检查是否有 media queries 或响应式类名）
test_step "页面有响应式设计" "echo '$login_html' | grep -qiE '(responsive|mobile|tablet|media|sm:|md:|lg:|xl:)' || echo '$login_html' | grep -qiE '(tailwind|bootstrap|flex|grid)'" true
echo ""

# ============================================
# 6. 可访问性检查
# ============================================
echo -e "${CYAN}6️⃣  可访问性检查${NC}"

login_html=$(curl -s --max-time $TIMEOUT "$BASE_URL/admin/login")

# 检查是否有 label 标签
test_step "表单有 label 标签" "echo '$login_html' | grep -qiE '<label|for='"

# 检查是否有 alt 属性（图片）
test_step "图片有 alt 属性" "echo '$login_html' | grep -qiE '<img.*alt=|aria-label' || ! echo '$login_html' | grep -qiE '<img'" true

# 检查是否有语义化 HTML
test_step "页面使用语义化 HTML" "echo '$login_html' | grep -qiE '<main|<header|<nav|<section|<article|<footer|<form'"
echo ""

# ============================================
# 7. 导航流程测试
# ============================================
echo -e "${CYAN}7️⃣  导航流程测试${NC}"

# 测试从首页到登录页的导航
test_step "首页可访问" "curl -s --max-time $TIMEOUT '$BASE_URL/' | grep -qE '(html|body)'"
test_step "登录页可访问" "curl -s --max-time $TIMEOUT '$BASE_URL/admin/login' | grep -qE '(html|body)'"

# 测试直接访问登录页
test_step "直接访问登录页正常" "curl -s -w '%{http_code}' --max-time $TIMEOUT '$BASE_URL/admin/login' -o /dev/null | grep -q '200'"
echo ""

# ============================================
# 8. 安全性用户体验
# ============================================
echo -e "${CYAN}8️⃣  安全性用户体验${NC}"

# 测试错误信息不泄露敏感信息
wrong_password_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrong"}')

test_step "错误信息不泄露用户存在性" "echo '$wrong_password_response' | grep -qvE '(user.*not.*found|用户不存在|不存在.*用户)' || echo '$wrong_password_response' | grep -qE '(邮箱或密码错误|incorrect)'"

# 测试速率限制提示
echo "  测试速率限制（发送多个请求）..."
for i in {1..10}; do
    curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' > /dev/null 2>&1
done

rate_limit_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}')

if echo "$rate_limit_response" | grep -qiE '(rate.*limit|速率|频繁|too.*many|429)'; then
    echo -e "  速率限制提示: ${GREEN}友好${NC} ✅"
    ((PASSED++))
    echo "    提示: $(echo "$rate_limit_response" | grep -oE '(message|提示):\"[^\"]*' | head -1)"
else
    echo -e "  速率限制提示: ${YELLOW}未检测到或已重置${NC} ⚠️"
    ((WARNINGS++))
fi
echo ""

# ============================================
# 9. 国际化支持检查
# ============================================
echo -e "${CYAN}9️⃣  国际化支持检查${NC}"

login_html=$(curl -s --max-time $TIMEOUT "$BASE_URL/admin/login")

# 检查是否有语言设置
test_step "页面有语言设置" "echo '$login_html' | grep -qiE '(lang=|hreflang|i18n|locale)' || echo '$login_html' | grep -qiE '(中文|English|中文|英文)'" true
echo ""

# ============================================
# 总结
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 测试结果${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
if [ $WARNINGS -gt 0 ]; then
    echo -e "警告: ${YELLOW}$WARNINGS${NC}"
fi
echo ""

rm -f /tmp/ux-test.log

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有用户体验测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED 个测试失败${NC}"
    exit 1
fi
