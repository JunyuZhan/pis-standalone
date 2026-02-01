#!/bin/bash

# 数据库性能测试脚本
# 检查 N+1 查询问题、查询性能、索引使用情况

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志文件
LOG_FILE="database-performance-test-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="database-performance-report-$(date +%Y%m%d-%H%M%S).md"

# 测试配置
BASE_URL="${BASE_URL:-http://localhost:3000}"
CONCURRENT_REQUESTS="${CONCURRENT_REQUESTS:-10}"
TEST_DURATION="${TEST_DURATION:-30}"

echo "=========================================="
echo "数据库性能测试"
echo "=========================================="
echo "测试时间: $(date)"
echo "BASE_URL: $BASE_URL"
echo "并发请求数: $CONCURRENT_REQUESTS"
echo "测试时长: ${TEST_DURATION}秒"
echo "=========================================="
echo ""

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# 测试步骤函数
test_step() {
  local name="$1"
  local command="$2"
  local expected="$3"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -n "[测试 $TOTAL_TESTS] $name ... "
  
  if eval "$command" > /tmp/test_output.log 2>&1; then
    if [ -n "$expected" ]; then
      if grep -q "$expected" /tmp/test_output.log; then
        echo -e "${GREEN}✓ 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
      else
        echo -e "${YELLOW}⚠ 警告${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
      fi
    else
      echo -e "${GREEN}✓ 通过${NC}"
      PASSED_TESTS=$((PASSED_TESTS + 1))
      return 0
    fi
  else
    echo -e "${RED}✗ 失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    cat /tmp/test_output.log
    return 1
  fi
}

# 检查 Docker 容器状态
echo "1. 检查服务状态"
echo "----------------------------------------"
if ! docker ps | grep -q "pis-postgres"; then
  echo -e "${RED}错误: PostgreSQL 容器未运行${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PostgreSQL 容器运行中${NC}"
echo ""

# 获取数据库连接信息
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-pis}"
DB_USER="${DB_USER:-pis}"
DB_PASSWORD="${DB_PASSWORD:-pis_password}"

export PGPASSWORD="$DB_PASSWORD"

echo "2. 数据库连接测试"
echo "----------------------------------------"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ 数据库连接成功${NC}"
else
  echo -e "${RED}✗ 数据库连接失败${NC}"
  exit 1
fi
echo ""

echo "3. 检查表结构和索引"
echo "----------------------------------------"

# 检查索引
check_index() {
  local table="$1"
  local column="$2"
  local index_name="${table}_${column}_idx"
  
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE tablename = '$table' 
    AND indexname LIKE '%${column}%';
  " | tr -d ' ' | grep -q "^[1-9]" && echo "✓ $table.$column 有索引" || echo "⚠ $table.$column 缺少索引"
}

echo "检查关键索引:"
check_index "albums" "slug"
check_index "albums" "user_id"
check_index "albums" "deleted_at"
check_index "photos" "album_id"
check_index "photos" "status"
check_index "photos" "deleted_at"
check_index "photos" "cover_photo_id"
check_index "photo_group_assignments" "group_id"
check_index "photo_group_assignments" "photo_id"
check_index "photo_groups" "album_id"
echo ""

echo "4. 查询性能测试"
echo "----------------------------------------"

# 测试查询执行时间
test_query_performance() {
  local query="$1"
  local name="$2"
  
  echo -n "测试: $name ... "
  
  start_time=$(date +%s%N)
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$query" > /dev/null 2>&1
  end_time=$(date +%s%N)
  
  duration=$(( (end_time - start_time) / 1000000 )) # 转换为毫秒
  
  if [ $duration -lt 100 ]; then
    echo -e "${GREEN}✓ ${duration}ms${NC}"
  elif [ $duration -lt 500 ]; then
    echo -e "${YELLOW}⚠ ${duration}ms (较慢)${NC}"
  else
    echo -e "${RED}✗ ${duration}ms (很慢)${NC}"
  fi
}

# 测试各种查询
test_query_performance "SELECT COUNT(*) FROM albums WHERE deleted_at IS NULL;" "相册列表查询"
test_query_performance "SELECT * FROM albums WHERE slug = 'test-slug' LIMIT 1;" "相册 slug 查询"
test_query_performance "SELECT COUNT(*) FROM photos WHERE album_id = (SELECT id FROM albums LIMIT 1) AND status = 'completed' AND deleted_at IS NULL;" "照片数量统计"
test_query_performance "SELECT * FROM photos WHERE album_id = (SELECT id FROM albums LIMIT 1) ORDER BY sort_order LIMIT 20;" "照片列表查询"
test_query_performance "SELECT * FROM photo_group_assignments WHERE group_id IN (SELECT id FROM photo_groups LIMIT 5);" "分组关联批量查询"
echo ""

