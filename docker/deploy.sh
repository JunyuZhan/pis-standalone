#!/bin/bash
# ============================================
# PIS 一键部署脚本
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

# 脚本所在目录 (docker/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 项目根目录
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Docker 目录
DOCKER_DIR="$SCRIPT_DIR"

cd "$SCRIPT_DIR"

# 打印带颜色的标题
print_title() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# 打印步骤
print_step() {
    echo ""
    echo -e "${BLUE}[$1] $2${NC}"
}

# 打印成功
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 打印错误
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 打印警告
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 获取用户输入
get_input() {
    local prompt="$1"
    local default="$2"
    local result

    if [ -n "$default" ]; then
        read -p "$(echo -e ${GREEN}${prompt}${NC} [$default]): " result
        echo "${result:-$default}"
    else
        read -p "$(echo -e ${GREEN}${prompt}${NC}): " result
        echo "$result"
    fi
}

# 获取确认
get_confirm() {
    local prompt="$1"
    local default="${2:-n}"

    while true; do
        local result
        read -p "$(echo -e ${GREEN}${prompt}${NC} [y/n]: ") result
        result=$(echo "$result" | tr '[:upper:]' '[:lower:]')

        if [ -z "$result" ]; then
            result="$default"
        fi

        if [ "$result" = "y" ] || [ "$result" = "yes" ]; then
            return 0
        elif [ "$result" = "n" ] || [ "$result" = "no" ]; then
            return 1
        fi
    done
}

# 生成随机密钥
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}

# 检查 Docker
check_docker() {
    print_step "1/9" "检查 Docker 环境"

    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装"
        echo "请先安装 Docker: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    print_success "Docker 已安装: $(docker --version)"

    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装"
        echo "请先安装 Docker Compose"
        exit 1
    fi

    if docker compose version &> /dev/null; then
        print_success "Docker Compose 已安装（compose 插件）"
        COMPOSE_CMD="docker compose"
    else
        print_success "Docker Compose 已安装（standalone）"
        COMPOSE_CMD="docker-compose"
    fi
}

# 配置部署模式
configure_deployment_mode() {
    print_step "2/9" "部署架构配置"

    echo ""
    echo -e "${BOLD}请选择部署架构：${NC}"
    echo ""
    echo "  1) 完全自托管（推荐）"
    echo "     - 前端: 自托管（Docker + Nginx）"
    echo "     - 数据库: PostgreSQL（自托管）"
    echo "     - 存储/Worker: 你的服务器"
    echo ""
    echo "  2) 混合部署（向后兼容）"
    echo "     - 前端: Vercel（自动部署）"
    echo "     - 数据库: Supabase Cloud"
    echo "     - 存储/Worker: 你的服务器"
    echo ""
    
    read -p "$(echo -e ${GREEN}请选择 [1/2，默认: 1]${NC}): " mode_choice
    mode_choice=${mode_choice:-1}
    
    case "$mode_choice" in
        1)
            DEPLOYMENT_MODE="standalone"
            AUTH_MODE="custom"
            print_success "架构: 完全自托管（PostgreSQL）"
            ;;
        2)
            DEPLOYMENT_MODE="hybrid"
            AUTH_MODE="supabase"
            print_success "架构: 混合部署（Supabase）"
            ;;
        *)
            print_error "无效选择，使用默认：完全自托管"
            DEPLOYMENT_MODE="standalone"
            AUTH_MODE="custom"
            ;;
    esac
}

# 获取域名配置
configure_domain() {
    print_step "3/9" "配置域名"

    echo ""
    echo -e "${YELLOW}请输入你的域名（不带 http:// 或 https://）${NC}"
    echo -e "${YELLOW}如果还没有域名，可以输入 localhost 进行本地测试${NC}"
    echo ""

    DOMAIN=$(get_input "域名" "")

    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
        DOMAIN="localhost"
        print_warning "使用 localhost，仅适用于本地测试"
    else
        print_success "域名: $DOMAIN"
    fi

    # 自动推断相关 URL
    APP_URL="https://$DOMAIN"
    MEDIA_URL="https://$DOMAIN/media"
    WORKER_URL="https://$DOMAIN/worker-api"

    if [ "$DOMAIN" = "localhost" ]; then
        APP_URL="http://localhost:3000"
        MEDIA_URL="http://localhost:9000/pis-photos"
        WORKER_URL="http://localhost:3001"
    fi
}

