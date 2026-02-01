#!/bin/bash

# ============================================
# PIS 开发环境快速启动脚本
# 
# 功能：
# 1. 启动基础服务（PostgreSQL + MinIO + Redis）
# 2. 检查环境变量配置
# 3. 初始化数据库（如果需要）
# 4. 提供启动 Web 和 Worker 的提示
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_DIR="${PROJECT_ROOT}/docker"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PIS 开发环境启动${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}错误: Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f "${PROJECT_ROOT}/.env" ]; then
    echo -e "${YELLOW}未找到 .env 文件，正在从 .env.example 创建...${NC}"
    cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
    echo -e "${GREEN}已创建 .env 文件，请编辑后重新运行此脚本${NC}"
    echo -e "${YELLOW}提示: 开发环境可以使用默认配置${NC}"
    exit 0
fi

# 切换到 docker 目录
cd "${DOCKER_DIR}"

# 检查并创建网络（如果不存在）
if ! docker network inspect pis-network > /dev/null 2>&1; then
    echo -e "${BLUE}创建 Docker 网络 pis-network...${NC}"
    docker network create pis-network
fi

# 启动基础服务
echo -e "${BLUE}正在启动基础服务（PostgreSQL + MinIO + Redis）...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# 等待服务就绪
echo -e "${BLUE}等待服务就绪...${NC}"
sleep 5

# 检查服务状态
echo -e "${BLUE}检查服务状态...${NC}"
docker-compose -f docker-compose.dev.yml ps

# 检查数据库是否已初始化
echo -e "${BLUE}检查数据库初始化状态...${NC}"
DB_INIT_CHECK=$(docker exec pis-postgres-dev psql -U pis -d pis -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'albums');" 2>/dev/null || echo "false")

if [ "$DB_INIT_CHECK" != "t" ]; then
    echo -e "${YELLOW}数据库未初始化，正在初始化...${NC}"
    docker exec pis-postgres-dev psql -U pis -d pis -f /docker-entrypoint-initdb.d/init-postgresql-db.sql || {
        echo -e "${YELLOW}自动初始化失败，请手动执行:${NC}"
        echo "docker exec -i pis-postgres-dev psql -U pis -d pis < ${DOCKER_DIR}/init-postgresql-db.sql"
    }
else
    echo -e "${GREEN}数据库已初始化${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}基础服务已启动！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}服务访问地址：${NC}"
echo -e "  PostgreSQL: localhost:5432"
echo -e "  MinIO API:  http://localhost:9000"
echo -e "  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo -e "  Redis:      localhost:6379"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo -e "  1. 在终端 1 启动 Web:     ${YELLOW}pnpm dev${NC}"
echo -e "  2. 在终端 2 启动 Worker:  ${YELLOW}cd services/worker && pnpm dev${NC}"
echo ""
echo -e "${BLUE}停止服务：${NC}"
echo -e "  ${YELLOW}cd docker && docker-compose -f docker-compose.dev.yml down${NC}"
echo ""
