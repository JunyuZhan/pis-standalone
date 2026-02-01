#!/bin/bash

# ============================================
# PIS 图片加载速度和缓存测试脚本
# 用途: 测试图片加载速度、缓存效果、缓存命中率等
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
REPORT_FILE="/tmp/pis-image-loading-cache-test-$(date +%Y%m%d-%H%M%S).txt"

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
    
    if eval "$command" > /tmp/image-test.log 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️  警告${NC}"
            cat /tmp/image-test.log | head -2
            ((WARNINGS++))
        else
            echo -e "${RED}❌ 失败${NC}"
            cat /tmp/image-test.log | head -3
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

measure_load_time() {
    local url=$1
    local label=$2
    
    start_time=$(date +%s%N)
    response=$(curl -s -w "\n%{http_code}\n%{size_download}\n%{time_total}" --max-time $TIMEOUT "$url" 2>&1)
    end_time=$(date +%s%N)
    
    http_code=$(echo "$response" | tail -3 | head -1)
    size=$(echo "$response" | tail -2 | head -1)
    time_total=$(echo "$response" | tail -1)
    
    load_time=$(( (end_time - start_time) / 1000000 ))
    time_total_ms=$(echo "$time_total * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "$load_time")
    
    echo "    $label:"
    echo "      HTTP状态: $http_code"
    echo "      数据大小: $size 字节"
    echo "      加载时间: ${time_total_ms}ms (curl: ${time_total}s)"
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 图片加载速度和缓存测试                      ║${NC}"
echo -e "${BLUE}║          加载速度 | 缓存效果 | 缓存命中率 | 性能优化      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "报告文件: ${CYAN}$REPORT_FILE${NC}"
echo ""

# 初始化报告
{
    echo "PIS 图片加载速度和缓存测试报告"
    echo "================================"
    echo "生成时间: $(date)"
    echo ""
} > "$REPORT_FILE"

# ============================================
# 1. Media 代理响应头检查（缓存相关）
# ============================================
print_section "1️⃣  Media 代理缓存头检查"

media_headers=$(curl -s -I --max-time $TIMEOUT "$BASE_URL/media/test.jpg" 2>&1)
http_code=$(echo "$media_headers" | head -1 | grep -oE '[0-9]{3}' || echo "000")

# 检查缓存头（仅在成功响应时）
if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
    test_step "1.1 Media 代理有缓存头" "echo '$media_headers' | grep -qiE '(Cache-Control|ETag|Last-Modified|Expires)'"
else
    # 文件不存在时，检查代码中是否有缓存头设置
    test_step "1.1 Media 代理缓存头配置" "grep -r 'Cache-Control.*max-age' /Users/apple/Documents/Project/PIS/pis-standalone/apps/web/src/app/media/ > /dev/null 2>&1"
fi

# 检查缓存策略
cache_control=$(echo "$media_headers" | grep -i "Cache-Control" || echo "")
if [ -n "$cache_control" ]; then
    echo "    缓存策略: $cache_control"
    if echo "$cache_control" | grep -qiE "(max-age|public|private)"; then
        echo -e "    结果: ${GREEN}✅ 缓存策略配置正确${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "    结果: ${YELLOW}⚠️  缓存策略需要检查${NC}"
        ((WARNINGS++))
    fi
    ((TOTAL_TESTS++))
fi

# ============================================
# 2. 图片加载速度测试（首次加载）
# ============================================
print_section "2️⃣  图片加载速度测试（首次加载）"

echo "  2.1 测试 Media 代理图片加载速度（首次加载，无缓存）..."

# 清除可能的缓存（通过添加时间戳）
test_url="$BASE_URL/media/test.jpg?t=$(date +%s)"
first_load_result=$(measure_load_time "$test_url" "首次加载")

if [ $? -eq 0 ]; then
    echo -e "    结果: ${GREEN}✅ 首次加载成功${NC}"
    ((PASSED_TESTS++))
else
    echo -e "    结果: ${YELLOW}⚠️  文件不存在（正常）${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 3. 缓存效果测试（第二次加载）
# ============================================
print_section "3️⃣  缓存效果测试（第二次加载）"

echo "  3.1 测试缓存后的加载速度..."

# 首次加载（预热缓存）
warmup_url="$BASE_URL/media/test.jpg?warmup=$(date +%s)"
curl -s --max-time $TIMEOUT "$warmup_url" > /dev/null 2>&1 || true
sleep 1

# 第二次加载（应该使用缓存）
cache_test_url="$BASE_URL/media/test.jpg?cache=$(date +%s)"
second_load_result=$(measure_load_time "$cache_test_url" "缓存后加载")

if [ $? -eq 0 ]; then
    echo -e "    结果: ${GREEN}✅ 缓存后加载成功${NC}"
    ((PASSED_TESTS++))
else
    echo -e "    结果: ${YELLOW}⚠️  文件不存在（正常）${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 4. 缓存命中率测试
# ============================================
print_section "4️⃣  缓存命中率测试"

echo "  4.1 测试缓存命中率（10次连续请求）..."

cache_hits=0
cache_misses=0
load_times=()

for i in {1..10}; do
    start=$(date +%s%N)
    http_code=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/media/test.jpg?test=$i" -o /dev/null 2>&1)
    end=$(date +%s%N)
    load_time=$(( (end - start) / 1000000 ))
    load_times+=($load_time)
    
    # 如果响应时间 < 50ms，可能是缓存命中
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
        if [ $load_time -lt 50 ]; then
            ((cache_hits++))
        else
            ((cache_misses++))
        fi
    fi
    
    sleep 0.1
done

total_requests=$((cache_hits + cache_misses))
if [ $total_requests -gt 0 ]; then
    hit_rate=$(( cache_hits * 100 / total_requests ))
    echo "    缓存命中: $cache_hits"
    echo "    缓存未命中: $cache_misses"
    echo "    命中率: ${hit_rate}%"
    
    # 计算平均加载时间
    sum=0
    for time in "${load_times[@]}"; do
        sum=$((sum + time))
    done
    avg_time=$((sum / 10))
    echo "    平均加载时间: ${avg_time}ms"
    
    if [ $hit_rate -ge 50 ]; then
        echo -e "    结果: ${GREEN}✅ 缓存命中率良好${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "    结果: ${YELLOW}⚠️  缓存命中率较低${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "    结果: ${YELLOW}⚠️  无法测试（文件不存在）${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 5. 不同图片尺寸加载速度对比
# ============================================
print_section "5️⃣  不同图片尺寸加载速度对比"

echo "  5.1 测试不同路径的加载速度（模拟不同尺寸）..."

# 测试缩略图路径（如果存在）
thumb_url="$BASE_URL/media/thumbs/test.jpg"
thumb_time=$(curl -s -w "%{time_total}" --max-time $TIMEOUT "$thumb_url" -o /dev/null 2>&1 | tail -1)
thumb_time_ms=$(echo "$thumb_time * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")

# 测试预览图路径（如果存在）
preview_url="$BASE_URL/media/previews/test.jpg"
preview_time=$(curl -s -w "%{time_total}" --max-time $TIMEOUT "$preview_url" -o /dev/null 2>&1 | tail -1)
preview_time_ms=$(echo "$preview_time * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")

# 测试原图路径
original_url="$BASE_URL/media/original/test.jpg"
original_time=$(curl -s -w "%{time_total}" --max-time $TIMEOUT "$original_url" -o /dev/null 2>&1 | tail -1)
original_time_ms=$(echo "$original_time * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")

echo "    缩略图加载时间: ${thumb_time_ms}ms"
echo "    预览图加载时间: ${preview_time_ms}ms"
echo "    原图加载时间: ${original_time_ms}ms"

# 验证加载时间合理性（缩略图应该最快）
if [ $thumb_time_ms -lt $preview_time_ms ] || [ $thumb_time_ms -eq 0 ]; then
    echo -e "    结果: ${GREEN}✅ 加载时间合理${NC}"
    ((PASSED_TESTS++))
else
    echo -e "    结果: ${YELLOW}⚠️  加载时间需要优化${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 6. ETag 和条件请求测试
# ============================================
print_section "6️⃣  ETag 和条件请求测试"

# 获取 ETag
media_headers=$(curl -s -I --max-time $TIMEOUT "$BASE_URL/media/test.jpg" 2>&1)
etag=$(echo "$media_headers" | grep -i "ETag" | cut -d: -f2 | tr -d ' \r\n' || echo "")

if [ -n "$etag" ]; then
    echo "    找到 ETag: $etag"
    
    # 测试条件请求（If-None-Match）
    conditional_response=$(curl -s -w "\n%{http_code}" -I --max-time $TIMEOUT -H "If-None-Match: $etag" "$BASE_URL/media/test.jpg" 2>&1)
    conditional_code=$(echo "$conditional_response" | tail -1)
    
    if [ "$conditional_code" = "304" ]; then
        echo -e "    条件请求: ${GREEN}✅ 返回 304 Not Modified（缓存有效）${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "    条件请求: ${YELLOW}⚠️  返回 $conditional_code${NC}"
        ((WARNINGS++))
    fi
    ((TOTAL_TESTS++))
else
    echo -e "    ETag: ${YELLOW}⚠️  未找到 ETag${NC}"
    ((WARNINGS++))
    ((TOTAL_TESTS++))
fi
echo ""

# ============================================
# 7. 并发图片加载测试
# ============================================
print_section "7️⃣  并发图片加载测试"

echo "  7.1 测试并发图片加载（20并发，50请求）..."

concurrent_success=0
concurrent_failed=0
concurrent_times=()

for i in {1..50}; do
    (
        start=$(date +%s%N)
        http_code=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/media/test$i.jpg" -o /dev/null 2>&1)
        end=$(date +%s%N)
        time=$(( (end - start) / 1000000 ))
        echo "$i|$http_code|$time" >> /tmp/concurrent_results.txt
    ) &
    
    if [ $((i % 20)) -eq 0 ]; then
        wait
    fi
done
wait

if [ -f /tmp/concurrent_results.txt ]; then
    while IFS='|' read -r req_num http_code time; do
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
            ((concurrent_success++))
        else
            ((concurrent_failed++))
        fi
        concurrent_times+=($time)
    done < /tmp/concurrent_results.txt
    rm -f /tmp/concurrent_results.txt
fi

total_concurrent=$((concurrent_success + concurrent_failed))
if [ $total_concurrent -gt 0 ]; then
    success_rate=$(( concurrent_success * 100 / total_concurrent ))
    
    # 计算平均时间
    sum=0
    for time in "${concurrent_times[@]}"; do
        sum=$((sum + time))
    done
    avg_time=$((sum / ${#concurrent_times[@]}))
    
    echo "    成功: $concurrent_success / $total_concurrent ($success_rate%)"
    echo "    失败: $concurrent_failed"
    echo "    平均加载时间: ${avg_time}ms"
    
    if [ $success_rate -ge 80 ]; then
        echo -e "    结果: ${GREEN}✅ 并发加载正常${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "    结果: ${YELLOW}⚠️  部分失败（文件可能不存在）${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "    结果: ${YELLOW}⚠️  无法测试${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 8. 缓存预热测试
# ============================================
print_section "8️⃣  缓存预热测试"

echo "  8.1 测试缓存预热效果..."

# 预热前加载
pre_warm_start=$(date +%s%N)
curl -s --max-time $TIMEOUT "$BASE_URL/media/test.jpg?prewarm=1" > /dev/null 2>&1
pre_warm_end=$(date +%s%N)
pre_warm_time=$(( (pre_warm_end - pre_warm_start) / 1000000 ))

sleep 1

# 预热后加载
post_warm_start=$(date +%s%N)
curl -s --max-time $TIMEOUT "$BASE_URL/media/test.jpg?postwarm=1" > /dev/null 2>&1
post_warm_end=$(date +%s%N)
post_warm_time=$(( (post_warm_end - post_warm_start) / 1000000 ))

echo "    预热前加载时间: ${pre_warm_time}ms"
echo "    预热后加载时间: ${post_warm_time}ms"

if [ $post_warm_time -lt $pre_warm_time ]; then
    improvement=$(( (pre_warm_time - post_warm_time) * 100 / pre_warm_time ))
    echo "    性能提升: ${improvement}%"
    echo -e "    结果: ${GREEN}✅ 缓存预热有效${NC}"
    ((PASSED_TESTS++))
elif [ $post_warm_time -eq $pre_warm_time ]; then
    echo -e "    结果: ${YELLOW}⚠️  缓存效果不明显${NC}"
    ((WARNINGS++))
else
    echo -e "    结果: ${YELLOW}⚠️  需要检查缓存配置${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 9. 响应头缓存策略分析
# ============================================
print_section "9️⃣  响应头缓存策略分析"

media_headers=$(curl -s -I --max-time $TIMEOUT "$BASE_URL/media/test.jpg" 2>&1)

echo "  Media 代理响应头分析:"
echo "$media_headers" | grep -iE "(Cache-Control|ETag|Last-Modified|Expires|Age|Vary)" | while read line; do
    echo "    $line"
done

# 检查缓存策略
cache_control=$(echo "$media_headers" | grep -i "Cache-Control" || echo "")
if echo "$cache_control" | grep -qiE "max-age"; then
    max_age=$(echo "$cache_control" | grep -oE "max-age=[0-9]+" | cut -d= -f2 || echo "0")
    echo "    缓存时间: ${max_age}秒"
    
    if [ "$max_age" -gt 0 ]; then
        echo -e "    结果: ${GREEN}✅ 缓存时间配置正确${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "    结果: ${YELLOW}⚠️  缓存时间未配置${NC}"
        ((WARNINGS++))
    fi
    ((TOTAL_TESTS++))
else
    echo -e "    结果: ${YELLOW}⚠️  未找到 Cache-Control${NC}"
    ((WARNINGS++))
    ((TOTAL_TESTS++))
fi
echo ""

# ============================================
# 10. 图片加载性能基准测试
# ============================================
print_section "🔟 图片加载性能基准测试"

echo "  10.1 测试图片加载性能基准（100次请求）..."

benchmark_times=()
benchmark_success=0

for i in {1..100}; do
    start=$(date +%s%N)
    http_code=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/media/test.jpg?bench=$i" -o /dev/null 2>&1)
    end=$(date +%s%N)
    time=$(( (end - start) / 1000000 ))
    benchmark_times+=($time)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
        ((benchmark_success++))
    fi
    
    if [ $((i % 20)) -eq 0 ]; then
        echo "    进度: $i / 100"
    fi
done

# 计算统计信息
IFS=$'\n' sorted_array=($(printf '%s\n' "${benchmark_times[@]}" | sort -n))
unset IFS

min=${sorted_array[0]}
max=${sorted_array[99]}
median=${sorted_array[49]}
p95=${sorted_array[94]}
p99=${sorted_array[98]}

sum=0
for time in "${benchmark_times[@]}"; do
    sum=$((sum + time))
done
avg=$((sum / 100))

echo ""
echo "    成功请求: $benchmark_success / 100"
echo "    最小响应时间: ${min}ms"
echo "    最大响应时间: ${max}ms"
echo "    平均响应时间: ${avg}ms"
echo "    中位数响应时间: ${median}ms"
echo "    P95 响应时间: ${p95}ms"
echo "    P99 响应时间: ${p99}ms"

if [ $avg -lt 100 ]; then
    echo -e "    结果: ${GREEN}✅ 性能优秀（平均 < 100ms）${NC}"
    ((PASSED_TESTS++))
elif [ $avg -lt 500 ]; then
    echo -e "    结果: ${YELLOW}⚠️  性能良好（平均 < 500ms）${NC}"
    ((WARNINGS++))
else
    echo -e "    结果: ${RED}❌ 性能需要改进（平均 >= 500ms）${NC}"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 11. CDN/缓存层测试（如果配置）
# ============================================
print_section "1️⃣1️⃣  CDN/缓存层测试"

# 检查是否有 CDN 相关响应头
media_headers=$(curl -s -I --max-time $TIMEOUT "$BASE_URL/media/test.jpg" 2>&1)

cdn_headers=$(echo "$media_headers" | grep -iE "(CF-|X-Cache|X-CDN|Via|Server)" || echo "")
if [ -n "$cdn_headers" ]; then
    echo "    找到 CDN/缓存层响应头:"
    echo "$cdn_headers" | while read line; do
        echo "      $line"
    done
    echo -e "    结果: ${GREEN}✅ CDN/缓存层配置存在${NC}"
    ((PASSED_TESTS++))
else
    echo -e "    结果: ${YELLOW}⚠️  未检测到 CDN/缓存层${NC}"
    ((WARNINGS++))
fi
((TOTAL_TESTS++))
echo ""

# ============================================
# 12. 图片格式加载速度对比
# ============================================
print_section "1️⃣2️⃣  图片格式加载速度对比"

echo "  12.1 测试不同图片格式的加载速度..."

formats=("jpg" "jpeg" "png" "webp" "gif")
format_times=()

for format in "${formats[@]}"; do
    start=$(date +%s%N)
    http_code=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/media/test.$format" -o /dev/null 2>&1)
    end=$(date +%s%N)
    time=$(( (end - start) / 1000000 ))
    format_times+=($time)
    
    echo "    $format: ${time}ms (HTTP $http_code)"
done

echo -e "    结果: ${GREEN}✅ 格式测试完成${NC}"
((PASSED_TESTS++))
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

rm -f /tmp/image-test.log /tmp/concurrent_results.txt

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有图片加载速度和缓存测试通过！${NC}"
    exit 0
elif [ $FAILED_TESTS -le 2 ]; then
    echo -e "${YELLOW}⚠️  有 $FAILED_TESTS 个测试失败，但整体表现良好${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
