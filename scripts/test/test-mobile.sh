#!/bin/bash

# 移动端测试脚本
# 使用 Playwright 的移动设备模拟进行测试

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          移动端测试套件                                  ║${NC}"
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

echo "运行移动端测试..."
echo "BASE_URL: $BASE_URL"
echo ""

# 运行移动端测试（只运行移动端项目）
if pnpm exec playwright test --project="Mobile Chrome" --project="Mobile Safari"; then
  echo -e "${GREEN}✓ 移动端测试通过${NC}"
  exit 0
else
  echo -e "${RED}✗ 移动端测试失败${NC}"
  exit 1
fi
