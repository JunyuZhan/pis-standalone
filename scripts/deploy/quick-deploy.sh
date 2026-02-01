#!/bin/bash
# ============================================
# PIS 一键部署脚本
# ============================================
# 
# 特性：
#   - 快速部署，生成随机密钥
#   - 自动启动 Docker 容器（可选）
#   - 生成配置文件和部署信息
#   - 支持自定义配置
#
# 使用方法：
#   cd /opt/pis-standalone
#   bash scripts/deploy/quick-deploy.sh                    # 一键部署并启动服务
#   bash scripts/deploy/quick-deploy.sh --no-start         # 只生成配置，不启动服务
#   bash scripts/deploy/quick-deploy.sh --minio-user albert --minio-pass Zjy-1314
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 全局变量
MINIO_USER=""
MINIO_PASS=""
START_SERVICES=true
COMPOSE_CMD=""

# 检测项目根目录
detect_project_root() {
    # 从脚本所在目录开始，向上查找项目根目录
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local current_dir="$script_dir"
    
    # 向上查找，直到找到包含 .env.example 的目录
    while [ "$current_dir" != "/" ]; do
        if [ -f "$current_dir/.env.example" ]; then
            PROJECT_ROOT="$current_dir"
            cd "$PROJECT_ROOT"
            return 0
        fi
        current_dir="$(dirname "$current_dir")"
    done
    
    # 如果没找到，尝试从当前工作目录查找
    if [ -f ".env.example" ]; then
        PROJECT_ROOT="$(pwd)"
        return 0
    fi
    
    return 1
}

# 打印函数
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# 打印标题
print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  PIS 快速部署脚本${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --minio-user)
            MINIO_USER="$2"
            shift 2
            ;;
        --minio-pass)
            MINIO_PASS="$2"
            shift 2
            ;;
        --no-start)
            START_SERVICES=false
            shift
            ;;
        *)
            warn "未知参数: $1"
            shift
            ;;
    esac
done

# 生成随机密钥
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex ${1:-32}
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w ${1:-64} | head -n 1
    fi
}

# 检查项目目录
check_project_dir() {
    info "检查项目目录..."
    
    # 自动检测项目根目录
    if ! detect_project_root; then
        error "未找到 .env.example 文件"
        error "请确保在项目根目录中运行此脚本，或确保项目根目录存在 .env.example 文件"
        exit 1
    fi
    
    info "项目根目录: $PROJECT_ROOT"
    
    if [ ! -f "$PROJECT_ROOT/.env.example" ]; then
        error "未找到 .env.example 文件: $PROJECT_ROOT/.env.example"
        exit 1
    fi
    
    success "项目目录检查通过"
}

# 检查并创建 .env 文件
create_env_file() {
    info "检查配置文件..."
    
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        warn "检测到现有 .env 文件"
        read -p "是否覆盖现有配置？(y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            success "保留现有配置"
            return 0
        fi
    fi
    
    info "生成配置文件..."
    
    # 生成密钥（导出为全局变量供其他函数使用）
    POSTGRES_DB=pis
    POSTGRES_USER=pis
    POSTGRES_PASSWORD=$(generate_secret 32)
    export POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD
    
    MINIO_ROOT_USER=${MINIO_USER:-$(generate_secret 16)}
    MINIO_ROOT_PASSWORD=${MINIO_PASS:-$(generate_secret 32)}
    MINIO_ACCESS_KEY=$MINIO_ROOT_USER
    MINIO_SECRET_KEY=$MINIO_ROOT_PASSWORD
    export MINIO_ROOT_USER MINIO_ROOT_PASSWORD MINIO_ACCESS_KEY MINIO_SECRET_KEY
    
    WORKER_API_KEY=$(generate_secret 32)
    AUTH_JWT_SECRET=$(generate_secret 32)
    ALBUM_SESSION_SECRET=$(generate_secret 32)
    export WORKER_API_KEY AUTH_JWT_SECRET ALBUM_SESSION_SECRET
    
    # 创建 .env 文件
    cat > "${PROJECT_ROOT}/.env" << EOF
# ===========================================
# PIS Standalone 配置
# 自动生成于: $(date)
# ===========================================

# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=pis
DATABASE_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=pis
POSTGRES_USER=pis
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# ==================== 存储配置 ====================
STORAGE_TYPE=minio

# ==================== MinIO 存储配置 ====================
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=pis-photos
STORAGE_ENDPOINT=minio
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=$MINIO_ACCESS_KEY
STORAGE_SECRET_KEY=$MINIO_SECRET_KEY
STORAGE_BUCKET=pis-photos

# ==================== Redis ====================
REDIS_HOST=redis
REDIS_PORT=6379

# ==================== Worker 服务 ====================
HTTP_PORT=3001
WORKER_API_KEY=$WORKER_API_KEY
WORKER_BIND_HOST=0.0.0.0

# ==================== Web 应用配置 ====================
DOMAIN=localhost
NEXT_PUBLIC_APP_URL=http://localhost:8081
NEXT_PUBLIC_MEDIA_URL=http://localhost:8081/media
NEXT_PUBLIC_WORKER_URL=http://localhost:3001
MINIO_PUBLIC_URL=http://localhost:19000
STORAGE_PUBLIC_URL=http://localhost:8081/media

# ==================== 会话密钥 ====================
ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET

# ==================== 认证模式 ====================
AUTH_MODE=custom
AUTH_JWT_SECRET=$AUTH_JWT_SECRET
EOF

    success "配置文件已生成: ${PROJECT_ROOT}/.env"
}

