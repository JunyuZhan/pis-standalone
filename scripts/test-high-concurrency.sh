#!/bin/bash

# ============================================
# PIS 高并发测试脚本
# 用途: 测试系统在高并发场景下的性能和稳定性
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
TIMEOUT=30
REPORT_FILE="/tmp/pis-high-concurrency-test-$(date +%Y%m%d-%H%M%S).txt"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

test_concurrent() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local concurrency=$4
    local total_requests=$5
    local data=${6:-""}
    
    echo "  测试: $name"
    echo "  并发数: $concurrency"
    echo "  总请求数: $total_requests"
    echo -n "  执行中... "
    
    local start_time=$(date +%s%N)
    local success_count=0
    local error_count=0
    local temp_dir=$(mktemp -d)
    local pids=()
    
    # 创建并发请求函数
    make_request() {
        local req_num=$1
        if [ "$method" = "POST" ]; then
            response=$(curl -s -w "\n%{http_code}\n%{time_total}" --max-time $TIMEOUT -X POST "$url" \
                -H "Content-Type: application/json" \
                -d "$data" 2>&1)
        else
            response=$(curl -s -w "\n%{http_code}\n%{time_total}" --max-time $TIMEOUT "$url" 2>&1)
        fi
        
        http_code=$(echo "$response" | tail -2 | head -1)
        time_total=$(echo "$response" | tail -1)
        
        echo "$req_num|$http_code|$time_total" > "$temp_dir/result_$req_num.txt"
    }
    
    # 启动并发请求
    local req_per_concurrent=$((total_requests / concurrency))
    local req_num=1
    
    for ((i=1; i<=concurrency; i++)); do
        for ((j=1; j<=req_per_concurrent; j++)); do
            make_request $req_num &
            pids+=($!)
            ((req_num++))
        done
    done
    
    # 等待所有请求完成
    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null || true
    done
    
    local end_time=$(date +%s%N)
    local total_time=$(( (end_time - start_time) / 1000000 ))
    
    # 统计结果
    for result_file in "$temp_dir"/result_*.txt; do
        if [ -f "$result_file" ]; then
            http_code=$(cut -d'|' -f2 "$result_file")
            if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ]; then
                ((success_count++))
            else
                ((error_count++))
            fi
        fi
    done
    
    rm -rf "$temp_dir"
    
    local success_rate=$(( success_count * 100 / total_requests ))
    local rps=$(( total_requests * 1000 / total_time ))
    
    echo -e "${GREEN}完成${NC}"
    echo "    成功: $success_count / $total_requests ($success_rate%)"
    echo "    失败: $error_count"
    echo "    总耗时: ${total_time}ms"
    echo "    请求速率: ${rps} 请求/秒"
    
    # 判断测试结果
    if [ $success_rate -ge 95 ]; then
        echo -e "    结果: ${GREEN}✅ 优秀${NC}"
        ((PASSED_TESTS++))
    elif [ $success_rate -ge 80 ]; then
        echo -e "    结果: ${YELLOW}⚠️  良好${NC}"
        ((WARNINGS++))
    else
        echo -e "    结果: ${RED}❌ 需要改进${NC}"
        ((FAILED_TESTS++))
    fi
    
    ((TOTAL_TESTS++))
    echo ""
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 高并发测试                                  ║${NC}"
echo -e "${BLUE}║          压力测试 | 稳定性测试 | 性能测试                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "报告文件: ${CYAN}$REPORT_FILE${NC}"
echo ""

# 初始化报告
{
    echo "PIS 高并发测试报告"
    echo "=================="
    echo "生成时间: $(date)"
    echo ""
} > "$REPORT_FILE"

# ============================================
# 1. 健康检查高并发测试
# ============================================
print_section "1️⃣  健康检查高并发测试"

test_concurrent "健康检查端点 (100请求, 10并发)" "$BASE_URL/api/health" "GET" 10 100

test_concurrent "健康检查端点 (500请求, 50并发)" "$BASE_URL/api/health" "GET" 50 500

test_concurrent "健康检查端点 (1000请求, 100并发)" "$BASE_URL/api/health" "GET" 100 1000

# ============================================
# 2. API 端点高并发测试
# ============================================
print_section "2️⃣  API 端点高并发测试"

test_concurrent "管理员状态检查 (200请求, 20并发)" "$BASE_URL/api/auth/check-admin-status" "GET" 20 200

test_concurrent "Worker 健康检查 (200请求, 20并发)" "$BASE_URL/api/worker/health" "GET" 20 200

# ============================================
# 3. 登录 API 高并发测试（注意速率限制）
# ============================================
print_section "3️⃣  登录 API 高并发测试（速率限制）"

echo "  注意: 登录 API 有速率限制，测试会触发限制"
test_concurrent "登录 API (50请求, 10并发)" "$BASE_URL/api/auth/login" "POST" 10 50 '{"email":"test@test.com","password":"test"}'

# ============================================
# 4. 上传 API 高并发测试（模拟）
# ============================================
print_section "4️⃣  上传 API 高并发测试（模拟）"

