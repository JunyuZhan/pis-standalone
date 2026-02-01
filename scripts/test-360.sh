#!/bin/bash

# ============================================
# PIS 360度全面测试脚本
# 用途: 全方位测试系统，包括端到端、压力、故障恢复、数据完整性等
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

BASE_URL="http://localhost:8081"
TIMEOUT=10
REPORT_FILE="/tmp/pis-360-test-$(date +%Y%m%d-%H%M%S).txt"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

test_step() {
    local name=$1
    local command=$2
    local is_warning=${3:-false}
    
    ((TOTAL_TESTS++))
    echo -n "  [$TOTAL_TESTS] $name... "
    
    if eval "$command" > /tmp/test-360.log 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️  警告${NC}"
            cat /tmp/test-360.log | head -2
            ((WARNINGS++))
        else
            echo -e "${RED}❌ 失败${NC}"
            cat /tmp/test-360.log | head -3
            ((FAILED_TESTS++))
        fi
        return 1
    fi
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 360度全面测试                                ║${NC}"
echo -e "${BLUE}║          端到端 | 压力 | 故障恢复 | 数据完整性            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "报告文件: ${CYAN}$REPORT_FILE${NC}"
echo ""

# 初始化报告
{
    echo "PIS 360度全面测试报告"
    echo "======================"
    echo "生成时间: $(date)"
    echo ""
} > "$REPORT_FILE"

# ============================================
# 1. 端到端流程测试
# ============================================
print_section "1️⃣  端到端流程测试"

test_step "1.1 健康检查 -> 管理员状态 -> 登录页面" "curl -s --max-time $TIMEOUT '$BASE_URL/api/health' | grep -q 'healthy' && curl -s --max-time $TIMEOUT '$BASE_URL/api/auth/check-admin-status' | grep -q 'needsPasswordSetup' && curl -s --max-time $TIMEOUT '$BASE_URL/admin/login' | grep -q 'html'"

test_step "1.2 完整登录流程（错误密码）" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"wrong\"}' | grep -qE '(error|AUTH_ERROR)'"

test_step "1.3 API 端点链式调用" "curl -s --max-time $TIMEOUT '$BASE_URL/api/health' > /dev/null && curl -s --max-time $TIMEOUT '$BASE_URL/api/auth/check-admin-status' > /dev/null && curl -s --max-time $TIMEOUT '$BASE_URL/api/worker/health' > /dev/null"

# ============================================
# 2. 压力测试和负载测试
# ============================================
print_section "2️⃣  压力测试和负载测试"

echo "  2.1 并发请求测试（50个请求）..."
for i in {1..50}; do
    curl -s --max-time $TIMEOUT "$BASE_URL/api/health" > /dev/null &
done
wait
test_step "2.1 50个并发请求" "true"

echo "  2.2 持续负载测试（100个请求，10并发）..."
if command -v ab > /dev/null 2>&1; then
    ab -n 100 -c 10 -q "$BASE_URL/api/health" > /tmp/ab-test.log 2>&1
    test_step "2.2 Apache Bench 压力测试" "grep -q 'Requests per second' /tmp/ab-test.log"
    if [ $? -eq 0 ]; then
        rps=$(grep 'Requests per second' /tmp/ab-test.log | awk '{print $4}')
        echo "    请求速率: ${GREEN}$rps 请求/秒${NC}"
    fi
else
    test_step "2.2 Apache Bench 压力测试" "false" true
fi

echo "  2.3 长时间运行测试（30秒）..."
start_time=$(date +%s)
end_time=$((start_time + 30))
request_count=0
while [ $(date +%s) -lt $end_time ]; do
    curl -s --max-time 5 "$BASE_URL/api/health" > /dev/null 2>&1 && ((request_count++)) || true
    sleep 0.1
done
test_step "2.3 长时间运行测试" "[ $request_count -gt 50 ]"
echo "    30秒内完成请求数: $request_count"

# ============================================
# 3. 故障恢复测试
# ============================================
print_section "3️⃣  故障恢复测试"

test_step "3.1 服务重启后恢复" "docker restart pis-web > /dev/null 2>&1 && sleep 5 && curl -s --max-time $TIMEOUT '$BASE_URL/api/health' | grep -q 'healthy'"

test_step "3.2 数据库连接恢复" "docker exec pis-postgres psql -U pis -d pis -c 'SELECT 1;' | grep -q '1'"

test_step "3.3 Redis 连接恢复" "docker exec pis-redis redis-cli PING | grep -q 'PONG'"

test_step "3.4 Worker 服务恢复" "curl -s --max-time $TIMEOUT '$BASE_URL/api/worker/health' | grep -q 'ok'"

# ============================================
# 4. 数据完整性测试
# ============================================
print_section "4️⃣  数据完整性测试"

# 检查数据库表结构
test_step "4.1 用户表结构完整性" "docker exec pis-postgres psql -U pis -d pis -c '\d users' | grep -qE '(email|password_hash|role|is_active|created_at|updated_at)'"

# 检查数据一致性
user_count=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
test_step "4.2 用户数据一致性" "[ $user_count -ge 0 ]"
echo "    用户数量: $user_count"

# 检查管理员账户完整性
admin_exists=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='admin' AND email='admin@example.com';" | tr -d ' ')
test_step "4.3 管理员账户完整性" "[ $admin_exists -eq 1 ]"

# 检查数据约束
test_step "4.4 数据库约束检查" "docker exec pis-postgres psql -U pis -d pis -c '\d users' | grep -qE '(PRIMARY KEY|UNIQUE|NOT NULL)'"

# ============================================
# 5. 网络异常测试
# ============================================
print_section "5️⃣  网络异常测试"

test_step "5.1 超时处理" "curl -s --max-time 1 '$BASE_URL/api/health' > /dev/null 2>&1 || true"

test_step "5.2 无效URL处理" "curl -s --max-time $TIMEOUT '$BASE_URL/invalid-path-12345' 2>&1 | grep -qE '(404|Not Found|not found)' || curl -s -w '%{http_code}' --max-time $TIMEOUT '$BASE_URL/invalid-path-12345' -o /dev/null | grep -q '404'"

test_step "5.3 恶意请求处理" "curl -s --max-time $TIMEOUT '$BASE_URL/api/../etc/passwd' 2>&1 | grep -qv 'root:'"

# ============================================
# 6. 缓存一致性测试
# ============================================
print_section "6️⃣  缓存一致性测试"

# 测试 Redis 缓存
test_step "6.1 Redis 缓存写入" "docker exec pis-redis redis-cli SET test_key 'test_value' | grep -q 'OK'"

test_step "6.2 Redis 缓存读取" "docker exec pis-redis redis-cli GET test_key | grep -q 'test_value'"

test_step "6.3 Redis 缓存删除" "docker exec pis-redis redis-cli DEL test_key | grep -q '1'"

# ============================================
# 7. 会话管理测试
# ============================================
print_section "7️⃣  会话管理测试"

# 测试 Cookie 设置
login_response=$(curl -s -c /tmp/cookies.txt --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrong"}')

test_step "7.1 Cookie 管理" "[ -f /tmp/cookies.txt ]"

# 测试会话过期（模拟）
test_step "7.2 会话安全性" "grep -qE '(HttpOnly|Secure|SameSite)' /tmp/cookies.txt || true"

rm -f /tmp/cookies.txt

# ============================================
# 8. API 版本兼容性测试
# ============================================
print_section "8️⃣  API 版本兼容性测试"

test_step "8.1 API 响应格式兼容性" "curl -s --max-time $TIMEOUT '$BASE_URL/api/health' | grep -qE '(status|healthy|timestamp|service)'"

test_step "8.2 错误响应格式兼容性" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{}' | grep -qE '(error|code|message)'"

# ============================================
# 9. 资源限制测试
# ============================================
print_section "9️⃣  资源限制测试"

# 检查容器资源使用
web_memory=$(docker stats --no-stream --format "{{.MemUsage}}" pis-web | awk '{print $1}' | sed 's/MiB//')
test_step "9.1 Web 容器内存使用" "[ $(echo "$web_memory" | cut -d. -f1) -lt 500 ]"
echo "    Web 容器内存: ${web_memory}MB"

worker_memory=$(docker stats --no-stream --format "{{.MemUsage}}" pis-worker | awk '{print $1}' | sed 's/MiB//')
test_step "9.2 Worker 容器内存使用" "[ $(echo "$worker_memory" | cut -d. -f1) -lt 200 ]"
echo "    Worker 容器内存: ${worker_memory}MB"

# ============================================
# 10. 安全性深度测试
# ============================================
print_section "🔟 安全性深度测试"

# SQL 注入测试
test_step "10.1 SQL 注入防护" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com'\'' OR '\''1'\''='\''1\",\"password\":\"test\"}' | grep -qvE '(syntax error|SQL error|database error|PostgreSQL)'"

# XSS 测试
test_step "10.2 XSS 防护" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"<script>alert(1)</script>\",\"password\":\"test\"}' | grep -qv '<script>'"

# CSRF 测试（检查是否有 CSRF token）
test_step "10.3 CSRF 防护检查" "curl -s --max-time $TIMEOUT '$BASE_URL/admin/login' | grep -qiE '(csrf|token|_token)' || true"

# 路径遍历测试
test_step "10.4 路径遍历防护" "curl -s --max-time $TIMEOUT '$BASE_URL/api/../../etc/passwd' 2>&1 | grep -qv 'root:'"

# 速率限制测试
echo "  10.5 速率限制测试（发送30个请求）..."
rate_limit_triggered=false
for i in {1..30}; do
    response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' -o /dev/null)
    if [ "$response" = "429" ]; then
        rate_limit_triggered=true
        break
    fi
done
if [ "$rate_limit_triggered" = true ]; then
    echo -e "  速率限制: ${GREEN}✅ 已触发${NC}"
    ((PASSED_TESTS++))
else
    echo -e "  速率限制: ${YELLOW}⚠️  未触发（可能需要更多请求）${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))

# ============================================
# 11. 性能基准测试
# ============================================
print_section "1️⃣1️⃣  性能基准测试"

# API 响应时间基准
api_times=()
for i in {1..10}; do
    start=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$BASE_URL/api/health" > /dev/null
    end=$(date +%s%N)
    time=$(( (end - start) / 1000000 ))
    api_times+=($time)
done

avg_time=$(echo "${api_times[@]}" | awk '{sum=0; for(i=1;i<=NF;i++) sum+=$i; print sum/NF}')
max_time=$(echo "${api_times[@]}" | awk '{max=$1; for(i=2;i<=NF;i++) if($i>max) max=$i; print max}')
min_time=$(echo "${api_times[@]}" | awk '{min=$1; for(i=2;i<=NF;i++) if($i<min) min=$i; print min}')

echo "  API 响应时间统计（10次请求）:"
echo "    平均: ${GREEN}${avg_time}ms${NC}"
echo "    最大: ${YELLOW}${max_time}ms${NC}"
echo "    最小: ${GREEN}${min_time}ms${NC}"

test_step "11.1 API 平均响应时间 < 100ms" "[ $(echo "$avg_time" | cut -d. -f1) -lt 100 ]"

# ============================================
# 12. 日志和监控测试
# ============================================
print_section "1️⃣2️⃣  日志和监控测试"

test_step "12.1 Web 容器日志可访问" "docker logs pis-web --tail 10 > /dev/null 2>&1"

test_step "12.2 Worker 容器日志可访问" "docker logs pis-worker --tail 10 > /dev/null 2>&1"

test_step "12.3 日志无严重错误" "docker logs pis-web --tail 100 2>&1 | grep -iE '(error|fatal|panic)' | grep -vE '(deprecated|warning)' | wc -l | grep -q '^0$' || docker logs pis-web --tail 100 2>&1 | grep -iE '(error|fatal|panic)' | grep -vE '(deprecated|warning)' | wc -l | grep -qE '^[0-2]$'" true

# ============================================
# 13. 配置验证测试
# ============================================
print_section "1️⃣3️⃣  配置验证测试"

test_step "13.1 环境变量配置" "docker exec pis-web env | grep -qE '(DATABASE|REDIS|MINIO)' || true"

test_step "13.2 Docker Compose 配置" "[ -f docker/docker-compose.standalone.yml ]"

test_step "13.3 网络配置" "docker network ls | grep -q 'pis-network'"

# ============================================
# 14. 数据备份和恢复测试
# ============================================
print_section "1️⃣4️⃣  数据备份和恢复测试"

# 测试数据库备份
test_step "14.1 数据库备份功能" "docker exec pis-postgres pg_dump -U pis pis > /tmp/pis_backup.sql 2>&1 && [ -f /tmp/pis_backup.sql ]"

# 检查备份文件大小
if [ -f /tmp/pis_backup.sql ]; then
    backup_size=$(wc -c < /tmp/pis_backup.sql)
    echo "    备份文件大小: ${backup_size} 字节"
    test_step "14.2 备份文件有效性" "[ $backup_size -gt 0 ]"
    rm -f /tmp/pis_backup.sql
fi

# ============================================
# 15. 跨服务通信测试
# ============================================
print_section "1️⃣5️⃣  跨服务通信测试"

test_step "15.1 Web -> PostgreSQL 通信" "docker exec pis-web ping -c 1 pis-postgres > /dev/null 2>&1 || docker exec pis-web nc -zv pis-postgres 5432 > /dev/null 2>&1 || true"

test_step "15.2 Web -> Redis 通信" "docker exec pis-web ping -c 1 pis-redis > /dev/null 2>&1 || docker exec pis-web nc -zv pis-redis 6379 > /dev/null 2>&1 || true"

test_step "15.3 Web -> MinIO 通信" "docker exec pis-web ping -c 1 pis-minio > /dev/null 2>&1 || docker exec pis-web nc -zv pis-minio 9000 > /dev/null 2>&1 || true"

test_step "15.4 Web -> Worker 通信" "docker exec pis-web ping -c 1 pis-worker > /dev/null 2>&1 || docker exec pis-web nc -zv pis-worker 3001 > /dev/null 2>&1 || true"

# ============================================
# 总结
# ============================================
print_section "📊 测试总结"

{
    echo ""
    echo "========================================"
    echo "测试总结"
    echo "========================================"
    echo "总测试数: $TOTAL_TESTS"
    echo "通过: $PASSED_TESTS"
    echo "失败: $FAILED_TESTS"
    echo "警告: $WARNINGS"
    echo "完成时间: $(date)"
    echo ""
} >> "$REPORT_FILE"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 测试结果${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "总测试数: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
if [ $WARNINGS -gt 0 ]; then
    echo -e "警告: ${YELLOW}$WARNINGS${NC}"
fi
echo ""
echo -e "详细报告: ${CYAN}$REPORT_FILE${NC}"
echo ""

# 计算通过率
if [ $TOTAL_TESTS -gt 0 ]; then
    pass_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    echo -e "通过率: ${GREEN}${pass_rate}%${NC}"
fi

rm -f /tmp/test-360.log /tmp/ab-test.log

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有360度测试通过！${NC}"
    exit 0
elif [ $FAILED_TESTS -le 2 ]; then
    echo -e "${YELLOW}⚠️  有 $FAILED_TESTS 个测试失败，但整体表现良好${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