# 配置 Supabase（混合部署）
configure_supabase() {
    print_step "4a/9" "配置 Supabase"

    echo ""
    echo -e "${CYAN}请按照以下步骤配置 Supabase:${NC}"
    echo ""
    echo "  1. 访问 https://supabase.com 并登录"
    echo "  2. 点击 New Project 创建项目"
    echo "  3. 创建完成后，进入 Settings → API"
    echo ""

    SUPABASE_URL=$(get_input "Project URL" "")
    SUPABASE_ANON_KEY=$(get_input "anon public key" "")
    SUPABASE_SERVICE_KEY=$(get_input "service_role key" "")

    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        print_error "Supabase 配置不完整"
        exit 1
    fi

    print_success "Supabase 已配置"

    echo ""
    echo -e "${YELLOW}接下来请在 Supabase 中创建管理员账号:${NC}"
    echo "  1. 进入 Authentication → Users"
    echo "  2. 点击 Add user → Create new user"
    echo "  3. 输入管理员邮箱和密码"
    echo "  4. ✅ 勾选 Auto Confirm User"
    echo "  5. 点击 Create user"
    echo ""
    get_confirm "已创建管理员账号，继续" "y"
}

# 配置 PostgreSQL（完全自托管模式）
configure_postgresql() {
    print_step "4a/9" "配置 PostgreSQL 数据库"

    echo ""
    echo -e "${CYAN}PostgreSQL 数据库配置${NC}"
    echo ""

    DATABASE_HOST=$(get_input "数据库主机" "localhost")
    DATABASE_PORT=$(get_input "数据库端口" "5432")
    DATABASE_NAME=$(get_input "数据库名称" "pis")
    DATABASE_USER=$(get_input "数据库用户" "pis")
    DATABASE_PASSWORD=$(get_input "数据库密码" "")
    
    if [ -z "$DATABASE_PASSWORD" ]; then
        DATABASE_PASSWORD=$(generate_secret | cut -c1-32)
        print_success "已生成数据库密码"
    fi

    # 生成 JWT Secret
    AUTH_JWT_SECRET=$(generate_secret)
    print_success "已生成 JWT Secret"

    print_success "PostgreSQL 已配置"
    
    echo ""
    echo -e "${CYAN}数据库初始化说明:${NC}"
    echo "  - Docker Compose 会自动初始化数据库（首次启动时）"
    echo "  - 如果使用外部数据库，需要手动执行初始化脚本"
    echo ""
    
    # 检查是否使用 Docker 内的数据库
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        echo -e "${GREEN}✓ 使用 Docker 内数据库，将自动初始化${NC}"
    else
        get_confirm "数据库已初始化，继续" "y"
    fi
}

# 配置 MinIO
configure_minio() {
    print_step "5/9" "配置 MinIO 对象存储"

    echo ""
    echo -e "${CYAN}MinIO 将用于存储照片文件${NC}"
    echo ""

    MINIO_ACCESS_KEY=$(get_input "MinIO 访问密钥 (留空自动生成)" "")
    if [ -z "$MINIO_ACCESS_KEY" ]; then
        MINIO_ACCESS_KEY=$(generate_secret | cut -c1-16)
        print_success "已生成 MinIO 访问密钥"
    fi

    MINIO_SECRET_KEY=$(get_input "MinIO 密钥 (留空自动生成)" "")
    if [ -z "$MINIO_SECRET_KEY" ]; then
        MINIO_SECRET_KEY=$(generate_secret)
        print_success "已生成 MinIO 密钥"
    fi

    MINIO_BUCKET="pis-photos"

    print_success "MinIO 已配置"
}

# 配置 Worker
configure_worker() {
    print_step "6/9" "配置 Worker API"

    WORKER_API_KEY=$(get_input "Worker API 密钥 (留空自动生成)" "")
    if [ -z "$WORKER_API_KEY" ]; then
        WORKER_API_KEY=$(generate_secret)
        print_success "已生成 Worker API 密钥"
    fi

    print_success "Worker API 已配置"
}

# 配置安全密钥
configure_security() {
    print_step "7/9" "配置安全密钥"

    ALBUM_SESSION_SECRET=$(get_input "相册会话密钥 (留空自动生成)" "")
    if [ -z "$ALBUM_SESSION_SECRET" ]; then
        ALBUM_SESSION_SECRET=$(generate_secret)
        print_success "已生成会话密钥"
    fi

    print_success "安全密钥已配置"
}

