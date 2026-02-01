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
        read -p "$(echo -e "${GREEN}${prompt}${NC}" [$default]): " result
        echo "${result:-$default}"
    else
        read -p "$(echo -e "${GREEN}${prompt}${NC}"): " result
        echo "$result"
    fi
}

# 获取确认
get_confirm() {
    local prompt="$1"
    local default="${2:-n}"

    while true; do
        local result
        echo -ne "${GREEN}${prompt}${NC} [y/n]: "
        read result
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
    print_step "1/11" "检查 Docker 环境"

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
    print_step "2/11" "部署架构配置"

    echo ""
    echo -e "${BOLD}请选择部署架构：${NC}"
    echo ""
    echo "  1) 完全自托管（推荐）"
    echo "     - 前端: 自托管（Docker，Next.js 集成代理）"
    echo "     - 数据库: PostgreSQL（自托管）"
    echo "     - 存储/Worker: 你的服务器"
    echo ""
    echo "  2) 混合部署（向后兼容）"
    echo "     - 前端: Vercel（自动部署）"
    echo "     - 数据库: Supabase Cloud"
    echo "     - 存储/Worker: 你的服务器"
    echo ""
    
    echo -ne "${GREEN}请选择 [1/2，默认: 1]${NC}: "
    read mode_choice
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
    print_step "3/11" "配置域名"

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
        # 在 standalone 模式下，所有服务都通过 Web 容器的 8081 端口访问
    if [ "$DOMAIN" = "localhost" ]; then
        # 本地测试：使用 8081 端口（Web 容器暴露的端口）
        APP_URL="http://localhost:8081"
        MEDIA_URL="http://localhost:8081/media"
        WORKER_URL="http://localhost:8081/worker-api"
    else
        # 生产环境：使用域名（通过 Next.js 路径访问）
        APP_URL="https://$DOMAIN"
        MEDIA_URL="https://$DOMAIN/media"
        WORKER_URL="https://$DOMAIN/worker-api"
    fi
}


