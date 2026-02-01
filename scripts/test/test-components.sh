#!/bin/bash

# 前端组件测试脚本
# 运行所有 React 组件单元测试

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          前端组件测试套件                                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_DIR"
if [ ! -d "apps/web" ]; then
  echo -e "${RED}错误: 找不到 apps/web 目录${NC}"
  exit 1
fi
cd apps/web

echo "运行组件测试..."
echo ""

# 运行组件测试
if pnpm test:components; then
  echo -e "${GREEN}✓ 组件测试通过${NC}"
  exit 0
else
  echo -e "${RED}✗ 组件测试失败${NC}"
  exit 1
fi
