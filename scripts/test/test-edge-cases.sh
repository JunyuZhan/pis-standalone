#!/bin/bash

# 边界情况测试脚本
# 测试极端场景和边界条件

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          边界情况测试套件                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

BASE_URL="${BASE_URL:-http://localhost:8081}"

# 检查服务是否运行
if ! curl -f "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ 服务未运行，请先启动服务${NC}"
  exit 1
fi

echo "BASE_URL: $BASE_URL"
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

test_step() {
  local name="$1"
  local command="$2"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -n "[测试 $TOTAL_TESTS] $name ... "
  
  if eval "$command" > /tmp/edge_test_output.log 2>&1; then
    echo -e "${GREEN}✓ 通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}✗ 失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    cat /tmp/edge_test_output.log | head -5
    return 1
  fi
}

echo "1. 超长文本测试"
echo "----------------------------------------"

# 测试超长相册标题
test_step "超长相册标题（500字符）" "
  long_title=\$(printf 'a%.0s' {1..500})
  response=\$(curl -s -w '\n%{http_code}' -X POST '$BASE_URL/api/admin/albums' \\
    -H 'Content-Type: application/json' \\
    -H 'Cookie: auth-token=test' \\
    -d \"{\\\"title\\\": \\\"\$long_title\\\"}\")
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"400\" ] || [ \"\$http_code\" = \"401\" ]
"

# 测试超长描述
test_step "超长相册描述（5000字符）" "
  long_desc=\$(printf 'a%.0s' {1..5000})
  response=\$(curl -s -w '\n%{http_code}' -X POST '$BASE_URL/api/admin/albums' \\
    -H 'Content-Type: application/json' \\
    -H 'Cookie: auth-token=test' \\
    -d \"{\\\"title\\\": \\\"Test\\\", \\\"description\\\": \\\"\$long_desc\\\"}\")
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"400\" ] || [ \"\$http_code\" = \"401\" ]
"

echo ""
echo "2. 特殊字符测试"
echo "----------------------------------------"

# 测试特殊字符文件名
test_step "特殊字符文件名（SQL注入尝试）" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/public/albums/test%27%20OR%201=1--/photos')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"400\" ] || [ \"\$http_code\" = \"404\" ]
"

# 测试 XSS 尝试
test_step "XSS 尝试（脚本标签）" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/public/albums/%3Cscript%3Ealert%281%29%3C%2Fscript%3E/photos')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"400\" ] || [ \"\$http_code\" = \"404\" ]
"

# 测试 Unicode 字符
test_step "Unicode 字符（emoji）" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/public/albums/test-😀-相册/photos')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"200\" ] || [ \"\$http_code\" = \"404\" ] || [ \"\$http_code\" = \"400\" ]
"

echo ""
echo "3. 数值边界测试"
echo "----------------------------------------"

# 测试负数（应该被修正为1，返回200）
test_step "负数页码" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/admin/albums?page=-1')
  http_code=\$(echo \"\$response\" | tail -1)
  # 负数页码应该被修正为1，返回200（正常响应）或401（需要登录）
  [ \"\$http_code\" = \"200\" ] || [ \"\$http_code\" = \"401\" ]
"

# 测试超大数值（应该返回空列表，状态码200或401）
test_step "超大页码（1000000）" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/admin/albums?page=1000000')
  http_code=\$(echo \"\$response\" | tail -1)
  # 超大页码应该返回空列表（200）或需要登录（401）
  [ \"\$http_code\" = \"200\" ] || [ \"\$http_code\" = \"401\" ]
"

# 测试零值（应该被修正为最小值，返回200或401）
test_step "零值限制" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/admin/albums?limit=0')
  http_code=\$(echo \"\$response\" | tail -1)
  # 零值limit应该被修正为1，返回200（正常响应）或401（需要登录）
  [ \"\$http_code\" = \"200\" ] || [ \"\$http_code\" = \"401\" ]
"

echo ""
echo "4. 并发请求测试"
echo "----------------------------------------"

# 测试大量并发请求
test_step "100个并发请求" "
  for i in {1..100}; do
    curl -s '$BASE_URL/health' > /dev/null &
  done
  wait
  echo '完成'
"

echo ""
echo "5. 无效 UUID 测试"
echo "----------------------------------------"

# 测试无效的 UUID
test_step "无效 UUID 格式" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/admin/albums/invalid-uuid')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"400\" ] || [ \"\$http_code\" = \"404\" ]
"

# 测试空 UUID
test_step "空 UUID" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/admin/albums/')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"404\" ] || [ \"\$http_code\" = \"400\" ]
"

echo ""
echo "6. 空值和 null 测试"
echo "----------------------------------------"

# 测试空请求体
test_step "空请求体" "
  response=\$(curl -s -w '\n%{http_code}' -X POST '$BASE_URL/api/admin/albums' \\
    -H 'Content-Type: application/json' \\
    -H 'Cookie: auth-token=test' \\
    -d '{}')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"400\" ] || [ \"\$http_code\" = \"401\" ]
"

# 测试 null 值
test_step "null 值处理" "
  response=\$(curl -s -w '\n%{http_code}' -X POST '$BASE_URL/api/admin/albums' \\
    -H 'Content-Type: application/json' \\
    -H 'Cookie: auth-token=test' \\
    -d '{\"title\": null}')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"400\" ] || [ \"\$http_code\" = \"401\" ]
"

echo ""
echo "7. 编码测试"
echo "----------------------------------------"

# 测试 URL 编码
test_step "URL 编码处理" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/public/albums/test%20album/photos')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"200\" ] || [ \"\$http_code\" = \"404\" ] || [ \"\$http_code\" = \"400\" ]
"

# 测试双重编码
test_step "双重 URL 编码" "
  response=\$(curl -s -w '\n%{http_code}' '$BASE_URL/api/public/albums/test%2520album/photos')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"200\" ] || [ \"\$http_code\" = \"404\" ] || [ \"\$http_code\" = \"400\" ]
"

echo ""
echo "8. 方法测试"
echo "----------------------------------------"

# 测试不支持的方法
test_step "不支持的 HTTP 方法（PATCH on GET endpoint）" "
  response=\$(curl -s -w '\n%{http_code}' -X PATCH '$BASE_URL/api/public/albums/test/photos')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"405\" ] || [ \"\$http_code\" = \"404\" ] || [ \"\$http_code\" = \"400\" ]
"

# 测试 OPTIONS 请求
test_step "OPTIONS 请求（CORS）" "
  response=\$(curl -s -w '\n%{http_code}' -X OPTIONS '$BASE_URL/api/public/albums/test/photos' \\
    -H 'Origin: http://localhost:3000' \\
    -H 'Access-Control-Request-Method: GET')
  http_code=\$(echo \"\$response\" | tail -1)
  [ \"\$http_code\" = \"200\" ] || [ \"\$http_code\" = \"204\" ] || [ \"\$http_code\" = \"404\" ]
"

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -gt 0 ]; then
  exit 1
fi
