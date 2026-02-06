#!/bin/bash
# ============================================
# PIS 启动脚本（启用 AI 服务）
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    exit 1
fi

# 确定使用的 compose 命令
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  PIS 启动脚本（启用 AI 服务）${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 检查配置文件是否存在
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}错误: 找不到 docker-compose.yml 文件${NC}"
    exit 1
fi

if [ ! -f "docker-compose.ai.yml" ]; then
    echo -e "${RED}错误: 找不到 docker-compose.ai.yml 文件${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f "../.env" ]; then
    echo -e "${YELLOW}警告: 找不到 .env 文件${NC}"
    echo -e "${CYAN}提示: 请先运行 bash docker/deploy.sh 生成配置文件${NC}"
    echo ""
    read -p "是否继续？ [y/n]: " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# 确保 Docker Compose 能找到 .env 文件（创建符号链接）
# Docker Compose 在解析变量时会在当前目录查找 .env 文件
if [ -f "../.env" ]; then
    # 检查是否需要创建或更新符号链接
    need_link=true
    if [ -L ".env" ]; then
        # 检查现有符号链接是否指向正确位置
        current_target=$(readlink .env 2>/dev/null || echo "")
        if [ "$current_target" = "../.env" ]; then
            need_link=false
        fi
    elif [ -f ".env" ]; then
        # .env 存在但不是符号链接，需要删除后重新创建
        echo -e "${YELLOW}警告: docker/.env 已存在但不是符号链接，将删除并重新创建${NC}"
        rm -f .env
    fi
    
    if [ "$need_link" = true ]; then
        echo -e "${CYAN}创建/更新 .env 符号链接以便 Docker Compose 读取...${NC}"
        ln -sf ../.env .env
    fi
fi

echo -e "${CYAN}正在启动服务（包含 AI 服务）...${NC}"
echo ""

# 启动服务（合并两个配置文件）
if $COMPOSE_CMD -f docker-compose.yml -f docker-compose.ai.yml up -d; then
    echo ""
    echo -e "${GREEN}✓ 服务启动成功${NC}"
    echo ""
    echo -e "${CYAN}已启动的服务：${NC}"
    echo "  - PostgreSQL (数据库)"
    echo "  - MinIO (对象存储)"
    echo "  - Redis (缓存)"
    echo "  - Worker (图片处理)"
    echo "  - Web (前端)"
    echo "  - Nginx (反向代理)"
    echo -e "  - ${GREEN}AI (人脸识别服务)${NC}"
    echo ""
    echo -e "${CYAN}查看服务状态：${NC}"
    echo "  $COMPOSE_CMD -f docker-compose.yml -f docker-compose.ai.yml ps"
    echo ""
    echo -e "${CYAN}查看日志：${NC}"
    echo "  $COMPOSE_CMD -f docker-compose.yml -f docker-compose.ai.yml logs -f"
    echo ""
    echo -e "${CYAN}停止服务：${NC}"
    echo "  $COMPOSE_CMD -f docker-compose.yml -f docker-compose.ai.yml down"
    echo ""
    echo -e "${YELLOW}注意：AI 服务首次启动需要下载模型（约 500MB），可能需要几分钟${NC}"
else
    echo ""
    echo -e "${RED}✗ 服务启动失败${NC}"
    echo ""
    echo -e "${CYAN}故障排查：${NC}"
    echo "  1. 查看日志: $COMPOSE_CMD -f docker-compose.yml -f docker-compose.ai.yml logs"
    echo "  2. 查看容器状态: $COMPOSE_CMD -f docker-compose.yml -f docker-compose.ai.yml ps"
    exit 1
fi
