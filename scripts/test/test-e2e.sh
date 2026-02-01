#!/bin/bash

# E2E 测试脚本
# 运行 Playwright E2E 测试

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          E2E 测试套件                                      ║${NC}"
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
  echo ""
  echo "或使用 Docker:"
  echo "  cd docker && docker-compose up -d"
  exit 1
fi

echo "运行 E2E 测试..."
echo "BASE_URL: $BASE_URL"
echo ""

# 运行 E2E 测试
if pnpm exec playwright test; then
  echo -e "${GREEN}✓ E2E 测试通过${NC}"
  exit 0
else
  echo -e "${RED}✗ E2E 测试失败${NC}"
  exit 1
fi
