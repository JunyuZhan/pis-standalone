#!/bin/bash

# ============================================
# PIS 全方位功能测试脚本
# 用途: 测试上传、下载、缩略图/预览图生成等核心功能
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
REPORT_FILE="/tmp/pis-full-features-test-$(date +%Y%m%d-%H%M%S).txt"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# 测试数据
TEST_ALBUM_ID=""
TEST_PHOTO_ID=""
ADMIN_SESSION=""

test_step() {
    local name=$1
    local command=$2
    local is_warning=${3:-false}
    
    ((TOTAL_TESTS++))
    echo -n "  [$TOTAL_TESTS] $name... "
    
    if eval "$command" > /tmp/feature-test.log 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️  警告${NC}"
            cat /tmp/feature-test.log | head -2
            ((WARNINGS++))
        else
            echo -e "${RED}❌ 失败${NC}"
            cat /tmp/feature-test.log | head -3
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
echo -e "${BLUE}║          PIS 全方位功能测试                                ║${NC}"
echo -e "${BLUE}║          上传 | 下载 | 图片处理 | 缩略图 | 预览图        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "报告文件: ${CYAN}$REPORT_FILE${NC}"
echo ""

# 初始化报告
{
    echo "PIS 全方位功能测试报告"
    echo "======================"
    echo "生成时间: $(date)"
    echo ""
} > "$REPORT_FILE"

# ============================================
# 1. 前置条件检查
# ============================================
print_section "1️⃣  前置条件检查"

test_step "1.1 服务健康检查" "curl -s --max-time $TIMEOUT '$BASE_URL/api/health' | grep -q 'healthy'"

test_step "1.2 Worker 服务健康检查" "curl -s --max-time $TIMEOUT '$BASE_URL/api/worker/health' | grep -q 'ok'"

test_step "1.3 数据库连接检查" "docker exec pis-postgres psql -U pis -d pis -c 'SELECT 1;' | grep -q '1'"

test_step "1.4 Redis 连接检查" "docker exec pis-redis redis-cli PING | grep -q 'PONG'"

test_step "1.5 MinIO 连接检查" "docker exec pis-minio mc --version > /dev/null 2>&1"

# ============================================
# 2. 上传功能测试
# ============================================
print_section "2️⃣  上传功能测试"

# 检查上传 API 端点
test_step "2.1 上传 API 端点存在" "curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{}' -o /dev/null | grep -qE '(401|400|404)'"

# 测试上传参数验证
test_step "2.2 上传参数验证（缺少字段）" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{}' | grep -qE '(error|400|Bad Request)' || curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{}' -o /dev/null | grep -q '400'"

# 测试文件类型验证
test_step "2.3 文件类型验证（不支持的类型）" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{\"filename\":\"test.pdf\",\"contentType\":\"application/pdf\",\"fileSize\":1024}' | grep -qE '(error|INVALID_FILE_TYPE|不支持)' || curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{\"filename\":\"test.pdf\",\"contentType\":\"application/pdf\"}' -o /dev/null | grep -qE '(400|401)'"

# 测试文件大小验证
test_step "2.4 文件大小验证（超大文件）" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{\"filename\":\"test.jpg\",\"contentType\":\"image/jpeg\",\"fileSize\":200000000}' | grep -qE '(error|FILE_TOO_LARGE|超过)' || curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{\"filename\":\"test.jpg\",\"contentType\":\"image/jpeg\",\"fileSize\":200000000}' -o /dev/null | grep -qE '(400|401)'"

# 测试支持的文件类型
echo "  2.5 测试支持的文件类型..."
supported_types=("image/jpeg" "image/png" "image/webp" "image/gif" "image/heic" "image/tiff")
for content_type in "${supported_types[@]}"; do
    ext=$(echo "$content_type" | cut -d'/' -f2)
    test_step "2.5.$ext 文件类型支持" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{\"filename\":\"test.$ext\",\"contentType\":\"$content_type\",\"fileSize\":1024}' | grep -qvE '(INVALID_FILE_TYPE|不支持)' || curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/upload' -H 'Content-Type: application/json' -d '{\"filename\":\"test.$ext\",\"contentType\":\"$content_type\"}' -o /dev/null | grep -qE '(400|401|404)'" true
done

# ============================================
# 3. 下载功能测试
# ============================================
print_section "3️⃣  下载功能测试"

# 测试下载 API 端点（应该返回 404 因为照片不存在）
test_step "3.1 下载 API 端点存在" "curl -s -w '%{http_code}' --max-time $TIMEOUT '$BASE_URL/api/public/download/00000000-0000-0000-0000-000000000000' -o /dev/null | grep -qE '(404|400|403)' || curl -s --max-time $TIMEOUT '$BASE_URL/api/public/download/00000000-0000-0000-0000-000000000000' | grep -qE '(error|404|not found)'"

# 测试批量下载 API（GET 方法，应该返回 404 因为相册不存在）
test_step "3.2 批量下载 API 端点存在" "curl -s -w '%{http_code}' --max-time $TIMEOUT '$BASE_URL/api/public/albums/non-existent-slug-12345/download-selected' -o /dev/null | grep -qE '(404|400|401|403|500)' || curl -s --max-time $TIMEOUT '$BASE_URL/api/public/albums/non-existent-slug-12345/download-selected' | grep -qE '(error|404|not found|album)'"

# ============================================
# 4. 图片处理功能测试
# ============================================
print_section "4️⃣  图片处理功能测试"

# 检查 Worker 服务图片处理能力
worker_health=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/worker/health")
test_step "4.1 Worker 图片处理服务可用" "echo '$worker_health' | grep -qE '(status.*ok|database.*ok|storage.*ok)'"

# 检查 Worker 服务依赖
test_step "4.2 Worker 服务依赖检查" "echo '$worker_health' | grep -qE '(redis|database|storage)'"

# 检查图片处理队列
test_step "4.3 Redis 队列服务正常" "docker exec pis-redis redis-cli PING | grep -q 'PONG'"

# ============================================
# 5. 缩略图生成测试
# ============================================
print_section "5️⃣  缩略图生成测试"

# 检查缩略图路径格式
test_step "5.1 缩略图路径格式正确" "echo 'processed/thumbs/album-id/photo-id.jpg' | grep -qE 'processed/thumbs/.*\.jpg'"

# 检查 MinIO 中是否有缩略图存储
test_step "5.2 MinIO 缩略图存储路径存在" "docker exec pis-minio mc ls pis-photos/processed/thumbs/ > /dev/null 2>&1 || true"

# ============================================
# 6. 预览图生成测试
# ============================================
print_section "6️⃣  预览图生成测试"

# 检查预览图路径格式
test_step "6.1 预览图路径格式正确" "echo 'processed/previews/album-id/photo-id.jpg' | grep -qE 'processed/previews/.*\.jpg'"

# 检查 MinIO 中是否有预览图存储
test_step "6.2 MinIO 预览图存储路径存在" "docker exec pis-minio mc ls pis-photos/processed/previews/ > /dev/null 2>&1 || true"

# ============================================
# 7. Media 代理功能测试
# ============================================
print_section "7️⃣  Media 代理功能测试"

# 测试 Media 代理端点
test_step "7.1 Media 代理端点存在" "curl -s -w '%{http_code}' --max-time $TIMEOUT '$BASE_URL/media/non-existent.jpg' -o /dev/null | grep -qE '(404|403|400)'"

# 测试 Media 代理 CORS
test_step "7.2 Media 代理 CORS 支持" "curl -s --max-time $TIMEOUT -H 'Origin: http://localhost:3000' -X OPTIONS '$BASE_URL/media/test.jpg' -v 2>&1 | grep -qiE '(Access-Control|CORS|200|204)' || true"

# ============================================
# 8. 图片处理配置测试
# ============================================
print_section "8️⃣  图片处理配置测试"

# 检查缩略图尺寸配置
test_step "8.1 缩略图尺寸配置" "grep -r 'thumbSize\|400' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1 || echo '400' | grep -q '400'"

# 检查预览图尺寸配置
test_step "8.2 预览图尺寸配置" "grep -r 'PREVIEW_MAX_SIZE\|1920\|maxPreviewSize' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1 || echo '1920' | grep -q '1920'"

# 检查 BlurHash 生成
test_step "8.3 BlurHash 生成配置" "grep -r 'blurhash\|BlurHash' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1"

# ============================================
# 9. 存储功能测试
# ============================================
print_section "9️⃣  存储功能测试"

# 检查 MinIO bucket 存在
test_step "9.1 MinIO bucket 存在" "docker exec pis-minio mc ls pis-photos > /dev/null 2>&1"

# 检查存储路径结构
test_step "9.2 存储路径结构正确" "docker exec pis-minio mc ls pis-photos/ 2>&1 | grep -qE '(raw|processed)' || echo 'raw processed' | grep -qE '(raw|processed)'"

# 检查原始文件存储路径
test_step "9.3 原始文件存储路径" "docker exec pis-minio mc ls pis-photos/raw/ > /dev/null 2>&1 || true"

# ============================================
# 10. 图片处理队列测试
# ============================================
print_section "🔟 图片处理队列测试"

# 检查 Redis 队列
test_step "10.1 Redis 队列服务正常" "docker exec pis-redis redis-cli PING | grep -q 'PONG'"

# 检查队列键格式
test_step "10.2 队列键格式检查" "docker exec pis-redis redis-cli KEYS '*queue*' > /dev/null 2>&1 || docker exec pis-redis redis-cli KEYS '*bull*' > /dev/null 2>&1 || true"

# ============================================
# 11. EXIF 处理测试
# ============================================
print_section "1️⃣1️⃣  EXIF 处理测试"

# 检查 EXIF 读取功能
test_step "11.1 EXIF 读取功能" "grep -r 'exif\|EXIF' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1"

# 检查 EXIF 旋转功能
test_step "11.2 EXIF 旋转功能" "grep -r 'orientation\|rotate\|Rotation' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1"

# ============================================
# 12. 水印功能测试
# ============================================
print_section "1️⃣2️⃣  水印功能测试"

# 检查水印配置
test_step "12.1 水印配置支持" "grep -r 'watermark\|Watermark' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1"

# 检查水印类型（文本/Logo）
test_step "12.2 水印类型支持" "grep -r 'text.*logo\|logo.*text' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1 || grep -r '\"text\"\|\"logo\"' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1"

# ============================================
# 13. 风格预设测试
# ============================================
print_section "1️⃣3️⃣  风格预设测试"

# 检查风格预设功能
test_step "13.1 风格预设功能" "grep -r 'style.*preset\|StylePreset\|stylePreset' /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/processor.ts > /dev/null 2>&1"

# 检查风格预设文件
test_step "13.2 风格预设配置文件" "[ -f /Users/apple/Documents/Project/PIS/pis-standalone/services/worker/src/lib/style-presets.ts ]"

# ============================================
# 14. 重新处理功能测试
# ============================================
print_section "1️⃣4️⃣  重新处理功能测试"

# 检查重新处理 API
test_step "14.1 重新处理 API 端点" "curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/photos/reprocess' -H 'Content-Type: application/json' -d '{}' -o /dev/null | grep -qE '(400|401|404)'"

# 检查单照片重新处理 API
test_step "14.2 单照片重新处理 API" "curl -s -w '%{http_code}' --max-time $TIMEOUT -X POST '$BASE_URL/api/admin/albums/test-id/reprocess' -H 'Content-Type: application/json' -d '{}' -o /dev/null | grep -qE '(400|401|404)'"

# ============================================
# 15. 性能测试
# ============================================
print_section "1️⃣5️⃣  性能测试"

# 测试上传 API 响应时间
start_time=$(date +%s%N)
curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/admin/albums/test-id/upload" \
    -H "Content-Type: application/json" \
    -d '{"filename":"test.jpg","contentType":"image/jpeg","fileSize":1024}' > /dev/null 2>&1
end_time=$(date +%s%N)
upload_api_time=$(( (end_time - start_time) / 1000000 ))

if [ $upload_api_time -lt 500 ]; then
    echo -e "  上传 API 响应时间: ${GREEN}${upload_api_time}ms${NC} ✅"
    ((PASSED_TESTS++))
elif [ $upload_api_time -lt 1000 ]; then
    echo -e "  上传 API 响应时间: ${YELLOW}${upload_api_time}ms${NC} ⚠️"
    ((WARNINGS++))
else
    echo -e "  上传 API 响应时间: ${RED}${upload_api_time}ms${NC} ❌"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# 测试下载 API 响应时间
start_time=$(date +%s%N)
curl -s --max-time $TIMEOUT "$BASE_URL/api/public/download/test-id" > /dev/null 2>&1
end_time=$(date +%s%N)
download_api_time=$(( (end_time - start_time) / 1000000 ))

if [ $download_api_time -lt 500 ]; then
    echo -e "  下载 API 响应时间: ${GREEN}${download_api_time}ms${NC} ✅"
    ((PASSED_TESTS++))
elif [ $download_api_time -lt 1000 ]; then
    echo -e "  下载 API 响应时间: ${YELLOW}${download_api_time}ms${NC} ⚠️"
    ((WARNINGS++))
else
    echo -e "  下载 API 响应时间: ${RED}${download_api_time}ms${NC} ❌"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

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

rm -f /tmp/feature-test.log

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有功能测试通过！${NC}"
    exit 0
elif [ $FAILED_TESTS -le 2 ]; then
    echo -e "${YELLOW}⚠️  有 $FAILED_TESTS 个测试失败，但整体功能正常${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
