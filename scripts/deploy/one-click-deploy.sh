#!/bin/bash
# ============================================
# PIS 真正的一键部署脚本
# ============================================
# 
# 使用方法：
#   curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/one-click-deploy.sh | bash
# 
# 或在项目目录中运行：
#   bash scripts/one-click-deploy.sh
# 
# 特性：
#   - 完全自动化，无需交互
#   - 自动检测并安装 Docker、Docker Compose
#   - 自动克隆代码（如果不在项目目录）
#   - 使用默认配置（standalone 模式）
#   - 自动生成所有密钥和密码
#   - 自动启动所有服务
#   - 自动创建管理员账户（首次登录设置密码）
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
COMPOSE_CMD=""
PROJECT_DIR=""
POSTGRES_DB=""
POSTGRES_USER=""
POSTGRES_PASSWORD=""
DOMAIN=""
MINIO_ACCESS_KEY=""
MINIO_SECRET_KEY=""
WORKER_API_KEY=""
ALBUM_SESSION_SECRET=""
AUTH_JWT_SECRET=""

# 打印函数
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# 打印标题
print_header() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                           ║${NC}"
    echo -e "${CYAN}║   📸 PIS - 一键部署脚本                                  ║${NC}"
    echo -e "${CYAN}║   One-Click Deployment Script                            ║${NC}"
    echo -e "${CYAN}║                                                           ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 生成随机密钥
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex ${1:-32}
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w ${1:-64} | head -n 1
    fi
}

# 检查并安装 Docker
install_docker() {
    if command -v docker &> /dev/null; then
        success "Docker 已安装: $(docker --version)"
        return 0
    fi
    
    info "正在安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    
    # 启动 Docker 服务
    if command -v systemctl &> /dev/null; then
        systemctl enable docker
        systemctl start docker
    fi
    
    success "Docker 安装完成"
}

# 检查并安装 Docker Compose
install_docker_compose() {
    # 检查 docker compose (v2)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        export COMPOSE_CMD
        success "Docker Compose 已安装"
        return 0
    fi
    
    # 检查 docker-compose (v1)
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        export COMPOSE_CMD
        success "Docker Compose 已安装"
        return 0
    fi
    
    info "正在安装 Docker Compose..."
    
    # 安装 Docker Compose v2 (推荐)
    if command -v systemctl &> /dev/null; then
        # 使用 Docker 插件方式安装
        mkdir -p /usr/local/lib/docker/cli-plugins
        curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
        COMPOSE_CMD="docker compose"
        export COMPOSE_CMD
    else
        # 回退到 v1
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
        curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        COMPOSE_CMD="docker-compose"
        export COMPOSE_CMD
    fi
    
    success "Docker Compose 安装完成"
}

# 检测项目目录
detect_project_dir() {
    # 如果当前目录是项目目录
    if [ -f "docker/deploy.sh" ] || [ -f "docker/docker-compose.standalone.yml" ]; then
        PROJECT_DIR="$(pwd)"
        export PROJECT_DIR
        success "检测到项目目录: $PROJECT_DIR"
        return 0
    fi
    
    # 否则使用默认目录
    PROJECT_DIR="${DEPLOY_DIR:-/opt/pis}"
    export PROJECT_DIR
    
    # 如果目录不存在，克隆代码
    if [ ! -d "$PROJECT_DIR" ]; then
        info "正在克隆代码到 $PROJECT_DIR..."
        
        # 检查 Git
        if ! command -v git &> /dev/null; then
            warn "Git 未安装，正在安装..."
            if command -v apt-get &> /dev/null; then
                apt-get update && apt-get install -y git
            elif command -v yum &> /dev/null; then
                yum install -y git
            fi
        fi
        
        GITHUB_REPO="${GITHUB_REPO:-https://github.com/JunyuZhan/pis-standalone.git}"
        GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
        
        git clone -b ${GITHUB_BRANCH} ${GITHUB_REPO} ${PROJECT_DIR}
        success "代码克隆完成"
    else
        info "目录已存在: $PROJECT_DIR"
        info "更新代码..."
        cd ${PROJECT_DIR} && git pull || true
    fi
    
    cd ${PROJECT_DIR}
}

# 生成配置文件
generate_config() {
    info "正在生成配置文件..."
    
    cd ${PROJECT_DIR}
    
    # 生成所有密钥和密码（导出为全局变量）
    POSTGRES_DB="${POSTGRES_DB:-pis}"
    POSTGRES_USER="${POSTGRES_USER:-pis}"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(generate_secret 16)}"
    DOMAIN="${DOMAIN:-localhost}"
    MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-$(generate_secret 8)}"
    MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-$(generate_secret 16)}"
    WORKER_API_KEY="${WORKER_API_KEY:-$(generate_secret 32)}"
    ALBUM_SESSION_SECRET="${ALBUM_SESSION_SECRET:-$(generate_secret 32)}"
    AUTH_JWT_SECRET="${AUTH_JWT_SECRET:-$(generate_secret 32)}"
    
    # 导出变量供其他函数使用
    export POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DOMAIN
    export MINIO_ACCESS_KEY MINIO_SECRET_KEY WORKER_API_KEY
    export ALBUM_SESSION_SECRET AUTH_JWT_SECRET
    
    # 创建 .env 文件
    cat > .env << EOF
