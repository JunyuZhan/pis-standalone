#!/bin/bash

# 浏览器兼容性测试脚本
# 使用 Playwright 运行跨浏览器测试

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          浏览器兼容性测试套件                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_DIR"

# 检查 Playwright 是否安装
if ! pnpm exec playwright --version > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Playwright 未安装，正在安装...${NC}"
  pnpm exec playwright install --with-deps
fi

# 检查服务是否运行
BASE_URL="${BASE_URL:-http://localhost:3000}"
if ! curl -f "$BASE_URL/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ 服务未运行，请先启动服务:${NC}"
  echo "  pnpm dev"
  exit 1
fi

echo "运行浏览器兼容性测试..."
echo "BASE_URL: $BASE_URL"
echo ""

# 运行所有浏览器测试
BROWSERS=("chromium" "firefox" "webkit")
FAILED_BROWSERS=()

for browser in "${BROWSERS[@]}"; do
  echo -e "${BLUE}测试浏览器: $browser${NC}"
  if pnpm exec playwright test --project="$browser" --reporter=list; then
    echo -e "${GREEN}✓ $browser 测试通过${NC}"
  else
    echo -e "${RED}✗ $browser 测试失败${NC}"
    FAILED_BROWSERS+=("$browser")
  fi
  echo ""
done

if [ ${#FAILED_BROWSERS[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ 所有浏览器测试通过${NC}"
  exit 0
else
  echo -e "${RED}✗ 以下浏览器测试失败: ${FAILED_BROWSERS[*]}${NC}"
  exit 1
fi
