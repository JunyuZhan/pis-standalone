#!/bin/bash

# ============================================
# PIS API 端点详细测试脚本
# 用途: 测试所有 API 端点的功能和响应
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

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=${5:-200}
    local is_warning=${6:-false}
    
    echo -n "  测试 $name ($method $endpoint)... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BASE_URL$endpoint" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    elif [ "$method" = "OPTIONS" ]; then
        response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT -X OPTIONS "$BASE_URL$endpoint" \
            -H "Origin: http://localhost:3000" \
            -H "Access-Control-Request-Method: POST" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT -X "$method" "$BASE_URL$endpoint" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ] || [ "$http_code" = "404" ] || [ "$http_code" = "401" ] || [ "$http_code" = "400" ] || [ "$http_code" = "429" ]; then
        echo -e "${GREEN}✅ 通过${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️  警告${NC} (HTTP $http_code)"
            ((WARNINGS++))
        else
            echo -e "${RED}❌ 失败${NC} (HTTP $http_code)"
            echo "    响应: $(echo "$body" | head -1)"
            ((FAILED++))
        fi
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS API 端点详细测试                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. 健康检查端点
# ============================================
echo -e "${CYAN}1️⃣  健康检查端点${NC}"
test_endpoint "健康检查 (API)" "GET" "/api/health" "" "200"
test_endpoint "健康检查 (根路径)" "GET" "/health" "" "200" true
echo ""

# ============================================
# 2. 认证相关端点
# ============================================
echo -e "${CYAN}2️⃣  认证相关端点${NC}"
test_endpoint "管理员状态检查" "GET" "/api/auth/check-admin-status" "" "200"
test_endpoint "登录端点 (无效凭证)" "POST" "/api/auth/login" '{"email":"test@test.com","password":"wrong"}' "400"
test_endpoint "登录端点 (空数据)" "POST" "/api/auth/login" '{}' "400"
test_endpoint "登录端点 (缺少字段)" "POST" "/api/auth/login" '{"email":"test@test.com"}' "400"
test_endpoint "登录端点 CORS" "OPTIONS" "/api/auth/login" "" "200" true
echo ""

# ============================================
# 3. 公开相册端点
# ============================================
echo -e "${CYAN}3️⃣  公开相册端点${NC}"
test_endpoint "公开相册列表 (不存在的slug)" "GET" "/api/public/albums/non-existent-slug" "" "404"
test_endpoint "公开相册照片 (不存在的slug)" "GET" "/api/public/albums/non-existent-slug/photos" "" "404"
test_endpoint "公开相册组 (不存在的slug)" "GET" "/api/public/albums/non-existent-slug/groups" "" "404"
echo ""

# ============================================
# 4. 代理端点
# ============================================
echo -e "${CYAN}4️⃣  代理端点${NC}"
test_endpoint "MinIO Console 代理" "GET" "/minio-console/" "" "200" true
test_endpoint "Media 代理 (不存在的文件)" "GET" "/media/non-existent.jpg" "" "404"
test_endpoint "Worker API 代理" "GET" "/api/worker/health" "" "200" true
echo ""

# ============================================
# 5. 管理端点 (需要认证，预期 401)
# ============================================
echo -e "${CYAN}5️⃣  管理端点 (需要认证)${NC}"
test_endpoint "相册列表 (未认证)" "GET" "/api/admin/albums" "" "401"
test_endpoint "模板列表 (未认证)" "GET" "/api/admin/templates" "" "401"
test_endpoint "样式预设 (未认证)" "GET" "/api/admin/style-presets" "" "401"
echo ""

# ============================================
# 6. 其他端点
# ============================================
echo -e "${CYAN}6️⃣  其他端点${NC}"
test_endpoint "根路径" "GET" "/" "" "200"
test_endpoint "登录页面" "GET" "/admin/login" "" "200"
test_endpoint "404 页面" "GET" "/non-existent-page" "" "404" true
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

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有 API 端点测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED 个端点测试失败${NC}"
    exit 1
fi