# PIS Standalone 配置
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
# 一键部署脚本自动生成

# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=${POSTGRES_DB}
DATABASE_USER=${POSTGRES_USER}
DATABASE_PASSWORD=${POSTGRES_PASSWORD}

# PostgreSQL 容器配置（docker-compose.standalone.yml 使用）
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# ==================== 存储配置 ====================
STORAGE_TYPE=minio

# ==================== MinIO 存储配置 ====================
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_ENDPOINT_HOST=minio
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=${MINIO_BUCKET:-pis-photos}
STORAGE_ENDPOINT=minio
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=${MINIO_ACCESS_KEY}
STORAGE_SECRET_KEY=${MINIO_SECRET_KEY}
STORAGE_BUCKET=pis-photos

# ==================== Redis ====================
REDIS_HOST=redis
REDIS_PORT=6379

# ==================== Worker 服务 ====================
HTTP_PORT=3001
WORKER_API_KEY=${WORKER_API_KEY}
WORKER_BIND_HOST=0.0.0.0

# ==================== Web 应用配置 ====================
DOMAIN=${DOMAIN}
NEXT_PUBLIC_APP_URL=http://${DOMAIN}:8081
NEXT_PUBLIC_MEDIA_URL=http://${DOMAIN}:8081/media
NEXT_PUBLIC_WORKER_URL=http://${DOMAIN}:8081/api/worker
STORAGE_PUBLIC_URL=http://${DOMAIN}:8081/media
MINIO_PUBLIC_URL=http://${DOMAIN}:8081/media

# ==================== 会话密钥 ====================
ALBUM_SESSION_SECRET=${ALBUM_SESSION_SECRET}

# ==================== 认证模式 ====================
AUTH_MODE=custom
AUTH_JWT_SECRET=${AUTH_JWT_SECRET}
EOF
    
    success "配置文件已生成: ${PROJECT_DIR}/.env"
    
    # 保存重要信息
    cat > ${PROJECT_DIR}/.deployment-info << EOF
# PIS 部署信息
# 生成时间: $(date)
# ⚠️  警告: 此文件包含敏感信息，请妥善保管

部署架构: 完全自托管（PostgreSQL）
域名: ${DOMAIN}

# 重要密钥（请妥善保管）
Worker API Key: ${WORKER_API_KEY}
会话密钥: ${ALBUM_SESSION_SECRET}
MinIO 访问密钥: ${MINIO_ACCESS_KEY}
MinIO 密钥: ${MINIO_SECRET_KEY}

# 数据库配置
数据库类型: PostgreSQL
数据库主机: postgres
数据库端口: 5432
数据库名称: ${POSTGRES_DB}
数据库用户: ${POSTGRES_USER}
数据库密码: ${POSTGRES_PASSWORD}
JWT Secret: ${AUTH_JWT_SECRET}

# 管理员账户
管理员邮箱: admin@${DOMAIN}
管理员密码: 首次登录时设置
EOF
    
    success "部署信息已保存: ${PROJECT_DIR}/.deployment-info"
}

# 启动服务
start_services() {
    info "正在启动服务..."
    
    cd ${PROJECT_DIR}/docker
    
    # 使用 standalone compose 文件（强制覆盖以确保使用正确的配置）
    info "使用 standalone 模式配置..."
    cp docker-compose.standalone.yml docker-compose.yml
    success "已复制 docker-compose.standalone.yml 为 docker-compose.yml"
    
    # 停止旧容器（如果有）
    $COMPOSE_CMD down 2>/dev/null || true
    
    # 启动服务
    info "正在启动 Docker 容器..."
    $COMPOSE_CMD up -d
    
    # 等待服务启动
    info "等待服务启动..."
    sleep 15
    
    # 检查服务状态
    info "检查服务状态..."
    $COMPOSE_CMD ps
}

# 更新部署信息文件中的管理员邮箱
update_deployment_info_email() {
    local email=$1
    if [ -f "${PROJECT_DIR}/.deployment-info" ]; then
        # 使用 sed 更新邮箱（兼容 macOS 和 Linux）
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|管理员邮箱:.*|管理员邮箱: ${email}|" "${PROJECT_DIR}/.deployment-info"
        else
            sed -i "s|管理员邮箱:.*|管理员邮箱: ${email}|" "${PROJECT_DIR}/.deployment-info"
        fi
    fi
}