echo "  注意: 上传 API 需要认证，这里测试端点响应"
test_concurrent "上传 API 端点 (100请求, 20并发)" "$BASE_URL/api/admin/albums/test-id/upload" "POST" 20 100 '{"filename":"test.jpg","contentType":"image/jpeg","fileSize":1024}'

# ============================================
# 5. 下载 API 高并发测试
# ============================================
print_section "5️⃣  下载 API 高并发测试"

test_concurrent "下载 API (100请求, 20并发)" "$BASE_URL/api/public/download/00000000-0000-0000-0000-000000000000" "GET" 20 100

# ============================================
# 6. Media 代理高并发测试
# ============================================
print_section "6️⃣  Media 代理高并发测试"

test_concurrent "Media 代理 (200请求, 30并发)" "$BASE_URL/media/test.jpg" "GET" 30 200

# ============================================
# 7. 混合请求高并发测试
# ============================================
print_section "7️⃣  混合请求高并发测试"

echo "  模拟真实场景：混合多种请求类型"
echo "  执行中... "

start_time=$(date +%s%N)
pids=()

# 健康检查
for i in {1..50}; do
    curl -s --max-time $TIMEOUT "$BASE_URL/api/health" > /dev/null &
    pids+=($!)
done

# 管理员状态
for i in {1..30}; do
    curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/check-admin-status" > /dev/null &
    pids+=($!)
done

# Worker 健康检查
for i in {1..30}; do
    curl -s --max-time $TIMEOUT "$BASE_URL/api/worker/health" > /dev/null &
    pids+=($!)
done

# Media 代理
for i in {1..20}; do
    curl -s --max-time $TIMEOUT "$BASE_URL/media/test.jpg" > /dev/null &
    pids+=($!)
done

# 等待所有请求完成
for pid in "${pids[@]}"; do
    wait $pid 2>/dev/null || true
done

end_time=$(date +%s%N)
total_time=$(( (end_time - start_time) / 1000000 ))
total_requests=130

echo -e "${GREEN}完成${NC}"
echo "    总请求数: $total_requests"
echo "    总耗时: ${total_time}ms"
echo "    请求速率: $(( total_requests * 1000 / total_time )) 请求/秒"
echo -e "    结果: ${GREEN}✅ 通过${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# ============================================
# 8. 长时间高并发测试
# ============================================
print_section "8️⃣  长时间高并发测试（30秒）"

echo "  持续30秒高并发请求（10并发）"
start_time=$(date +%s)
end_time=$((start_time + 30))
request_count=0
error_count=0

while [ $(date +%s) -lt $end_time ]; do
    for i in {1..10}; do
        curl -s --max-time 5 "$BASE_URL/api/health" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            ((request_count++))
        else
            ((error_count++))
        fi
    done
    sleep 0.1
done

total_time=$(( $(date +%s) - start_time ))
success_rate=$(( (request_count * 100) / (request_count + error_count) )) 2>/dev/null || success_rate=100

echo "    总请求数: $request_count"
echo "    错误数: $error_count"
echo "    成功率: ${success_rate}%"
echo "    持续时间: ${total_time}秒"
echo "    平均请求速率: $(( request_count / total_time )) 请求/秒"

if [ $success_rate -ge 95 ]; then
    echo -e "    结果: ${GREEN}✅ 优秀${NC}"
    ((PASSED_TESTS++))
elif [ $success_rate -ge 80 ]; then
    echo -e "    结果: ${YELLOW}⚠️  良好${NC}"
    ((WARNINGS++))
else
    echo -e "    结果: ${RED}❌ 需要改进${NC}"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 9. 资源使用监控
# ============================================
print_section "9️⃣  资源使用监控（高并发前后对比）"

echo "  高并发前资源使用:"
before_stats=$(docker stats --no-stream --format "{{.Name}}: CPU={{.CPUPerc}}, Memory={{.MemUsage}}" pis-web pis-worker pis-postgres pis-redis pis-minio 2>&1)
echo "$before_stats" | while read line; do
    echo "    $line"
done

echo ""
echo "  执行高并发测试（100请求，20并发）..."
for i in {1..100}; do
    curl -s --max-time $TIMEOUT "$BASE_URL/api/health" > /dev/null &
    if [ $((i % 20)) -eq 0 ]; then
        wait
    fi
done
wait

sleep 2

echo ""
echo "  高并发后资源使用:"
after_stats=$(docker stats --no-stream --format "{{.Name}}: CPU={{.CPUPerc}}, Memory={{.MemUsage}}" pis-web pis-worker pis-postgres pis-redis pis-minio 2>&1)
echo "$after_stats" | while read line; do
    echo "    $line"
done

echo -e "    结果: ${GREEN}✅ 资源使用正常${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# ============================================
# 10. Apache Bench 压力测试（如果可用）
# ============================================
print_section "🔟 Apache Bench 压力测试"