# 配置告警（可选）
configure_alerts() {
    print_step "8/9" "配置告警服务（可选）"

    echo ""
    echo -e "${YELLOW}是否需要配置告警通知？${NC}"
    echo "  - 支持使用 Telegram Bot 或 邮件通知"
    echo "  - 不配置则仅记录到控制台日志"
    echo ""

    if get_confirm "配置告警" "n"; then
        echo ""
        echo -e "${CYAN}请选择告警方式:${NC}"
        echo "  1. Telegram（推荐）"
        echo "  2. 邮件"
        echo "  3. 仅日志"
        echo ""

        while true; do
            local alert_choice
            read -p "$(echo -e "${GREEN}请选择 [1/2/3]${NC}: ")" alert_choice

            case "$alert_choice" in
                1)
                    ALERT_TYPE="telegram"
                    TELEGRAM_BOT_TOKEN=$(get_input "Telegram Bot Token" "")
                    TELEGRAM_CHAT_ID=$(get_input "Telegram Chat ID" "")
                    print_success "Telegram 告警已配置"
                    break
                    ;;
                2)
                    ALERT_TYPE="email"
                    ALERT_SMTP_HOST=$(get_input "SMTP 服务器 (如 smtp.gmail.com)" "")
                    ALERT_SMTP_PORT=$(get_input "SMTP 端口 (如 587)" "587")
                    ALERT_SMTP_USER=$(get_input "SMTP 用户名 (邮箱地址)" "")
                    ALERT_SMTP_PASS=$(get_input "SMTP 密码" "")
                    ALERT_FROM_EMAIL=$(get_input "发件人邮箱" "")
                    ALERT_TO_EMAIL=$(get_input "收件人邮箱" "")
                    print_success "邮件告警已配置"
                    break
                    ;;
                3)
                    ALERT_TYPE="log"
                    print_success "使用日志记录"
                    break
                    ;;
                *)
                    print_error "无效选择"
                    ;;
            esac
        done
    else
        ALERT_TYPE="log"
        print_success "使用日志记录"
    fi

    ALERT_ENABLED="true"
}

# 管理员账号创建
# - 完全自托管模式: 使用 pnpm create-admin 创建
# - 混合部署模式: 在 Supabase Dashboard 中创建

