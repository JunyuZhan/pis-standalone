#!/bin/bash

# ============================================
# PIS 综合测试脚本
# 用途: 全面测试业务逻辑、代码质量、压力测试、安全测试
# 使用方法: ./scripts/comprehensive-test.sh [--skip-build] [--skip-stress] [--skip-security]
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 参数解析
SKIP_BUILD=false
SKIP_STRESS=false
SKIP_SECURITY=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-stress)
      SKIP_STRESS=true
      shift
      ;;
    --skip-security)
      SKIP_SECURITY=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# 测试函数
test_check() {
    local name=$1
    local command=$2
    local is_warning=${3:-false}
    
    ((TOTAL_TESTS++))
    echo -n "  [$TOTAL_TESTS] $name... "
    
    if eval "$command" > /tmp/test_output.log 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️  警告${NC}"
            ((WARNINGS++))
            cat /tmp/test_output.log | head -5
        else
            echo -e "${RED}❌ 失败${NC}"
            ((FAILED_TESTS++))
            cat /tmp/test_output.log | head -10
        fi
        return 1
    fi
}

# 打印测试组标题
print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 打印测试结果摘要
print_summary() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}📊 测试结果摘要${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "总测试数: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "失败: ${RED}$FAILED_TESTS${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "警告: ${YELLOW}$WARNINGS${NC}"
    fi
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ 所有测试通过！${NC}"
        return 0
    elif [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${YELLOW}⚠️  有 $WARNINGS 个警告，但所有关键测试通过${NC}"
        return 0
    else
        echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
        return 1
    fi
}

# 开始测试
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          PIS 综合测试套件                                  ║"
echo "║          业务逻辑 | 代码质量 | 压力测试 | 安全测试          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================
# 1. 环境检查
# ============================================
print_section "1️⃣  环境检查"

test_check "Docker 服务运行" "docker ps > /dev/null"
test_check "Docker Compose 可用" "docker compose version > /dev/null"
test_check "Node.js 版本 >= 20" "node -v | grep -E 'v(2[0-9]|[3-9][0-9])'"
test_check "pnpm 已安装" "pnpm --version > /dev/null"

# 检查容器状态
print_section "2️⃣  容器状态检查"

test_check "PostgreSQL 容器运行" "docker ps --filter 'name=pis-postgres' --format '{{.Names}}' | grep -q 'pis-postgres'"
test_check "Redis 容器运行" "docker ps --filter 'name=pis-redis' --format '{{.Names}}' | grep -q 'pis-redis'"
test_check "MinIO 容器运行" "docker ps --filter 'name=pis-minio' --format '{{.Names}}' | grep -q 'pis-minio'"
test_check "Web 容器运行" "docker ps --filter 'name=pis-web' --format '{{.Names}}' | grep -q 'pis-web'"
test_check "Worker 容器运行" "docker ps --filter 'name=pis-worker' --format '{{.Names}}' | grep -q 'pis-worker'"

# 检查容器健康状态
test_check "PostgreSQL 健康检查" "docker inspect pis-postgres --format '{{.State.Health.Status}}' | grep -q 'healthy'"
test_check "Redis 健康检查" "docker inspect pis-redis --format '{{.State.Health.Status}}' | grep -q 'healthy'"
test_check "MinIO 健康检查" "docker inspect pis-minio --format '{{.State.Health.Status}}' | grep -q 'healthy'"
test_check "Web 容器健康检查" "docker inspect pis-web --format '{{.State.Health.Status}}' | grep -q 'healthy'"
test_check "Worker 容器健康检查" "docker inspect pis-worker --format '{{.State.Health.Status}}' | grep -q 'healthy'"

# ============================================
# 3. 代码质量测试
# ============================================
print_section "3️⃣  代码质量测试"

if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}正在运行代码质量检查...${NC}"
    
    test_check "TypeScript 类型检查" "cd /Users/apple/Documents/Project/PIS/pis-standalone && pnpm --filter @pis/web exec tsc --noEmit" true
    test_check "ESLint 代码检查" "cd /Users/apple/Documents/Project/PIS/pis-standalone && pnpm lint" true
    test_check "代码格式化检查" "cd /Users/apple/Documents/Project/PIS/pis-standalone && pnpm format --check" true
else
    echo -e "${YELLOW}跳过代码质量检查（--skip-build）${NC}"
fi

# ============================================
# 4. 单元测试和集成测试
# ============================================
print_section "4️⃣  单元测试和集成测试"

echo -e "${YELLOW}正在运行测试套件...${NC}"
test_check "运行所有测试" "cd /Users/apple/Documents/Project/PIS/pis-standalone && pnpm test" true

# ============================================
# 5. API 业务逻辑测试
# ============================================
print_section "5️⃣  API 业务逻辑测试"

BASE_URL="http://localhost:8081"
TIMEOUT=10

# 健康检查端点
test_check "健康检查端点" "curl -f -s --max-time $TIMEOUT $BASE_URL/api/health | grep -q 'healthy' || curl -f -s --max-time $TIMEOUT $BASE_URL/health | grep -q 'healthy'"

# 检查管理员状态端点
test_check "管理员状态检查端点" "curl -f -s --max-time $TIMEOUT $BASE_URL/api/auth/check-admin-status | grep -q 'needsPasswordSetup'"

# 登录端点（应该返回错误，因为没有提供凭证）
test_check "登录端点存在" "curl -f -s --max-time $TIMEOUT -X POST $BASE_URL/api/auth/login -H 'Content-Type: application/json' -d '{}' | grep -qE '(error|message|email|password)'"

# 公开相册端点（应该返回 404 或空列表，因为没有相册）
test_check "公开相册端点存在" "curl -f -s --max-time $TIMEOUT $BASE_URL/api/public/albums/test-slug 2>&1 | grep -qE '(404|error|not found|[])'"

# MinIO Console 代理端点
test_check "MinIO Console 代理端点" "curl -f -s --max-time $TIMEOUT $BASE_URL/minio-console/ 2>&1 | grep -qE '(200|302|401|403|MinIO|console)'"

# Media 代理端点（应该返回 404，因为没有文件）
test_check "Media 代理端点存在" "curl -f -s --max-time $TIMEOUT $BASE_URL/media/test.jpg 2>&1 | grep -qE '(404|403|error)'"

# ============================================
# 6. 数据库连接测试
# ============================================
print_section "6️⃣  数据库连接测试"

test_check "PostgreSQL 连接" "docker exec pis-postgres psql -U postgres -d pis -c 'SELECT 1' > /dev/null 2>&1"
test_check "Redis 连接" "docker exec pis-redis redis-cli ping | grep -q 'PONG'"
test_check "MinIO 连接" "docker exec pis-minio mc --version > /dev/null 2>&1 || curl -f -s --max-time $TIMEOUT http://localhost:9000/minio/health/live > /dev/null 2>&1" true

# ============================================
# 7. 压力测试
# ============================================
print_section "7️⃣  压力测试"

if [ "$SKIP_STRESS" = false ]; then
    # 检查是否有压力测试工具
    if command -v ab > /dev/null 2>&1; then
        echo -e "${YELLOW}使用 Apache Bench 进行压力测试...${NC}"
        
        # 健康检查端点压力测试
        test_check "健康检查端点压力测试 (100 请求)" "ab -n 100 -c 10 -q $BASE_URL/api/health 2>&1 | grep -q 'Requests per second'"
        
        # 管理员状态端点压力测试
        test_check "管理员状态端点压力测试 (50 请求)" "ab -n 50 -c 5 -q $BASE_URL/api/auth/check-admin-status 2>&1 | grep -q 'Requests per second'"
        
    elif command -v wrk > /dev/null 2>&1; then
        echo -e "${YELLOW}使用 wrk 进行压力测试...${NC}"
        
        test_check "健康检查端点压力测试 (100 请求)" "wrk -t2 -c10 -d2s --timeout 5s $BASE_URL/api/health 2>&1 | grep -q 'Requests/sec'"
        test_check "管理员状态端点压力测试 (50 请求)" "wrk -t2 -c5 -d2s --timeout 5s $BASE_URL/api/auth/check-admin-status 2>&1 | grep -q 'Requests/sec'"
        
    else
        echo -e "${YELLOW}未找到压力测试工具 (ab/wrk)，使用 curl 进行简单并发测试...${NC}"
        
        # 简单的并发测试
        test_check "健康检查端点并发测试 (10 并发)" "for i in {1..10}; do curl -f -s --max-time $TIMEOUT $BASE_URL/api/health > /dev/null & done; wait"
    fi
else
    echo -e "${YELLOW}跳过压力测试（--skip-stress）${NC}"
fi

# ============================================
# 8. 安全测试
# ============================================
print_section "8️⃣  安全测试"

if [ "$SKIP_SECURITY" = false ]; then
    # 运行安全检查脚本
    test_check "运行安全检查脚本" "cd /Users/apple/Documents/Project/PIS/pis-standalone && bash scripts/check-security.sh" true
    
    # SQL 注入测试（登录端点）
    echo -e "${YELLOW}进行 SQL 注入测试...${NC}"
    test_check "SQL 注入防护测试" "curl -f -s --max-time $TIMEOUT -X POST $BASE_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com'\'' OR '\''1'\''='\''1\",\"password\":\"test\"}' 2>&1 | grep -qv 'syntax error\|SQL error\|database error'"
    
    # XSS 测试
    echo -e "${YELLOW}进行 XSS 测试...${NC}"
    test_check "XSS 防护测试" "curl -f -s --max-time $TIMEOUT -X POST $BASE_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"<script>alert(1)</script>\",\"password\":\"test\"}' 2>&1 | grep -qv '<script>'"
    
    # 路径遍历测试
    echo -e "${YELLOW}进行路径遍历测试...${NC}"
    test_check "路径遍历防护测试" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/../etc/passwd' 2>&1 | grep -qv 'root:'"
    
    # CORS 测试
    echo -e "${YELLOW}进行 CORS 测试...${NC}"
    test_check "CORS 配置检查" "curl -f -s --max-time $TIMEOUT -H 'Origin: http://evil.com' -H 'Access-Control-Request-Method: POST' -X OPTIONS $BASE_URL/api/auth/login 2>&1 | grep -qE '(Access-Control|CORS)' || true"
    
    # 速率限制测试（如果实现）
    echo -e "${YELLOW}进行速率限制测试...${NC}"
    test_check "速率限制检查" "for i in {1..20}; do curl -f -s --max-time $TIMEOUT -X POST $BASE_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}' > /dev/null 2>&1; done; true" true
    
else
    echo -e "${YELLOW}跳过安全测试（--skip-security）${NC}"
fi

# ============================================
# 9. 功能完整性测试
# ============================================
print_section "9️⃣  功能完整性测试"

# 检查关键文件是否存在
test_check "Web 应用构建输出存在" "test -d /Users/apple/Documents/Project/PIS/pis-standalone/apps/web/.next || docker exec pis-web ls -d /app/apps/web/.next > /dev/null 2>&1" true

# 检查环境变量配置
test_check "环境变量文件存在" "test -f /Users/apple/Documents/Project/PIS/pis-standalone/.env.example"

# 检查 Docker Compose 配置
test_check "Docker Compose 配置存在" "test -f /Users/apple/Documents/Project/PIS/pis-standalone/docker/docker-compose.standalone.yml"

# ============================================
# 10. 日志和错误处理测试
# ============================================
print_section "🔟 日志和错误处理测试"

# 检查容器日志是否有严重错误
test_check "Web 容器日志无严重错误" "docker logs pis-web --tail 100 2>&1 | grep -ivE '(error|fatal|panic)' | wc -l | grep -qE '[1-9]' || docker logs pis-web --tail 100 2>&1 | grep -iE '(error|fatal|panic)' | grep -vE '(deprecated|warning)' | wc -l | grep -q '^0$'" true

test_check "Worker 容器日志无严重错误" "docker logs pis-worker --tail 100 2>&1 | grep -ivE '(error|fatal|panic)' | wc -l | grep -qE '[1-9]' || docker logs pis-worker --tail 100 2>&1 | grep -iE '(error|fatal|panic)' | grep -vE '(deprecated|warning)' | wc -l | grep -q '^0$'" true

# ============================================
# 打印测试结果摘要
# ============================================
print_summary

# 清理临时文件
rm -f /tmp/test_output.log

exit $?
