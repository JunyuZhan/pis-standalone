#!/bin/bash

# ============================================
# 清理开发环境缓存脚本
# 
# 清理 Next.js、node_modules 缓存等
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}清理开发环境缓存${NC}"
echo -e "${BLUE}========================================${NC}"

# 清理 Next.js 缓存
echo -e "${BLUE}清理 Next.js 缓存...${NC}"
rm -rf "${PROJECT_ROOT}/apps/web/.next"
rm -rf "${PROJECT_ROOT}/apps/web/.turbo"
echo -e "${GREEN}✓ Next.js 缓存已清理${NC}"

# 清理 node_modules 缓存
echo -e "${BLUE}清理 node_modules 缓存...${NC}"
find "${PROJECT_ROOT}" -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true
find "${PROJECT_ROOT}/node_modules" -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true
echo -e "${GREEN}✓ node_modules 缓存已清理${NC}"

# 清理 TypeScript 构建信息
echo -e "${BLUE}清理 TypeScript 构建信息...${NC}"
find "${PROJECT_ROOT}" -name "*.tsbuildinfo" -delete 2>/dev/null || true
echo -e "${GREEN}✓ TypeScript 构建信息已清理${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}缓存清理完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步：重新启动开发服务器${NC}"
echo -e "  pnpm dev:web"