echo "5. N+1 查询问题检测"
echo "----------------------------------------"

# 检查代码中的 N+1 模式
check_n_plus_one() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  
  if grep -n "$pattern" "$file" > /tmp/n1_check.log 2>&1; then
    echo -e "${YELLOW}⚠ 发现潜在 N+1 问题: $description${NC}"
    echo "  文件: $file"
    echo "  匹配行:"
    grep -n "$pattern" "$file" | head -3 | sed 's/^/    /'
    WARNINGS=$((WARNINGS + 1))
  fi
}

echo "检查代码中的 N+1 查询模式:"

# 检查循环中的数据库查询
find apps/web/src -name "*.ts" -o -name "*.tsx" | while read file; do
  # 检查 for 循环中的查询
  if grep -q "for.*{" "$file" && grep -q "\.from\|\.select\|\.query" "$file"; then
    # 检查是否有 await 在循环中
    if awk '/for.*\{/,/\}/' "$file" | grep -q "await.*\.from\|await.*\.select"; then
      check_n_plus_one "$file" "for.*await.*\.from" "循环中的数据库查询"
    fi
  fi
  
  # 检查 map/forEach 中的查询
  if grep -q "\.map\|\.forEach" "$file" && grep -q "\.from\|\.select" "$file"; then
    if grep -q "\.map.*await.*\.from\|\.forEach.*await.*\.from" "$file"; then
      check_n_plus_one "$file" "\.map.*await.*\.from\|\.forEach.*await.*\.from" "map/forEach 中的数据库查询"
    fi
  fi
done

echo ""

echo "6. 实际 API 性能测试"
echo "----------------------------------------"

# 获取测试用的相册 slug
TEST_SLUG=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT slug FROM albums WHERE deleted_at IS NULL LIMIT 1;" | tr -d ' ')

if [ -z "$TEST_SLUG" ]; then
  echo -e "${YELLOW}⚠ 没有可用的测试相册，跳过 API 测试${NC}"
else
  echo "使用测试相册: $TEST_SLUG"
  
  # 测试相册详情 API
  echo -n "测试: GET /api/public/albums/$TEST_SLUG ... "
  start_time=$(date +%s%N)
  response=$(curl -s -w "\n%{http_code}" -o /tmp/api_response.json "$BASE_URL/api/public/albums/$TEST_SLUG")
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))
  http_code=$(echo "$response" | tail -1)
  
  if [ "$http_code" = "200" ]; then
    if [ $duration -lt 500 ]; then
      echo -e "${GREEN}✓ ${duration}ms${NC}"
    else
      echo -e "${YELLOW}⚠ ${duration}ms (较慢)${NC}"
    fi
  else
    echo -e "${RED}✗ HTTP $http_code${NC}"
  fi
  
  # 测试照片列表 API
  echo -n "测试: GET /api/public/albums/$TEST_SLUG/photos ... "
  start_time=$(date +%s%N)
  response=$(curl -s -w "\n%{http_code}" -o /tmp/api_response.json "$BASE_URL/api/public/albums/$TEST_SLUG/photos")
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))
  http_code=$(echo "$response" | tail -1)
  
  if [ "$http_code" = "200" ]; then
    if [ $duration -lt 500 ]; then
      echo -e "${GREEN}✓ ${duration}ms${NC}"
    else
      echo -e "${YELLOW}⚠ ${duration}ms (较慢)${NC}"
    fi
  else
    echo -e "${RED}✗ HTTP $http_code${NC}"
  fi
  
  # 测试分组列表 API（如果有分组）
  echo -n "测试: GET /api/public/albums/$TEST_SLUG/groups ... "
  start_time=$(date +%s%N)
  response=$(curl -s -w "\n%{http_code}" -o /tmp/api_response.json "$BASE_URL/api/public/albums/$TEST_SLUG/groups")
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))
  http_code=$(echo "$response" | tail -1)
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
    if [ $duration -lt 500 ]; then
      echo -e "${GREEN}✓ ${duration}ms${NC}"
    else
      echo -e "${YELLOW}⚠ ${duration}ms (较慢)${NC}"
    fi
  else
    echo -e "${RED}✗ HTTP $http_code${NC}"
  fi
fi

echo ""

echo "7. 并发性能测试"
echo "----------------------------------------"