# 保存部署信息
save_deployment_info() {
    info "保存部署信息..."
    
    cat > "${PROJECT_ROOT}/.deployment-info" << EOF
# ===========================================
# PIS 部署信息
# ===========================================
# 部署时间: $(date)
# 

# ==================== 服务访问地址 ====================
# 注意：这些服务需要在服务器上启动 Docker 容器后才能访问
# 

# Web 前端
# http://localhost:8081
# http://192.168.50.10:8081  # 如果在服务器上

# 管理后台
# http://localhost:8081/admin
# http://192.168.50.10:8081/admin  # 如果在服务器上

# MinIO Console
# http://localhost:19001
# http://192.168.50.10:19001  # 如果在服务器上

# ==================== MinIO 登录信息 ====================
# 用户名: $MINIO_ROOT_USER
# 密码: $MINIO_ROOT_PASSWORD
# Bucket: pis-photos

# ==================== 数据库连接信息 ====================
# 数据库类型: PostgreSQL
# 数据库主机: postgres
# 数据库端口: 5432
# 数据库名称: pis
# 数据库用户: pis
# 数据库密码: $POSTGRES_PASSWORD

# 容器内连接:
# docker exec -it pis-postgres psql -U pis -d pis

# 宿主机连接:
# psql -h 127.0.0.1 -p 5432 -U pis -d pis

# ==================== 安全密钥 ====================
# ⚠️  警告：请妥善保管以下密钥
# 

# Worker API Key:
# $WORKER_API_KEY

# JWT Secret:
# $AUTH_JWT_SECRET

# 会话密钥:
# $ALBUM_SESSION_SECRET

# ==================== 启动命令 ====================
# 

# 启动所有服务（在服务器上运行）:
# cd /opt/pis-standalone/docker
# docker compose up -d

# 停止所有服务（在服务器上运行）:
# cd /opt/pis-standalone/docker
# docker compose down

# 查看服务状态（在服务器上运行）:
# cd /opt/pis-standalone/docker
# docker compose ps

# 查看服务日志（在服务器上运行）:
# cd /opt/pis-standalone/docker
# docker compose logs -f

# ==================== 下一步操作 ====================
# 

# 1. 提交代码到 GitHub
#    git add .
#    git commit -m "Initial deployment"
#    git push origin main

# 2. 在服务器上拉取代码
#    cd /opt/pis-standalone
#    git pull origin main

# 3. 启动服务（在服务器上运行）
#    cd /opt/pis-standalone/docker
#    docker compose up -d

# 4. 访问 MinIO Console 上传文件
#    http://192.168.50.10:19001
#    用户名: $MINIO_ROOT_USER
#    密码: $MINIO_ROOT_PASSWORD

# 5. 访问 Web 前端
#    http://192.168.50.10:8081

# ==================== 注意事项 ====================
# 

# 1. 本脚本只生成配置文件，不启动服务器上的容器
# 2. 服务器上的容器需要单独启动（见上面的启动命令）
# 3. 首次启动容器时会自动初始化数据库
# 4. MinIO bucket 会自动创建
# 5. 配置文件已保存到项目根目录的 .env 文件
# 6. 部署信息已保存到项目根目录的 .deployment-info 文件
# 7. 请妥善保管 .deployment-info 文件中的安全密钥
EOF

    success "部署信息已保存: ${PROJECT_ROOT}/.deployment-info"
}

# 检查 Docker 和 Docker Compose
check_docker() {
    info "检查 Docker 环境..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装"
        error "请先安装 Docker: curl -fsSL https://get.docker.com | sh"
        return 1
    fi
    success "Docker 已安装: $(docker --version)"
    
    # 检查 Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        success "Docker Compose 已安装（compose 插件）"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        success "Docker Compose 已安装（standalone）"
    else
        error "Docker Compose 未安装"
        error "请先安装 Docker Compose"
        return 1
    fi
    
    return 0
}

