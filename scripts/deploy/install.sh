#!/bin/bash
# ============================================
# PIS 一键安装脚本
# 
# 使用方法（复制粘贴到终端执行）：
# curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/deploy/install.sh | bash
# 
# 或者（国内用户）：
# curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/pis-standalone/main/scripts/deploy/install.sh | bash
# ============================================

# 自动清理 Windows 行尾（CRLF -> LF）
if command -v tr >/dev/null 2>&1; then
    # 如果脚本包含 CR 字符，重新执行清理后的版本
    if grep -q $'\r' "$0" 2>/dev/null; then
        tr -d '\r' < "$0" | bash -s "$@"
        exit $?
    fi
fi

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# 打印带颜色的消息
print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}📸 PIS - Private Instant Photo Sharing${NC}                    ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}     专为摄影师打造的私有化照片交付系统                     ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

# 检查系统要求
check_requirements() {
    echo -e "${CYAN}正在检查系统要求...${NC}"
    echo ""

    local missing=0

    # 检查 Docker
    if check_command docker; then
        print_success "Docker 已安装: $(docker --version | head -1)"
    else
        print_error "Docker 未安装"
        echo "    请访问 https://docs.docker.com/get-docker/ 安装 Docker"
        missing=1
    fi

    # 检查 Docker Compose
    if check_command docker-compose || docker compose version &> /dev/null; then
        if docker compose version &> /dev/null; then
            print_success "Docker Compose 已安装: $(docker compose version | head -1)"
        else
            print_success "Docker Compose 已安装: $(docker-compose --version | head -1)"
        fi
    else
        print_error "Docker Compose 未安装"
        echo "    请访问 https://docs.docker.com/compose/install/ 安装 Docker Compose"
        missing=1
    fi

    # 检查 Git
    if check_command git; then
        print_success "Git 已安装: $(git --version)"
    else
        print_error "Git 未安装"
        echo "    请安装 Git: apt install git / yum install git / brew install git"
        missing=1
    fi

    # 检查 curl
    if check_command curl; then
        print_success "curl 已安装"
    else
        print_warning "curl 未安装（可选，用于健康检查）"
    fi

    echo ""

    if [ $missing -eq 1 ]; then
        print_error "缺少必要的依赖，请先安装后再运行此脚本"
        exit 1
    fi

    print_success "系统要求检查通过！"
    echo ""
}

# 选择安装目录
choose_install_dir() {
    local default_dir="/opt/pis"
    
    echo -e "${CYAN}请选择安装目录${NC}"
    echo -e "默认: ${YELLOW}$default_dir${NC}"
    echo ""
    
    # 如果在交互式终端中运行，询问用户
    if is_interactive; then
        read -p "安装目录 (按 Enter 使用默认): " install_dir
    else
        install_dir=""
        print_info "使用默认安装目录: $default_dir"
    fi
    
    if [ -z "$install_dir" ]; then
        install_dir="$default_dir"
    fi

    # 展开 ~ 到 $HOME
    install_dir="${install_dir/#\~/$HOME}"

    # 检查目录是否已存在
    if [ -d "$install_dir" ]; then
        print_warning "目录 $install_dir 已存在"
        if is_interactive; then
            read -p "是否覆盖？(y/N): " overwrite
            if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
                print_info "安装已取消"
                exit 0
            fi
        else
            print_warning "非交互模式，自动覆盖已存在的目录"
        fi
        rm -rf "$install_dir"
    fi

    INSTALL_DIR="$install_dir"
    print_success "安装目录: $INSTALL_DIR"
    echo ""
}

# 克隆代码
clone_repo() {
    echo -e "${CYAN}正在克隆代码...${NC}"
    
    # 尝试使用 GitHub 代理（国内用户）
    local repo_url="https://github.com/JunyuZhan/pis-standalone.git"
    local proxy_url="https://ghproxy.com/https://github.com/JunyuZhan/pis-standalone.git"
    
    # 先尝试直接克隆
    if git clone --depth 1 "$repo_url" "$INSTALL_DIR" 2>/dev/null; then
        print_success "代码克隆成功"
    else
        print_warning "直接克隆失败，尝试使用代理..."
        if git clone --depth 1 "$proxy_url" "$INSTALL_DIR" 2>/dev/null; then
            print_success "代码克隆成功（通过代理）"
        else
            print_error "代码克隆失败，请检查网络连接"
            exit 1
        fi
    fi
    echo ""
}

# 运行部署脚本
run_deploy() {
    echo -e "${CYAN}正在启动部署向导...${NC}"
    echo ""
    
    cd "$INSTALL_DIR/docker"
    
    # 给部署脚本执行权限
    chmod +x deploy.sh
    
    # 运行部署脚本
    bash deploy.sh
}

# 检查是否在交互式终端中运行
is_interactive() {
    [ -t 0 ] && [ -t 1 ]
}

# 主函数
main() {
    print_header
    
    echo -e "${YELLOW}此脚本将帮助你一键安装 PIS 照片分享系统${NC}"
    echo ""
    echo "安装过程："
    echo "  1. 检查系统要求（Docker、Git）"
    echo "  2. 克隆代码到本地"
    echo "  3. 运行部署向导"
    echo ""
    
    # 如果在交互式终端中运行，询问用户确认
    if is_interactive; then
        read -p "是否继续？(Y/n): " confirm
        if [ "$confirm" = "n" ] || [ "$confirm" = "N" ]; then
            print_info "安装已取消"
            exit 0
        fi
    else
        print_info "非交互模式，自动继续..."
    fi
    echo ""

    check_requirements
    choose_install_dir
    clone_repo
    run_deploy
}

# 运行主函数
main