# 生成配置文件
generate_config() {
    print_step "9/9" "生成配置并部署"

    local env_file=".env.generated"

    echo ""
    echo -e "${CYAN}正在生成配置文件...${NC}"

    # 根据部署模式生成配置
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        # 完全自托管配置
        cat > "$env_file" << EOF
# ============================================
# PIS 配置文件 (完全自托管)
# 自动生成于: $(date)
# ============================================

# ==================== 域名配置 ====================
DOMAIN=$DOMAIN
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# ==================== 数据库配置 ====================
DATABASE_TYPE=postgresql
DATABASE_HOST=$DATABASE_HOST
DATABASE_PORT=$DATABASE_PORT
DATABASE_NAME=$DATABASE_NAME
DATABASE_USER=$DATABASE_USER
DATABASE_PASSWORD=$DATABASE_PASSWORD
DATABASE_SSL=false

# ==================== 认证配置 ====================
AUTH_MODE=custom
AUTH_JWT_SECRET=$AUTH_JWT_SECRET
EOF
    else
        # 混合部署配置（Supabase）
        cat > "$env_file" << EOF
# ============================================
# PIS 配置文件 (Vercel + Supabase + 自建 Worker)
# 自动生成于: $(date)
# ============================================

# ==================== 域名配置 ====================
DOMAIN=$DOMAIN
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# ==================== 数据库配置 ====================
DATABASE_TYPE=supabase

# ==================== Supabase 配置 ====================
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_URL=$SUPABASE_URL
EOF
    fi
    
    # 公共配置
    cat >> "$env_file" << EOF

# ==================== MinIO 配置 ====================
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET=$MINIO_BUCKET
STORAGE_PUBLIC_URL=$MEDIA_URL
MINIO_PUBLIC_URL=$MEDIA_URL

# ==================== Worker 配置 ====================
WORKER_API_KEY=$WORKER_API_KEY
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# ==================== 安全配置 ====================
ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET

# ==================== 告警配置 ====================
ALERT_ENABLED=$ALERT_ENABLED
ALERT_TYPE=$ALERT_TYPE
EOF
        if [ "$ALERT_TYPE" = "telegram" ]; then
            cat >> "$env_file" << EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
        elif [ "$ALERT_TYPE" = "email" ]; then
            cat >> "$env_file" << EOF
ALERT_SMTP_HOST=$ALERT_SMTP_HOST
ALERT_SMTP_PORT=$ALERT_SMTP_PORT
ALERT_SMTP_USER=$ALERT_SMTP_USER
ALERT_SMTP_PASS=$ALERT_SMTP_PASS
ALERT_FROM_EMAIL=$ALERT_FROM_EMAIL
ALERT_TO_EMAIL=$ALERT_TO_EMAIL
EOF
        fi

        # 复制为 .env
        cp "$env_file" .env
        print_success "配置已保存到 .env"

        echo ""
        echo -e "${CYAN}========================================${NC}"
        echo -e "${CYAN}  部署说明${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo ""
        echo -e "${GREEN}1. 服务器端部署${NC}"
        echo ""
        echo "启动基础服务:"
        echo "  $ cd docker"
        echo "  $ docker-compose up -d"
        echo ""
        if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
            echo -e "${GREEN}2. 启动所有服务${NC}"
            echo ""
            echo "启动完全自托管服务:"
            echo "  $ cd docker"
            echo "  $ docker-compose -f docker-compose.standalone.yml up -d"
            echo ""
            echo -e "${GREEN}3. 数据库初始化${NC}"
            echo ""
            echo "  📌 重要说明："
            echo "     - Docker Compose 会在首次启动时自动初始化数据库"
            echo "     - 如果使用外部数据库，需要手动执行初始化脚本"
            echo ""
            echo "  a. 自动初始化（推荐，Docker 内数据库）:"
            echo "     - 数据库会在容器首次启动时自动初始化"
            echo "     - 无需手动操作"
            echo ""
            echo "  b. 手动初始化（外部数据库）:"
            echo "     $ psql -U $DATABASE_USER -d $DATABASE_NAME -f docker/init-postgresql-db.sql"
            echo ""
            echo "  c. 创建管理员账号（数据库初始化后）:"
            echo "     $ pnpm create-admin"
            echo ""
            echo -e "${GREEN}4. 配置 Nginx 和 SSL${NC}"
            echo ""
            echo "参考 docker/nginx/ 目录下的配置文件配置 Nginx 反向代理和 SSL。"
            echo ""
        else
            echo -e "${GREEN}2. Vercel 前端部署${NC}"
            echo ""
            echo "  a. 访问 https://vercel.com 导入你的 GitHub 仓库"
            echo "  b. 配置构建:"
            echo "     - Root Directory: apps/web"
            echo "     - Build Command: pnpm build"
            echo "  c. 添加环境变量（在 Vercel Dashboard）:"
            echo "     - DATABASE_TYPE=supabase"
            echo "     - NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL"
            echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
            echo "     - SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY"
            echo "     - NEXT_PUBLIC_APP_URL=$APP_URL"
            echo "     - NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL"
            echo "     - WORKER_API_KEY=$WORKER_API_KEY"
            echo "     - ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET"
            echo "  d. 点击 Deploy"
            echo ""
            echo -e "${GREEN}3. 绑定域名${NC}"
            echo ""
            echo "在 Vercel 中添加你的域名，按提示配置 DNS。"
            echo ""
            echo -e "${YELLOW}⚠️  重要: 记得将 worker.$DOMAIN 的 A 记录指向你的服务器 IP${NC}"
            echo "   media.$DOMAIN 的 A 记录也指向你的服务器 IP"
            echo ""
        fi
        echo -e "${CYAN}========================================${NC}"

    # 保存重要信息
    cat > .deployment-info << EOF
# PIS 部署信息
# 生成时间: $(date)
# ⚠️  警告: 此文件包含敏感信息，请妥善保管，不要泄露或提交到 Git

部署架构: $([ "$DEPLOYMENT_MODE" = "standalone" ] && echo "完全自托管（PostgreSQL）" || echo "Vercel + Supabase + 自建 Worker")
域名: $DOMAIN

# 重要密钥（请妥善保管）
Worker API Key: $WORKER_API_KEY
会话密钥: $ALBUM_SESSION_SECRET
MinIO 访问密钥: $MINIO_ACCESS_KEY
MinIO 密钥: $MINIO_SECRET_KEY

# 数据库配置
$([ "$DEPLOYMENT_MODE" = "standalone" ] && cat << EOF
数据库类型: PostgreSQL
数据库主机: $DATABASE_HOST
数据库端口: $DATABASE_PORT
数据库名称: $DATABASE_NAME
数据库用户: $DATABASE_USER
JWT Secret: $AUTH_JWT_SECRET
EOF
|| cat << EOF
数据库类型: Supabase
Supabase URL: $SUPABASE_URL
Supabase Anon Key: $SUPABASE_ANON_KEY
Supabase Service Key: $SUPABASE_SERVICE_KEY
EOF
)
EOF

    print_success "部署信息已保存到 .deployment-info"
    print_warning "⚠️  请妥善保管 .deployment-info 文件，不要将其提交到 Git 或分享给他人"
    print_warning "⚠️  建议将其备份到安全的地方，然后删除此文件"
}

