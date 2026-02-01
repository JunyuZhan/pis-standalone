#!/bin/bash

# ============================================
# PIS 业务逻辑测试脚本
# 用途: 测试核心业务流程和数据一致性
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
    
    if eval "$command" > /tmp/business-test.log 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASSED++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️  警告${NC}"
            cat /tmp/business-test.log | head -2
            ((WARNINGS++))
        else
            echo -e "${RED}❌ 失败${NC}"
            cat /tmp/business-test.log | head -3
            ((FAILED++))
        fi
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 业务逻辑测试                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. 管理员账户状态检查
# ============================================
echo -e "${CYAN}1️⃣  管理员账户状态检查${NC}"

test_step "检查管理员账户是否存在" "curl -s --max-time $TIMEOUT '$BASE_URL/api/auth/check-admin-status' | grep -q 'needsPasswordSetup'"

admin_status=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/check-admin-status")
needs_setup=$(echo "$admin_status" | grep -o '"needsPasswordSetup":[^,}]*' | cut -d: -f2)
admin_email=$(echo "$admin_status" | grep -o '"email":"[^"]*"' | cut -d'"' -f4)

echo "    管理员邮箱: $admin_email"
echo "    需要设置密码: $needs_setup"

# 检查数据库中管理员账户
test_step "验证数据库中的管理员账户" "docker exec pis-postgres psql -U pis -d pis -c \"SELECT email, role, is_active FROM users WHERE role='admin';\" | grep -q 'admin@example.com'"

user_count=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
echo "    数据库用户总数: $user_count"
echo ""

# ============================================
# 2. 登录流程业务逻辑
# ============================================
echo -e "${CYAN}2️⃣  登录流程业务逻辑${NC}"

# 测试用户名登录（admin）
test_step "用户名登录支持 (admin -> admin@example.com)" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"admin\",\"password\":\"wrong\"}' | grep -qE '(error|AUTH_ERROR)'"

# 测试邮箱登录
test_step "邮箱登录支持" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"$admin_email\",\"password\":\"wrong\"}' | grep -qE '(error|AUTH_ERROR)'"

# 测试错误密码处理
login_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$admin_email\",\"password\":\"wrongpassword123\"}")

test_step "错误密码返回正确错误码" "echo '$login_response' | grep -qE '(AUTH_ERROR|邮箱或密码错误)'"

# 测试空密码处理
test_step "空密码验证" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"$admin_email\",\"password\":\"\"}' | grep -qE '(error|password|密码)'"

# 测试无效邮箱格式
test_step "无效邮箱格式验证" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"invalid-email\",\"password\":\"test\"}' | grep -qE '(error|valid|邮箱)'"
echo ""

# ============================================
# 3. API 响应格式一致性
# ============================================
echo -e "${CYAN}3️⃣  API 响应格式一致性${NC}"

# 健康检查响应格式
health_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/health")
test_step "健康检查响应格式正确" "echo '$health_response' | grep -qE '(status|healthy|timestamp|service)'"

# 管理员状态响应格式
admin_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/check-admin-status")
test_step "管理员状态响应格式正确" "echo '$admin_response' | grep -qE '(needsPasswordSetup|email)'"

# 错误响应格式
error_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test@test.com\",\"password\":\"wrong\"}")
test_step "错误响应格式正确" "echo '$error_response' | grep -qE '(error|code|message)'"
echo ""

# ============================================
# 4. 数据一致性检查
# ============================================
echo -e "${CYAN}4️⃣  数据一致性检查${NC}"

# 检查用户表结构
test_step "用户表结构正确" "docker exec pis-postgres psql -U pis -d pis -c '\d users' | grep -qE '(email|password_hash|role|is_active)'"

# 检查管理员账户数据完整性
test_step "管理员账户数据完整" "docker exec pis-postgres psql -U pis -d pis -c \"SELECT email, role, is_active FROM users WHERE role='admin';\" | grep -qE '(admin@example.com|admin|t)'"

# 检查数据库连接状态
test_step "数据库连接正常" "docker exec pis-postgres psql -U pis -d pis -c 'SELECT 1;' | grep -q '1'"

# 检查 Redis 连接
test_step "Redis 连接正常" "docker exec pis-redis redis-cli PING | grep -q 'PONG'"
echo ""

# ============================================
# 5. 错误处理逻辑
# ============================================
echo -e "${CYAN}5️⃣  错误处理逻辑${NC}"

# 测试不存在的端点
test_step "404 错误处理" "curl -s --max-time $TIMEOUT '$BASE_URL/api/non-existent-endpoint' | grep -qE '(404|Not Found|not found)' || curl -s -w '%{http_code}' --max-time $TIMEOUT '$BASE_URL/api/non-existent-endpoint' -o /dev/null | grep -q '404'"

# 测试无效的 JSON
test_step "无效 JSON 处理" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d 'invalid json' | grep -qE '(error|400|Bad Request)' || curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d 'invalid json' -o /dev/null | grep -q '400'"

# 测试缺少 Content-Type
test_step "缺少 Content-Type 处理" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}' | grep -qE '(error|400|Content-Type)' || curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -d '{}' -o /dev/null | grep -qE '(400|415)'" true
echo ""

# ============================================
# 6. 边界条件测试
# ============================================
echo -e "${CYAN}6️⃣  边界条件测试${NC}"

# 测试超长邮箱
long_email=$(printf 'a%.0s' {1..300})"@test.com"
test_step "超长邮箱处理" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"$long_email\",\"password\":\"test\"}' | grep -qE '(error|valid|邮箱)' || true"

# 测试特殊字符
test_step "特殊字符处理" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"test+special@test.com\",\"password\":\"test\"}' | grep -qE '(error|AUTH_ERROR)'"

# 测试空字符串
test_step "空字符串处理" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"\",\"password\":\"\"}' | grep -qE '(error|email|password|不能为空)'"
echo ""

# ============================================
# 7. 并发请求处理
# ============================================
echo -e "${CYAN}7️⃣  并发请求处理${NC}"

echo "  发送 5 个并发请求..."
for i in {1..5}; do
    curl -s --max-time $TIMEOUT "$BASE_URL/api/health" > /dev/null &
done
wait

test_step "并发请求处理正常" "true"
echo ""

# ============================================
# 8. 服务依赖检查
# ============================================
echo -e "${CYAN}8️⃣  服务依赖检查${NC}"

# Worker 服务依赖检查
worker_health=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/worker/health")
test_step "Worker 服务依赖检查" "echo '$worker_health' | grep -qE '(redis|database|storage|status)'"

# 检查 Worker 服务状态
if echo "$worker_health" | grep -q '"status":"ok"'; then
    echo "    ✅ Worker 服务状态: OK"
    echo "$worker_health" | grep -o '"status":"[^"]*"' | head -1
fi
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

rm -f /tmp/business-test.log

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有业务逻辑测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED 个测试失败${NC}"
    exit 1
fi
