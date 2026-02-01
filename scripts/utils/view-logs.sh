#!/bin/bash

# ============================================
# PIS 日志查看脚本
# 用途: 快速查看各个服务的日志
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SERVICE=${1:-"all"}
LINES=${2:-100}
FOLLOW=${3:-false}

print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

show_help() {
    echo -e "${BLUE}PIS 日志查看工具${NC}"
    echo ""
    echo "用法:"
    echo "  $0 [service] [lines] [follow]"
    echo ""
    echo "参数:"
    echo "  service  - 服务名称 (web|worker|postgres|redis|minio|all)"
    echo "  lines    - 显示行数 (默认: 100)"
    echo "  follow   - 是否实时跟随 (true|false, 默认: false)"
    echo ""
    echo "示例:"
    echo "  $0                    # 查看所有服务最近 100 行日志"
    echo "  $0 web                # 查看 Web 服务日志"
    echo "  $0 worker 200        # 查看 Worker 服务最近 200 行日志"
    echo "  $0 web 50 true       # 实时查看 Web 服务日志"
    echo ""
    echo "服务列表:"
    echo "  web      - Web 服务 (Next.js)"
    echo "  worker   - Worker 服务 (图片处理)"
    echo "  postgres - PostgreSQL 数据库"
    echo "  redis    - Redis 缓存"
    echo "  minio    - MinIO 对象存储"
    echo "  all      - 所有服务"
}

if [ "$SERVICE" = "help" ] || [ "$SERVICE" = "-h" ] || [ "$SERVICE" = "--help" ]; then
    show_help
    exit 0
fi

if [ "$FOLLOW" = "true" ] || [ "$FOLLOW" = "1" ]; then
    FOLLOW_FLAG="-f"
else
    FOLLOW_FLAG=""
fi

case $SERVICE in
    web)
        print_header "Web 服务日志 (pis-web)"
        if [ "$FOLLOW_FLAG" = "-f" ]; then
            docker logs -f pis-web
        else
            docker logs --tail $LINES pis-web
        fi
        ;;
    worker)
        print_header "Worker 服务日志 (pis-worker)"
        if [ "$FOLLOW_FLAG" = "-f" ]; then
            docker logs -f pis-worker
        else
            docker logs --tail $LINES pis-worker
        fi
        ;;
    postgres)
        print_header "PostgreSQL 日志 (pis-postgres)"
        if [ "$FOLLOW_FLAG" = "-f" ]; then
            docker logs -f pis-postgres
        else
            docker logs --tail $LINES pis-postgres
        fi
        ;;
    redis)
        print_header "Redis 日志 (pis-redis)"
        if [ "$FOLLOW_FLAG" = "-f" ]; then
            docker logs -f pis-redis
        else
            docker logs --tail $LINES pis-redis
        fi
        ;;
    minio)
        print_header "MinIO 日志 (pis-minio)"
        if [ "$FOLLOW_FLAG" = "-f" ]; then
            docker logs -f pis-minio
        else
            docker logs --tail $LINES pis-minio
        fi
        ;;
    all)
        print_header "所有服务日志"
        echo -e "${YELLOW}Web 服务:${NC}"
        docker logs --tail $((LINES / 5)) pis-web 2>&1 | tail -$((LINES / 5))
        echo ""
        echo -e "${YELLOW}Worker 服务:${NC}"
        docker logs --tail $((LINES / 5)) pis-worker 2>&1 | tail -$((LINES / 5))
        echo ""
        echo -e "${YELLOW}PostgreSQL:${NC}"
        docker logs --tail $((LINES / 5)) pis-postgres 2>&1 | tail -$((LINES / 5))
        echo ""
        echo -e "${YELLOW}Redis:${NC}"
        docker logs --tail $((LINES / 5)) pis-redis 2>&1 | tail -$((LINES / 5))
        echo ""
        echo -e "${YELLOW}MinIO:${NC}"
        docker logs --tail $((LINES / 5)) pis-minio 2>&1 | tail -$((LINES / 5))
        ;;
    *)
        echo -e "${RED}错误: 未知的服务 '$SERVICE'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