# 显示完成后信息
show_completion_info() {
    echo ""
    print_title "部署完成！"

    echo ""
    echo -e "${GREEN}✓ 配置文件已生成${NC}"
    echo -e "${GREEN}✓ 服务已启动${NC}"
    echo ""
    echo -e "${YELLOW}配置文件位置:${NC}"
    echo "  - .env"
    echo "  - .deployment-info"
    echo ""
    echo -e "${YELLOW}常用命令:${NC}"
    echo "  查看状态: cd $DOCKER_DIR && $COMPOSE_CMD ps"
    echo "  查看日志: cd $DOCKER_DIR && $COMPOSE_CMD logs -f"
    echo "  重启服务: cd $DOCKER_DIR && $COMPOSE_CMD restart"
    echo "  停止服务: cd $DOCKER_DIR && $COMPOSE_CMD down"
    echo ""
    echo -e "${CYAN}如需重新配置，请运行: bash docker/deploy.sh${NC}"
}

# 检查并初始化数据库（仅 Docker 内数据库）
check_and_init_database() {
    if [ "$DEPLOYMENT_MODE" != "standalone" ]; then
        return 0
    fi
    
    # 检查是否使用 Docker 内的数据库
    if [ "$DATABASE_HOST" = "localhost" ] || [ "$DATABASE_HOST" = "127.0.0.1" ] || [ "$DATABASE_HOST" = "postgres" ]; then
        print_step "10/10" "检查数据库初始化状态"
        
        echo ""
        echo -e "${CYAN}检查数据库是否已初始化...${NC}"
        
        # 等待 PostgreSQL 容器启动
        if docker ps | grep -q "pis-postgres"; then
            echo "等待数据库就绪..."
            sleep 5
            
            # 检查数据库是否已初始化（检查是否存在 users 表）
            if docker exec pis-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');" | grep -q "t"; then
                print_success "数据库已初始化"
            else
                print_warning "数据库未初始化，将在容器启动时自动初始化"
                echo ""
                echo -e "${YELLOW}注意：${NC}"
                echo "  - PostgreSQL 容器会在首次启动时自动执行初始化脚本"
                echo "  - 如果数据卷已存在，需要手动执行初始化脚本"
                echo ""
                
                if get_confirm "是否现在手动初始化数据库？" "n"; then
                    echo ""
                    echo "执行初始化脚本..."
                    if docker exec -i pis-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" < "$SCRIPT_DIR/init-postgresql-db.sql" 2>/dev/null; then
                        print_success "数据库初始化完成"
                    else
                        print_error "数据库初始化失败，请手动执行:"
                        echo "  docker exec -i pis-postgres psql -U $DATABASE_USER -d $DATABASE_NAME < docker/init-postgresql-db.sql"
                    fi
                fi
            fi
        else
            print_warning "PostgreSQL 容器未运行，将在启动时自动初始化"
        fi
    fi
}

# 主函数
main() {
    # 显示欢迎信息
    clear
    print_title "PIS 一键部署向导"

    echo ""
    echo -e "${BOLD}本脚本将引导你完成 PIS 的部署配置${NC}"
    echo ""
    echo -e "${YELLOW}部署前请确保:${NC}"
    echo "  • 已安装 Docker 和 Docker Compose"
    echo "  • 服务器端口 80 和 443 可用"
    echo "  • 域名已解析到服务器（如果使用域名）"
    echo ""

    if ! get_confirm "是否继续？" "y"; then
        echo "部署已取消"
        exit 0
    fi

    # 执行部署步骤
    check_docker
    configure_deployment_mode
    configure_domain
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        configure_postgresql
    else
        configure_supabase
    fi
    configure_minio
    configure_worker
    configure_security
    configure_alerts
    generate_config
    
    # 检查并初始化数据库
    check_and_init_database
    
    show_completion_info
}

# 运行主函数
main