# 创建管理员账户
create_admin() {
    info "正在创建管理员账户..."
    
    # 确定管理员邮箱（localhost 使用 example.com 避免邮箱格式问题）
    ADMIN_EMAIL="admin@${DOMAIN}"
    if [ "$DOMAIN" = "localhost" ]; then
        ADMIN_EMAIL="admin@example.com"
    fi
    
    # 等待 PostgreSQL 容器健康检查通过
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker ps --format '{{.Names}}\t{{.Status}}' | grep -q "pis-postgres.*healthy"; then
            sleep 2
            break
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    
    # 检查 PostgreSQL 容器是否运行
    if ! docker ps --format '{{.Names}}' | grep -q "^pis-postgres$"; then
        warn "PostgreSQL 容器未运行，跳过管理员账户创建"
        return 1
    fi
    
    # 转义邮箱中的单引号（SQL 注入防护）
    ADMIN_EMAIL_ESC=$(echo "$ADMIN_EMAIL" | sed "s/'/''/g")
    
    # 直接使用 PostgreSQL 容器创建管理员账户（最简单可靠）
    local sql_result
    sql_result=$(docker exec pis-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "
        INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at) 
        VALUES ('${ADMIN_EMAIL_ESC}', NULL, 'admin', true, NOW(), NOW()) 
        ON CONFLICT (email) DO NOTHING 
        RETURNING email;
    " 2>&1)
    
    if [ $? -eq 0 ]; then
        # 检查是否创建成功（返回了邮箱）
        if echo "$sql_result" | grep -q "${ADMIN_EMAIL}"; then
            success "管理员账户创建成功: ${ADMIN_EMAIL}"
            success "首次登录时请设置密码"
            # 更新部署信息文件中的管理员邮箱
            update_deployment_info_email "${ADMIN_EMAIL}"
            return 0
        elif echo "$sql_result" | grep -q "0 rows"; then
            # 用户已存在
            success "管理员账户已存在: ${ADMIN_EMAIL}"
            # 更新部署信息文件中的管理员邮箱
            update_deployment_info_email "${ADMIN_EMAIL}"
            return 0
        else
            # 检查用户是否真的存在
            local check_result
            check_result=$(docker exec pis-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT email FROM users WHERE email = '${ADMIN_EMAIL_ESC}';" 2>&1)
            if echo "$check_result" | grep -q "${ADMIN_EMAIL}"; then
                success "管理员账户已存在: ${ADMIN_EMAIL}"
                # 更新部署信息文件中的管理员邮箱
                update_deployment_info_email "${ADMIN_EMAIL}"
                return 0
            fi
        fi
    fi
    
    # 如果失败，提示手动创建
    warn "管理员账户创建失败，请手动执行:"
    warn "  docker exec pis-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c \"INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at) VALUES ('${ADMIN_EMAIL}', NULL, 'admin', true, NOW(), NOW()) ON CONFLICT (email) DO NOTHING;\""
    warn "  或: cd ${PROJECT_DIR} && pnpm create-admin ${ADMIN_EMAIL}"
    return 1
}

# 显示完成信息
show_completion() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║   🎉 部署完成！                                          ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${BOLD}访问信息：${NC}"
    echo ""
    echo "  🌐 Web 管理后台:"
    echo "     http://localhost:8081/admin/login"
    if [ "$DOMAIN" != "localhost" ]; then
        echo "     https://${DOMAIN}/admin/login"
    fi
    echo ""
    echo "  👤 管理员账户:"
    echo "     邮箱: admin@${DOMAIN}"
    echo "     密码: 首次登录时设置"
    echo ""
    echo "  📦 MinIO 控制台:"
    echo "     http://localhost:8081/minio-console/"
    echo "     用户名: ${MINIO_ACCESS_KEY}"
    echo "     密码: ${MINIO_SECRET_KEY}"
    echo ""
    echo "  📝 重要信息已保存到:"
    echo "     ${PROJECT_DIR}/.deployment-info"
    echo ""
    echo -e "${YELLOW}⚠️  请妥善保管 .deployment-info 文件！${NC}"
    echo ""
    echo -e "${BOLD}常用命令：${NC}"
    echo ""
    echo "  查看日志:"
    echo "    cd ${PROJECT_DIR}/docker && ${COMPOSE_CMD} logs -f"
    echo ""
    echo "  重启服务:"
    echo "    cd ${PROJECT_DIR}/docker && ${COMPOSE_CMD} restart"
    echo ""
    echo "  停止服务:"
    echo "    cd ${PROJECT_DIR}/docker && ${COMPOSE_CMD} down"
    echo ""
    echo "  创建管理员:"
    echo "    cd ${PROJECT_DIR} && pnpm create-admin"
    echo ""
}

# 主函数
main() {
    print_header
    
    # 1. 安装 Docker
    install_docker
    
    # 2. 安装 Docker Compose
    install_docker_compose
    
    # 3. 检测项目目录
    detect_project_dir
    
    # 4. 生成配置文件
    generate_config
    
    # 5. 启动服务
    start_services
    
    # 6. 创建管理员账户
    create_admin
    
    # 7. 显示完成信息
    show_completion
}

# 运行主函数
main "$@"