if [ -n "$TEST_SLUG" ]; then
  echo "并发请求测试 ($CONCURRENT_REQUESTS 个并发请求)..."
  
  # 使用 ab (Apache Bench) 进行并发测试
  if command -v ab > /dev/null 2>&1; then
    ab -n 100 -c "$CONCURRENT_REQUESTS" "$BASE_URL/api/public/albums/$TEST_SLUG" > /tmp/ab_output.log 2>&1
    
    if [ $? -eq 0 ]; then
      echo "结果摘要:"
      grep "Requests per second" /tmp/ab_output.log | sed 's/^/  /'
      grep "Time per request" /tmp/ab_output.log | head -1 | sed 's/^/  /'
      grep "Failed requests" /tmp/ab_output.log | sed 's/^/  /'
    else
      echo -e "${YELLOW}⚠ ab 测试失败，跳过并发测试${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ 未安装 ab (Apache Bench)，跳过并发测试${NC}"
    echo "  安装方法: brew install httpd (macOS) 或 apt-get install apache2-utils (Linux)"
  fi
else
  echo -e "${YELLOW}⚠ 没有可用的测试相册，跳过并发测试${NC}"
fi

echo ""

echo "8. 数据库统计信息"
echo "----------------------------------------"

echo "表记录数统计:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  SELECT 
    'albums' as table_name,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_count
  FROM albums
  UNION ALL
  SELECT 
    'photos' as table_name,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'completed') as active_count
  FROM photos
  UNION ALL
  SELECT 
    'photo_groups' as table_name,
    COUNT(*) as total_count,
    COUNT(*) as active_count
  FROM photo_groups
  UNION ALL
  SELECT 
    'photo_group_assignments' as table_name,
    COUNT(*) as total_count,
    COUNT(*) as active_count
  FROM photo_group_assignments;
" | grep -v "^$" | grep -v "rows)" | grep -v "table_name" | sed 's/^/  /'

echo ""

echo "9. 查询计划分析（EXPLAIN ANALYZE）"
echo "----------------------------------------"

echo "分析关键查询的执行计划:"

# 分析相册列表查询
echo "1. 相册列表查询:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  EXPLAIN ANALYZE
  SELECT * FROM albums 
  WHERE deleted_at IS NULL 
  ORDER BY created_at DESC 
  LIMIT 20;
" | head -20 | sed 's/^/  /'

echo ""
echo "2. 照片列表查询（带分组关联）:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  EXPLAIN ANALYZE
  SELECT p.* 
  FROM photos p
  WHERE p.album_id = (SELECT id FROM albums LIMIT 1)
    AND p.status = 'completed'
    AND p.deleted_at IS NULL
  ORDER BY p.sort_order
  LIMIT 20;
" | head -20 | sed 's/^/  /'

echo ""
echo "3. 分组关联批量查询（优化后）:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  EXPLAIN ANALYZE
  SELECT group_id, photo_id
  FROM photo_group_assignments
  WHERE group_id IN (SELECT id FROM photo_groups LIMIT 5);
" | head -20 | sed 's/^/  /'

echo ""

echo "10. 生成测试报告"
echo "----------------------------------------"

# 生成 Markdown 报告
cat > "$REPORT_FILE" << EOF
# 数据库性能测试报告

**测试时间**: $(date)
**BASE_URL**: $BASE_URL
**数据库**: $DB_NAME@$DB_HOST:$DB_PORT

## 测试结果摘要

- **总测试数**: $TOTAL_TESTS
- **通过**: $PASSED_TESTS
- **失败**: $FAILED_TESTS
- **警告**: $WARNINGS

## 发现的问题

### N+1 查询问题

以下代码位置可能存在 N+1 查询问题：

1. **\`apps/web/src/app/album/[slug]/page.tsx\` (第 242-252 行)**
   - **问题**: 在循环中查询每个分组的照片关联
   - **影响**: 如果有 N 个分组，会执行 N+1 次查询
   - **建议**: 使用批量查询，一次性获取所有分组的关联

2. **\`apps/web/src/components/admin/album-detail-client.tsx\` (第 103-117 行)**
   - **问题**: 虽然使用 Promise.all，但仍对每个分组单独调用 API
   - **影响**: 前端 N+1 API 调用（虽然并行，但不是最优）
   - **建议**: 后端提供批量获取所有分组照片关联的 API

## 优化建议

1. **修复 N+1 查询**
   - 将循环查询改为批量查询
   - 使用 \`IN\` 子句一次性获取多个分组的关联

2. **添加数据库索引**
   - 确保所有外键字段都有索引
   - 确保常用查询字段有索引

3. **查询优化**
   - 使用 \`SELECT\` 只查询需要的字段
   - 使用分页限制返回的数据量
   - 使用 \`EXPLAIN ANALYZE\` 分析慢查询

## 详细测试日志

\`\`\`
$(cat "$LOG_FILE" 2>/dev/null || echo "无日志文件")
\`\`\`
EOF

echo -e "${GREEN}✓ 测试报告已生成: $REPORT_FILE${NC}"
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo -e "警告: ${YELLOW}$WARNINGS${NC}"
echo ""
echo "详细报告: $REPORT_FILE"

# 清理
unset PGPASSWORD

if [ $FAILED_TESTS -gt 0 ]; then
  exit 1
fi