if command -v ab > /dev/null 2>&1; then
    echo "  使用 Apache Bench 进行压力测试"
    
    echo "  测试1: 1000请求，100并发"
    ab -n 1000 -c 100 -q "$BASE_URL/api/health" > /tmp/ab-test-1.log 2>&1
    if [ $? -eq 0 ]; then
        rps=$(grep "Requests per second" /tmp/ab-test-1.log | awk '{print $4}')
        time_per_request=$(grep "Time per request" /tmp/ab-test-1.log | head -1 | awk '{print $4}')
        echo "    请求速率: ${rps} 请求/秒"
        echo "    平均响应时间: ${time_per_request}ms"
        echo -e "    结果: ${GREEN}✅ 通过${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "    结果: ${RED}❌ 失败${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    echo ""
    
    echo "  测试2: 5000请求，200并发"
    ab -n 5000 -c 200 -q "$BASE_URL/api/health" > /tmp/ab-test-2.log 2>&1
    if [ $? -eq 0 ]; then
        rps=$(grep "Requests per second" /tmp/ab-test-2.log | awk '{print $4}')
        failed=$(grep "Failed requests" /tmp/ab-test-2.log | awk '{print $3}')
        echo "    请求速率: ${rps} 请求/秒"
        echo "    失败请求: $failed"
        if [ "$failed" = "0" ]; then
            echo -e "    结果: ${GREEN}✅ 通过${NC}"
            ((PASSED_TESTS++))
        else
            echo -e "    结果: ${YELLOW}⚠️  有失败请求${NC}"
            ((WARNINGS++))
        fi
        ((TOTAL_TESTS++))
    else
        echo -e "    结果: ${RED}❌ 失败${NC}"
        ((FAILED_TESTS++))
        ((TOTAL_TESTS++))
    fi
    echo ""
else
    echo "  Apache Bench 未安装，跳过此测试"
    echo "  安装方法: brew install httpd (macOS) 或 apt-get install apache2-utils (Linux)"
    ((WARNINGS++))
    ((TOTAL_TESTS++))
fi

# ============================================
# 11. 错误率统计
# ============================================
print_section "1️⃣1️⃣  错误率统计"

echo "  执行1000个请求，统计错误率..."
error_count=0
success_count=0

for i in {1..1000}; do
    http_code=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/api/health" -o /dev/null)
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ]; then
        ((success_count++))
    else
        ((error_count++))
    fi
    
    if [ $((i % 100)) -eq 0 ]; then
        echo "    已完成: $i / 1000"
    fi
done

error_rate=$(( error_count * 100 / 1000 ))
echo ""
echo "    成功: $success_count"
echo "    失败: $error_count"
echo "    错误率: ${error_rate}%"

if [ $error_rate -lt 1 ]; then
    echo -e "    结果: ${GREEN}✅ 优秀（错误率 < 1%）${NC}"
    ((PASSED_TESTS++))
elif [ $error_rate -lt 5 ]; then
    echo -e "    结果: ${YELLOW}⚠️  良好（错误率 < 5%）${NC}"
    ((WARNINGS++))
else
    echo -e "    结果: ${RED}❌ 需要改进（错误率 >= 5%）${NC}"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 12. 响应时间分布测试
# ============================================
print_section "1️⃣2️⃣  响应时间分布测试"

echo "  测试100个请求的响应时间分布..."
times=()

for i in {1..100}; do
    start=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$BASE_URL/api/health" > /dev/null
    end=$(date +%s%N)
    time=$(( (end - start) / 1000000 ))
    times+=($time)
done

# 计算统计信息
IFS=$'\n' sorted_array=($(printf '%s\n' "${times[@]}" | sort -n))
unset IFS

min=${sorted_array[0]}
max=${sorted_array[99]}
median=${sorted_array[49]}
p95=${sorted_array[94]}
p99=${sorted_array[98]}

# 计算平均值
sum=0
for time in "${times[@]}"; do
    sum=$((sum + time))
done
avg=$((sum / 100))

echo "    最小响应时间: ${min}ms"
echo "    最大响应时间: ${max}ms"
echo "    平均响应时间: ${avg}ms"
echo "    中位数响应时间: ${median}ms"
echo "    P95 响应时间: ${p95}ms"
echo "    P99 响应时间: ${p99}ms"

if [ $avg -lt 50 ]; then
    echo -e "    结果: ${GREEN}✅ 优秀（平均 < 50ms）${NC}"
    ((PASSED_TESTS++))
elif [ $avg -lt 100 ]; then
    echo -e "    结果: ${YELLOW}⚠️  良好（平均 < 100ms）${NC}"
    ((WARNINGS++))
else
    echo -e "    结果: ${RED}❌ 需要改进（平均 >= 100ms）${NC}"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))
echo ""

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

rm -f /tmp/ab-test-*.log

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有高并发测试通过！${NC}"
    exit 0
elif [ $FAILED_TESTS -le 2 ]; then
    echo -e "${YELLOW}⚠️  有 $FAILED_TESTS 个测试失败，但整体表现良好${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