# 启动 Docker 服务
start_services() {
    info "正在启动 Docker 服务..."
    
    local docker_dir="${PROJECT_ROOT}/docker"
    
    if [ ! -d "$docker_dir" ]; then
        error "未找到 docker 目录: $docker_dir"
        error ""
        error "可能的原因："
        error "  1. docker 目录未完整拉取，请检查: ls -la ${PROJECT_ROOT}/ | grep docker"
        error "  2. 如果 docker 目录不存在，请重新拉取代码: git pull origin main"
        error "  3. 或者手动创建 docker 目录并复制配置文件"
        error ""
        warn "跳过服务启动，请手动检查并启动服务"
        return 1
    fi
    
    cd "$docker_dir"
    
    # 检查 docker-compose 文件
    local compose_file="docker-compose.standalone.yml"
    if [ ! -f "$compose_file" ]; then
        warn "未找到 $compose_file，尝试使用 docker-compose.yml"
        compose_file="docker-compose.yml"
        if [ ! -f "$compose_file" ]; then
            error "未找到 docker-compose 配置文件"
            return 1
        fi
    fi
    
    info "使用配置文件: $compose_file"
    
    # 停止旧容器（如果有）
    info "停止旧容器（如果有）..."
    $COMPOSE_CMD -f "$compose_file" down 2>/dev/null || true
    
    # 启动服务
    info "正在启动 Docker 容器..."
    if $COMPOSE_CMD -f "$compose_file" up -d; then
        success "Docker 容器启动成功"
        
        # 等待服务启动
        info "等待服务启动..."
        sleep 10
        
        # 检查服务状态
        info "检查服务状态..."
        $COMPOSE_CMD -f "$compose_file" ps
        
        return 0
    else
        error "Docker 容器启动失败"
        return 1
    fi
}

# 显示完成信息
show_completion() {
    echo ""
    if [ "$START_SERVICES" = true ]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  一键部署完成！${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "${BLUE}服务访问地址：${NC}"
        echo ""
        echo -e "  🌐 Web 管理后台:"
        echo -e "     http://localhost:8081/admin/login"
        echo ""
        echo -e "  📦 MinIO 控制台:"
        echo -e "     http://localhost:8081/minio-console/"
        echo -e "     用户名: $MINIO_ROOT_USER"
        echo -e "     密码: $MINIO_ROOT_PASSWORD"
        echo ""
        echo -e "  📝 部署信息已保存到:"
        echo -e "     ${PROJECT_ROOT}/.deployment-info"
        echo ""
        echo -e "${BLUE}常用命令：${NC}"
        echo ""
        local compose_cmd="${COMPOSE_CMD:-docker compose}"
        echo -e "  查看服务状态:"
        echo -e "     cd ${PROJECT_ROOT}/docker && $compose_cmd ps"
        echo ""
        echo -e "  查看服务日志:"
        echo -e "     cd ${PROJECT_ROOT}/docker && $compose_cmd logs -f"
        echo ""
        echo -e "  重启服务:"
        echo -e "     cd ${PROJECT_ROOT}/docker && $compose_cmd restart"
        echo ""
        echo -e "  停止服务:"
        echo -e "     cd ${PROJECT_ROOT}/docker && $compose_cmd down"
        echo ""
    else
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  部署准备完成！${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "${BLUE}下一步操作：${NC}"
        echo ""
        echo -e "  1. ${CYAN}提交代码到 GitHub${NC}"
        echo -e "     git add ."
        echo -e "     git commit -m \"Initial deployment\""
        echo -e "     git push origin main"
        echo ""
        echo -e "  2. ${CYAN}在服务器上拉取代码${NC}"
        echo -e "     cd /opt/pis-standalone"
        echo -e "     git pull origin main"
        echo ""
        echo -e "  3. ${CYAN}启动服务（在服务器上运行）${NC}"
        echo -e "     cd /opt/pis-standalone/docker"
        echo -e "     docker compose up -d"
        echo ""
        echo -e "  4. ${CYAN}查看部署信息${NC}"
        echo -e "     cat .deployment-info"
        echo ""
        echo -e "${YELLOW}⚠️  注意：${NC}"
        echo -e "   使用了 --no-start 选项，未启动 Docker 容器"
        echo -e "   需要手动启动容器才能使用服务"
        echo ""
    fi
}

# 主函数
main() {
    print_header
    
    check_project_dir
    create_env_file
    save_deployment_info
    
    # 如果需要启动服务，检查 Docker 并启动
    if [ "$START_SERVICES" = true ]; then
        if check_docker; then
            start_services
        else
            warn "Docker 环境检查失败，跳过服务启动"
            warn "请手动启动服务: cd ${PROJECT_ROOT}/docker && docker compose up -d"
        fi
    fi
    
    show_completion
}

# 执行主函数
main