# 配置 PostgreSQL（完全自托管模式）
configure_postgresql() {
    print_step "4/11" "配置 PostgreSQL 数据库"

    echo ""
    echo -e "${CYAN}PostgreSQL 数据库配置${NC}"
    echo ""

    DATABASE_HOST=$(get_input "数据库主机" "localhost")
    DATABASE_PORT=$(get_input "数据库端口" "5432")
    DATABASE_NAME=$(get_input "数据库名称" "pis")
    DATABASE_USER=$(get_input "数据库用户" "pis")
    DATABASE_PASSWORD=$(get_input "数据库密码 (留空自动生成)" "")
    
    if [ -z "$DATABASE_PASSWORD" ]; then
        DATABASE_PASSWORD=$(generate_secret | cut -c1-32)
        print_success "已自动生成数据库密码"
    fi

    # 自动生成 JWT Secret（不询问用户）
    AUTH_JWT_SECRET=$(generate_secret)
    print_success "已自动生成 JWT Secret"

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

# 配置 Supabase（混合部署）
configure_supabase() {
    print_step "4/11" "配置 Supabase"

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

# 配置 MinIO
configure_minio() {
    print_step "5/11" "配置 MinIO 对象存储"

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
    print_step "6/11" "配置 Worker API"

    WORKER_API_KEY=$(get_input "Worker API 密钥 (留空自动生成)" "")
    if [ -z "$WORKER_API_KEY" ]; then
        WORKER_API_KEY=$(generate_secret)
        print_success "已生成 Worker API 密钥"
    fi

    print_success "Worker API 已配置"
}

# 配置安全密钥
configure_security() {
    print_step "7/11" "配置安全密钥"

    ALBUM_SESSION_SECRET=$(get_input "相册会话密钥 (留空自动生成)" "")
    if [ -z "$ALBUM_SESSION_SECRET" ]; then
        ALBUM_SESSION_SECRET=$(generate_secret)
        print_success "已生成会话密钥"
    fi

    print_success "安全密钥已配置"
}

# 配置告警（可选）
configure_alerts() {
    print_step "8/11" "配置告警服务（可选）"

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
    print_step "9/11" "生成配置并部署"

    # 环境文件应该在项目根目录，而不是 docker 目录
    local env_file="$PROJECT_ROOT/.env.generated"
    local env_target="$PROJECT_ROOT/.env"

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

        # 复制为 .env（在项目根目录）
        cp "$env_file" "$env_target"
        print_success "配置已保存到 $env_target"

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
            echo "  c. 创建管理员账号:"
            echo "     - ✅ 部署脚本会自动引导创建（推荐）"
            echo "     - 或手动执行: pnpm create-admin"
            echo ""
            echo -e "${GREEN}4. 配置 SSL（可选）${NC}"
            echo ""
            echo "SSL/TLS 由内网穿透服务（frpc/ddnsto）处理，无需在容器内配置。"
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
    {
        cat << EOF
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
EOF
        if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
            cat << EOF
数据库类型: PostgreSQL
数据库主机: $DATABASE_HOST
数据库端口: $DATABASE_PORT
数据库名称: $DATABASE_NAME
数据库用户: $DATABASE_USER
JWT Secret: $AUTH_JWT_SECRET
EOF
        else
            cat << EOF
数据库类型: Supabase
Supabase URL: $SUPABASE_URL
Supabase Anon Key: $SUPABASE_ANON_KEY
Supabase Service Key: $SUPABASE_SERVICE_KEY
EOF
        fi
    } > .deployment-info

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
    
    # 显示各服务登录信息
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  服务访问信息${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Web 管理后台
    echo -e "${BOLD}1. Web 管理后台${NC}"
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        if [ "$DOMAIN" != "localhost" ]; then
            echo "   访问地址: https://$DOMAIN/admin/login"
        fi
        echo "   访问地址: http://localhost:8081/admin/login"
        if [ -n "$ADMIN_EMAIL" ]; then
            echo "   登录邮箱: $ADMIN_EMAIL"
            if [ -n "$ADMIN_PASSWORD" ]; then
                echo "   登录密码: $ADMIN_PASSWORD"
            else
                echo -e "   ${CYAN}密码: 首次登录时设置${NC}"
                echo -e "   ${CYAN}提示: 访问登录页面后，系统会提示您设置初始密码${NC}"
            fi
        else
            echo -e "   ${YELLOW}⚠️  请使用 'pnpm create-admin' 创建管理员账号${NC}"
        fi
    else
        echo "   访问地址: https://$DOMAIN/admin/login"
        echo -e "   ${YELLOW}⚠️  请在 Supabase Dashboard 中创建管理员账号${NC}"
    fi
    echo ""
    
    # MinIO Console
    echo -e "${BOLD}2. MinIO 对象存储控制台${NC}"
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        if [ "$DOMAIN" != "localhost" ]; then
            echo "   访问地址: https://$DOMAIN/minio-console/"
        fi
        echo "   访问地址: http://localhost:8081/minio-console/"
    else
        echo "   访问地址: http://localhost:19001"
    fi
    echo "   登录用户名: $MINIO_ACCESS_KEY"
    echo "   登录密码: $MINIO_SECRET_KEY"
    echo ""
    
    # PostgreSQL（仅 standalone 模式）
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        echo -e "${BOLD}3. PostgreSQL 数据库${NC}"
        echo "   容器内连接:"
        echo "     主机: postgres"
        echo "     端口: ${DATABASE_PORT:-5432}"
        echo "     数据库: ${DATABASE_NAME:-pis}"
        echo "     用户: ${DATABASE_USER:-pis}"
        echo "     密码: $DATABASE_PASSWORD"
        echo ""
        echo "   宿主机连接:"
        echo "     主机: localhost"
        echo "     端口: ${DATABASE_PORT:-5432}"
        echo "     数据库: ${DATABASE_NAME:-pis}"
        echo "     用户: ${DATABASE_USER:-pis}"
        echo "     密码: $DATABASE_PASSWORD"
        echo ""
        echo "   连接命令:"
        echo "     docker exec -it pis-postgres psql -U ${DATABASE_USER:-pis} -d ${DATABASE_NAME:-pis}"
        echo "     或: psql -h localhost -p ${DATABASE_PORT:-5432} -U ${DATABASE_USER:-pis} -d ${DATABASE_NAME:-pis}"
        echo ""
    fi
    
    # Redis
    echo -e "${BOLD}$([ "$DEPLOYMENT_MODE" = "standalone" ] && echo "4" || echo "3"). Redis 缓存${NC}"
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        echo "   容器内连接:"
        echo "     主机: redis"
        echo "     端口: 6379"
        echo ""
        echo "   宿主机连接（仅本地）:"
        echo "     主机: localhost"
        echo "     端口: 6379"
        echo ""
        echo "   连接命令:"
        echo "     docker exec -it pis-redis redis-cli"
    else
        echo "   容器内连接:"
        echo "     主机: redis"
        echo "     端口: 6379"
        echo ""
        echo "   宿主机连接（仅本地）:"
        echo "     主机: localhost"
        echo "     端口: 16379"
        echo ""
        echo "   连接命令:"
        echo "     docker exec -it pis-redis redis-cli"
        echo "     或: redis-cli -h localhost -p 16379"
    fi
    echo ""
    
    # Worker API
    echo -e "${BOLD}$([ "$DEPLOYMENT_MODE" = "standalone" ] && echo "5" || echo "4"). Worker API${NC}"
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        if [ "$DOMAIN" != "localhost" ]; then
            echo "   访问地址: https://$DOMAIN/worker-api/"
        fi
        echo "   访问地址: http://localhost:8081/worker-api/"
    else
        echo "   访问地址: http://localhost:3001"
    fi
    echo "   API Key: $WORKER_API_KEY"
    echo ""
    
    # 配置文件位置
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  配置文件位置${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  - .env"
    echo "  - .deployment-info"
    echo ""
    echo -e "${YELLOW}⚠️  请妥善保管以上登录信息，不要泄露给他人！${NC}"
    echo ""
    
    # 常用命令
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  常用命令${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  查看状态: cd $DOCKER_DIR && $COMPOSE_CMD ps"
    echo "  查看日志: cd $DOCKER_DIR && $COMPOSE_CMD logs -f"
    echo "  重启服务: cd $DOCKER_DIR && $COMPOSE_CMD restart"
    echo "  停止服务: cd $DOCKER_DIR && $COMPOSE_CMD down"
    echo ""
    
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        echo "  创建管理员: pnpm create-admin"
        echo "  查看数据库: docker exec -it pis-postgres psql -U ${DATABASE_USER:-pis} -d ${DATABASE_NAME:-pis}"
        echo ""
    fi
    
    echo -e "${CYAN}如需重新配置，请运行: bash docker/deploy.sh${NC}"
    echo ""
}

# 检查并初始化数据库（仅 Docker 内数据库）
check_and_init_database() {
    if [ "$DEPLOYMENT_MODE" != "standalone" ]; then
        return 0
    fi
    
    # 检查是否使用 Docker 内的数据库
    if [ "$DATABASE_HOST" = "localhost" ] || [ "$DATABASE_HOST" = "127.0.0.1" ] || [ "$DATABASE_HOST" = "postgres" ]; then
        print_step "10/11" "检查数据库初始化状态"
        
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

# 创建管理员账号（自动化）
create_admin_account() {
    if [ "$DEPLOYMENT_MODE" != "standalone" ]; then
        return 0
    fi
    
    print_step "11/11" "创建管理员账号"
    
    echo ""
    echo -e "${CYAN}需要创建管理员账号才能访问管理后台${NC}"
    echo ""
    
    # 检查是否已有管理员账号
    local admin_exists=false
    if docker ps | grep -q "pis-postgres"; then
        local admin_count=$(docker exec pis-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -tAc "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>/dev/null || echo "0")
        if [ "$admin_count" -gt 0 ] 2>/dev/null; then
            admin_exists=true
            echo -e "${GREEN}✓ 检测到已有管理员账号（$admin_count 个）${NC}"
            echo ""
            if ! get_confirm "是否创建新的管理员账号？" "n"; then
                print_success "跳过创建管理员账号"
                return 0
            fi
        fi
    fi
    
    if [ "$admin_exists" = false ]; then
        echo -e "${YELLOW}⚠️  首次部署必须创建管理员账号${NC}"
        echo ""
        echo -e "${CYAN}正在创建管理员账号...${NC}"
        
        # 自动生成管理员账号（首次部署，密码为空，首次登录时设置）
        ADMIN_EMAIL="admin@${DOMAIN:-localhost}"
        if [ "$DOMAIN" = "localhost" ]; then
            ADMIN_EMAIL="admin@example.com"
        fi
        # 不设置密码，让用户首次登录时设置
        ADMIN_PASSWORD=""
        
        echo -e "${GREEN}✓ 已创建管理员账号${NC}"
        echo ""
        echo -e "${GREEN}管理员账号信息：${NC}"
        echo "  邮箱: $ADMIN_EMAIL"
        echo "  密码: 首次登录时设置"
        echo ""
        echo -e "${CYAN}📝 提示：${NC}"
        echo "  1. 访问登录页面后，输入邮箱地址"
        echo "  2. 系统会提示您设置初始密码"
        echo "  3. 设置完成后即可登录管理后台"
        echo ""
        
        # 导出变量以便在其他函数中使用
        export ADMIN_EMAIL ADMIN_PASSWORD
    else
        # 已有管理员账号，询问是否创建新的
        echo -e "${CYAN}是否创建新的管理员账号？${NC}"
        echo ""
        ADMIN_EMAIL=$(get_input "管理员邮箱" "admin@example.com")
        ADMIN_PASSWORD=$(get_input "管理员密码（至少 8 个字符，留空自动生成）" "")
        
        # 导出变量以便在其他函数中使用
        export ADMIN_EMAIL ADMIN_PASSWORD
        
        if [ -z "$ADMIN_PASSWORD" ]; then
            ADMIN_PASSWORD=$(generate_secret | cut -c1-16)
            echo -e "${GREEN}✓ 已自动生成密码: ${ADMIN_PASSWORD}${NC}"
            echo -e "${YELLOW}⚠️  请妥善保管此密码！${NC}"
        fi
        
        # 验证密码长度
        if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
            print_error "密码至少需要 8 个字符"
            exit 1
        fi
    fi
    
    echo ""
    echo -e "${CYAN}正在创建管理员账号...${NC}"
    
    # 等待 Web 容器启动（增加等待时间，因为首次启动需要构建镜像）
    local max_attempts=60  # 增加到 60 次（120 秒）
    local attempt=0
    echo "等待 Web 容器启动（首次启动可能需要较长时间构建镜像）..."
    while [ $attempt -lt $max_attempts ]; do
        # 检查容器是否存在且状态为运行中
        if docker ps --format '{{.Names}}\t{{.Status}}' | grep -q "pis-web.*Up"; then
            # 再等待几秒确保容器完全就绪
            sleep 5
            break
        fi
        # 每 10 次显示一次进度
        if [ $((attempt % 10)) -eq 0 ] && [ $attempt -gt 0 ]; then
            echo "等待 Web 容器启动... ($attempt/$max_attempts) - 这可能需要几分钟时间..."
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_warning "Web 容器启动超时（已等待 120 秒）"
        echo ""
        echo -e "${YELLOW}可能的原因：${NC}"
        echo "  1. 首次启动需要构建镜像，可能需要更长时间"
        echo "  2. 容器启动失败，请检查日志: docker logs pis-web"
        echo ""
        echo -e "${CYAN}建议：${NC}"
        echo "  1. 查看容器状态: docker ps -a | grep pis-web"
        echo "  2. 查看容器日志: docker logs pis-web"
        echo "  3. 等待容器完全启动后，手动执行: pnpm create-admin"
        echo ""
        create_admin_on_host
        return 0
    fi
    
    # 在 Web 容器内执行创建管理员脚本（使用 Docker 内部网络）
    echo "在 Web 容器内创建管理员账号..."
    
    # 方法1: 优先使用独立的脚本文件（更可靠）
    if [ -f "$SCRIPT_DIR/../scripts/utils/create-admin-inline.js" ]; then
        echo "使用独立脚本创建管理员账号..."
        # 如果密码为空，传递空字符串，脚本会创建密码为空的管理员
        local password_arg="${ADMIN_PASSWORD:-}"
        if docker cp "$PROJECT_ROOT/scripts/utils/create-admin-inline.js" pis-web:/tmp/create-admin.js 2>/dev/null && \
           docker exec pis-web node /tmp/create-admin.js "$ADMIN_EMAIL" "$password_arg" "postgres" "5432" "${DATABASE_NAME:-pis}" "${DATABASE_USER:-pis}" "$DATABASE_PASSWORD" 2>&1; then
            docker exec pis-web rm -f /tmp/create-admin.js 2>/dev/null || true
            print_success "管理员账号创建成功！"
            echo ""
            echo -e "${GREEN}═══════════════════════════════════════${NC}"
            echo -e "${GREEN}  管理员账号信息${NC}"
            echo -e "${GREEN}═══════════════════════════════════════${NC}"
            echo ""
            echo -e "${BOLD}邮箱:${NC} $ADMIN_EMAIL"
            if [ -n "$ADMIN_PASSWORD" ]; then
                echo -e "${BOLD}密码:${NC} $ADMIN_PASSWORD"
                echo ""
                echo -e "${YELLOW}⚠️  请妥善保管以上信息！${NC}"
            else
                echo -e "${BOLD}密码:${NC} 首次登录时设置"
                echo ""
                echo -e "${CYAN}📝 提示：${NC}"
                echo "  访问登录页面后，输入邮箱地址"
                echo "  系统会提示您设置初始密码"
            fi
            echo ""
            echo -e "${CYAN}登录地址：${NC}"
            if [ "$DOMAIN" != "localhost" ]; then
                echo "  https://$DOMAIN/admin/login"
            fi
            echo "  http://localhost:8081/admin/login"
            echo ""
            return 0
        fi
        docker exec pis-web rm -f /tmp/create-admin.js 2>/dev/null || true
    fi
    
    # 方法2: 使用 Node.js 内联代码（回退方案）
    echo "使用 Node.js 内联代码创建管理员账号..."
    
    # 转义特殊字符（用于 SQL 和 shell）
    ADMIN_EMAIL_ESC=$(echo "$ADMIN_EMAIL" | sed "s/'/''/g" | sed 's/\\/\\\\/g')
    ADMIN_PASSWORD_ESC=$(echo "$ADMIN_PASSWORD" | sed "s/'/''/g" | sed 's/\\/\\\\/g')
    DB_PASSWORD_ESC=$(echo "$DATABASE_PASSWORD" | sed "s/'/''/g" | sed 's/\\/\\\\/g')
    
    # 使用 Node.js 创建管理员账号
    # 注意：standalone 模式下，node_modules 可能在 /app/.next/standalone/node_modules
    if docker exec pis-web sh -c "cd /app && NODE_PATH=/app/.next/standalone/node_modules:/app/node_modules:/app/apps/web/node_modules node -e \"
const crypto = require('crypto');
const { promisify } = require('util');
const pbkdf2 = promisify(crypto.pbkdf2);
const { Client } = require('pg');

(async () => {
  const email = '$ADMIN_EMAIL_ESC';
  const password = '$ADMIN_PASSWORD_ESC';
  
  // 连接数据库
  const client = new Client({
    host: 'postgres',
    port: 5432,
    database: '${DATABASE_NAME:-pis}',
    user: '${DATABASE_USER:-pis}',
    password: '$DB_PASSWORD_ESC'
  });
  
  await client.connect();
  
  try {
    // 检查用户是否存在
    const checkResult = await client.query('SELECT id FROM users WHERE email = \$1', [email.toLowerCase()]);
    
    if (checkResult.rows.length > 0) {
      // 用户已存在，更新密码（如果提供了密码）
      if (password && password.trim() !== '') {
        // 哈希密码
        const salt = crypto.randomBytes(32).toString('hex');
        const iterations = 100000;
        const keylen = 64;
        const digest = 'sha512';
        const derivedKey = await pbkdf2(password, salt, iterations, keylen, digest);
        const passwordHash = \`\${salt}:\${iterations}:\${derivedKey.toString('hex')}\`;
        await client.query('UPDATE users SET password_hash = \$1, updated_at = NOW() WHERE email = \$2', [passwordHash, email.toLowerCase()]);
        console.log('✅ 管理员密码已更新');
      } else {
        console.log('✅ 管理员账户已存在（密码未设置，首次登录时设置）');
      }
    } else {
      // 创建新用户
      let passwordHash = null;
      if (password && password.trim() !== '') {
        // 哈希密码
        const salt = crypto.randomBytes(32).toString('hex');
        const iterations = 100000;
        const keylen = 64;
        const digest = 'sha512';
        const derivedKey = await pbkdf2(password, salt, iterations, keylen, digest);
        passwordHash = \`\${salt}:\${iterations}:\${derivedKey.toString('hex')}\`;
      }
      // password_hash 允许为 NULL，表示首次登录需要设置密码
      await client.query(
        'INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at) VALUES (\$1, \$2, \$3, \$4, NOW(), NOW())',
        [email.toLowerCase(), passwordHash, 'admin', true]
      );
      if (passwordHash) {
        console.log('✅ 管理员账户创建成功！');
      } else {
        console.log('✅ 管理员账户创建成功！（首次登录时设置密码）');
      }
    }
    console.log(\`   邮箱: \${email}\`);
  } finally {
    await client.end();
  }
})().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
" 2>&1; then
        print_success "管理员账号创建成功！"
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo -e "${GREEN}  管理员账号信息${NC}"
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo ""
        echo -e "${BOLD}邮箱:${NC} $ADMIN_EMAIL"
        if [ -n "$ADMIN_PASSWORD" ]; then
            echo -e "${BOLD}密码:${NC} $ADMIN_PASSWORD"
            echo ""
            echo -e "${YELLOW}⚠️  请妥善保管以上信息！${NC}"
        else
            echo -e "${BOLD}密码:${NC} 首次登录时设置"
            echo ""
            echo -e "${CYAN}📝 提示：${NC}"
            echo "  访问登录页面后，输入邮箱地址"
            echo "  系统会提示您设置初始密码"
        fi
        echo ""
        echo -e "${CYAN}登录地址：${NC}"
        if [ "$DOMAIN" != "localhost" ]; then
            echo "  https://$DOMAIN/admin/login"
        fi
        echo "  http://localhost:8081/admin/login"
        echo ""
    else
        print_warning "在容器内创建失败，尝试在宿主机执行..."
        create_admin_on_host
    fi
}

# 在宿主机创建管理员账号（回退方案）
create_admin_on_host() {
    echo ""
    echo -e "${YELLOW}Web 容器未运行，尝试在宿主机执行...${NC}"
    
    # 检查是否能访问数据库
    if [ "$DATABASE_HOST" = "postgres" ] || [ "$DATABASE_HOST" = "localhost" ] || [ "$DATABASE_HOST" = "127.0.0.1" ]; then
        # 使用 Docker 网络地址
        local db_host="postgres"
        if ! docker ps | grep -q "pis-postgres"; then
            db_host="localhost"
        fi
    else
        db_host="$DATABASE_HOST"
    fi
    
    # 临时修改环境变量以连接数据库
    export DATABASE_HOST="$db_host"
    export DATABASE_PORT="${DATABASE_PORT:-5432}"
    export DATABASE_NAME="${DATABASE_NAME:-pis}"
    export DATABASE_USER="${DATABASE_USER:-pis}"
    # 使用实际配置的密码，如果没有则提示错误
    if [ -z "$DATABASE_PASSWORD" ]; then
        print_error "数据库密码未配置，无法创建管理员账号"
        echo ""
        echo -e "${YELLOW}请手动创建管理员账号：${NC}"
        echo "  1. 启动所有服务后执行："
        echo "     $ cd $PROJECT_ROOT"
        echo "     $ pnpm create-admin"
        echo ""
        echo "  2. 或使用 Docker 容器执行："
        echo "     $ docker exec -it pis-web pnpm create-admin"
        return 1
    fi
    export DATABASE_PASSWORD="$DATABASE_PASSWORD"
    
    # 在项目根目录执行脚本
    if [ -f "$PROJECT_ROOT/scripts/utils/create-admin.ts" ]; then
        if cd "$PROJECT_ROOT" && pnpm exec tsx scripts/utils/create-admin.ts "$ADMIN_EMAIL" "$ADMIN_PASSWORD" 2>/dev/null; then
            print_success "管理员账号创建成功！"
            echo ""
            echo -e "${GREEN}管理员信息：${NC}"
            echo "  邮箱: $ADMIN_EMAIL"
            echo "  密码: $ADMIN_PASSWORD"
            echo ""
            echo -e "${CYAN}登录地址：${NC}"
            echo "  http://$DOMAIN/admin/login"
            echo "  或 http://localhost:8081/admin/login"
        else
            print_error "创建管理员账号失败"
            echo ""
            echo -e "${YELLOW}请手动创建管理员账号：${NC}"
            echo "  1. 启动所有服务后执行："
            echo "     $ cd $PROJECT_ROOT"
            echo "     $ pnpm create-admin"
            echo ""
            echo "  2. 或使用 Docker 容器执行："
            echo "     $ docker exec -it pis-web pnpm create-admin"
        fi
    else
        print_error "找不到创建管理员脚本"
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
    echo "  • 服务器端口 8081 可用（HTTP 访问端口）"
    echo "  • 域名已解析到服务器（如果使用域名和 SSL）"
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
    
    # 启动服务（在 standalone 模式下）
    if [ "$DEPLOYMENT_MODE" = "standalone" ]; then
        echo ""
        print_step "10/11" "启动服务"
        echo ""
        
        cd "$DOCKER_DIR"
        
        # 检查是否有旧容器冲突（所有容器都使用 pis- 前缀）
        echo -e "${CYAN}检查是否有旧容器...${NC}"
        local conflicting_containers=$(docker ps -a --format '{{.Names}}' | grep -E '^pis-(web|postgres|minio|minio-init|redis|worker)$' || true)
        
        if [ -n "$conflicting_containers" ]; then
            print_warning "发现已存在的容器："
            echo "$conflicting_containers" | sed 's/^/  - /'
            echo ""
            
            if get_confirm "是否停止并删除旧容器？" "y"; then
                echo "正在停止并删除旧容器..."
                echo "$conflicting_containers" | xargs -r docker stop 2>/dev/null || true
                echo "$conflicting_containers" | xargs -r docker rm 2>/dev/null || true
                print_success "旧容器已清理"
            else
                print_warning "保留旧容器，如果启动失败请手动清理"
            fi
            echo ""
        fi
        
        echo -e "${CYAN}正在启动 Docker 服务...${NC}"
        if $COMPOSE_CMD -f docker-compose.standalone.yml up -d 2>&1 | tee /tmp/docker-startup.log; then
            print_success "服务启动成功"
        else
            print_error "服务启动失败，请检查日志"
            echo ""
            echo -e "${YELLOW}故障排查：${NC}"
            echo "  1. 查看启动日志: cat /tmp/docker-startup.log"
            echo "  2. 查看容器状态: docker ps -a"
            echo "  3. 查看容器日志: docker logs <容器名>"
            echo "  4. 手动清理冲突容器: docker rm -f pis-web pis-postgres pis-minio pis-minio-init pis-redis pis-worker"
            exit 1
        fi
        
        # 等待服务就绪
        echo ""
        echo -e "${CYAN}等待服务就绪...${NC}"
        sleep 10
        
        # 检查并初始化数据库
        check_and_init_database
        
        # 创建管理员账号（自动化）
        create_admin_account
    else
        # 混合部署模式：只启动基础服务
        echo ""
        print_step "10/11" "启动基础服务"
        echo ""
        echo -e "${CYAN}正在启动 Docker 基础服务...${NC}"
        
        cd "$DOCKER_DIR"
        if $COMPOSE_CMD up -d 2>&1 | tee /tmp/docker-startup.log; then
            print_success "基础服务启动成功"
        else
            print_error "服务启动失败，请检查日志"
            exit 1
        fi
    fi
    
    show_completion_info
}

# 运行主函数
main
