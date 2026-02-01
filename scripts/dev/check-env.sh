#!/bin/bash

# ============================================
# 检查开发环境配置脚本
# 
# 验证 .env 文件中的配置是否正确
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}检查开发环境配置${NC}"
echo -e "${BLUE}========================================${NC}"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ .env 文件不存在${NC}"
    echo -e "${YELLOW}正在从 .env.example 创建...${NC}"
    cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
    echo -e "${GREEN}✓ 已创建 .env 文件${NC}"
    echo -e "${YELLOW}请编辑 .env 文件并设置正确的配置${NC}"
    exit 0
fi

# 检查关键配置
errors=0
warnings=0

# 检查 DATABASE_HOST
if grep -q "^DATABASE_HOST=postgres" "$ENV_FILE"; then
    echo -e "${RED}✗ DATABASE_HOST 设置为 'postgres'（Docker 容器名）${NC}"
    echo -e "${YELLOW}  开发环境应使用 'localhost'${NC}"
    echo -e "${BLUE}  修复方法: 将 DATABASE_HOST=postgres 改为 DATABASE_HOST=localhost${NC}"
    errors=$((errors + 1))
elif grep -q "^DATABASE_HOST=localhost" "$ENV_FILE"; then
    echo -e "${GREEN}✓ DATABASE_HOST 配置正确 (localhost)${NC}"
else
    echo -e "${YELLOW}⚠ DATABASE_HOST 未设置，将使用默认值 localhost${NC}"
    warnings=$((warnings + 1))
fi

# 检查 DATABASE_TYPE
if grep -q "^DATABASE_TYPE=postgresql" "$ENV_FILE"; then
    echo -e "${GREEN}✓ DATABASE_TYPE 配置正确 (postgresql)${NC}"
else
    echo -e "${YELLOW}⚠ DATABASE_TYPE 未设置或不是 postgresql${NC}"
    warnings=$((warnings + 1))
fi

# 检查其他关键配置
if grep -q "^REDIS_HOST=localhost" "$ENV_FILE"; then
    echo -e "${GREEN}✓ REDIS_HOST 配置正确 (localhost)${NC}"
elif grep -q "^REDIS_HOST=redis" "$ENV_FILE"; then
    echo -e "${RED}✗ REDIS_HOST 设置为 'redis'（Docker 容器名）${NC}"
    echo -e "${YELLOW}  开发环境应使用 'localhost'${NC}"
    errors=$((errors + 1))
else
    echo -e "${YELLOW}⚠ REDIS_HOST 未设置，将使用默认值 localhost${NC}"
    warnings=$((warnings + 1))
fi

if grep -q "^MINIO_ENDPOINT_HOST=localhost\|^STORAGE_ENDPOINT=localhost" "$ENV_FILE"; then
    echo -e "${GREEN}✓ MinIO/Storage 配置正确 (localhost)${NC}"
elif grep -q "^MINIO_ENDPOINT_HOST=minio\|^STORAGE_ENDPOINT=minio" "$ENV_FILE"; then
    echo -e "${RED}✗ MinIO/Storage 主机设置为 'minio'（Docker 容器名）${NC}"
    echo -e "${YELLOW}  开发环境应使用 'localhost'${NC}"
    errors=$((errors + 1))
else
    echo -e "${YELLOW}⚠ MinIO/Storage 配置未设置${NC}"
    warnings=$((warnings + 1))
fi

echo ""
if [ $errors -gt 0 ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}发现 $errors 个错误配置${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}修复方法：${NC}"
    echo -e "  1. 编辑 .env 文件"
    echo -e "  2. 将所有 Docker 容器名（postgres, redis, minio）改为 localhost"
    echo -e "  3. 保存文件并重新启动开发服务器"
    exit 1
elif [ $warnings -gt 0 ]; then
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}发现 $warnings 个警告${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${GREEN}配置基本正确，但建议检查上述警告项${NC}"
    exit 0
else
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}配置检查通过！${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
fi
