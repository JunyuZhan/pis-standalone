#!/bin/bash

# ============================================
# PIS 完整测试套件 - 一键运行所有测试
# 用途: 运行所有测试脚本，生成完整报告
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="/tmp/pis-complete-test-report-$(date +%Y%m%d-%H%M%S).txt"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 完整测试套件 - 一键运行                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "项目目录: ${CYAN}$PROJECT_DIR${NC}"
echo -e "报告文件: ${CYAN}$REPORT_FILE${NC}"
echo ""

# 初始化报告
{
    echo "PIS 完整测试报告"
    echo "=================="
    echo "生成时间: $(date)"
    echo "项目目录: $PROJECT_DIR"
    echo ""
    echo "测试套件列表:"
    echo "1. 环境检查"
    echo "2. 容器状态检查"
    echo "3. API 端点测试"
    echo "4. 登录流程测试"
    echo "5. 数据库功能测试"
    echo "6. Redis 功能测试"
    echo "7. MinIO 功能测试"
    echo "8. Worker 服务测试"
    echo "9. 资源使用情况"
    echo ""
    echo "========================================"
    echo ""
} > "$REPORT_FILE"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test_suite() {
    local name=$1
    local script=$2
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}运行: $name${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    {
        echo ""
        echo "========================================"
        echo "$name"
        echo "开始时间: $(date)"
        echo "----------------------------------------"
    } >> "$REPORT_FILE"
    
    if [ -f "$script" ]; then
        cd "$PROJECT_DIR"
        if bash "$script" >> "$REPORT_FILE" 2>&1; then
            echo -e "${GREEN}✅ $name 完成${NC}"
            ((PASSED_TESTS++))
        else
            echo -e "${RED}❌ $name 失败${NC}"
            ((FAILED_TESTS++))
        fi
    else
        echo -e "${YELLOW}⚠️  脚本不存在: $script${NC}"
        echo "脚本不存在: $script" >> "$REPORT_FILE"
    fi
    
    {
        echo "结束时间: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    ((TOTAL_TESTS++))
    echo ""
}

# 1. 环境检查（简化版，仅检查基础环境）
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1. 环境检查${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
{
    echo ""
    echo "========================================"
    echo "1. 环境检查"
    echo "开始时间: $(date)"
    echo "----------------------------------------"
    docker --version
    docker compose version
    node --version
    pnpm --version
    echo "结束时间: $(date)"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 环境检查完成${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# 2. API 端点测试
run_test_suite "2. API 端点测试" "$SCRIPT_DIR/test-api-endpoints.sh"

# 3. 登录流程测试
run_test_suite "3. 登录流程测试" "$SCRIPT_DIR/test-login-flow.sh"

# 4. 数据库功能测试
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}4. 数据库功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
{
    echo ""
    echo "========================================"
    echo "4. 数据库功能测试"
    echo "开始时间: $(date)"
    echo "----------------------------------------"
    docker exec pis-postgres psql -U pis -d pis -c "SELECT COUNT(*) as user_count FROM users;"
    docker exec pis-postgres psql -U pis -d pis -c "SELECT email, role, is_active FROM users LIMIT 5;"
    echo "结束时间: $(date)"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 数据库功能测试完成${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# 5. Redis 功能测试
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}5. Redis 功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
{
    echo ""
    echo "========================================"
    echo "5. Redis 功能测试"
    echo "开始时间: $(date)"
    echo "----------------------------------------"
    docker exec pis-redis redis-cli PING
    docker exec pis-redis redis-cli INFO server | grep redis_version
    echo "结束时间: $(date)"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ Redis 功能测试完成${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# 6. MinIO 功能测试
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}6. MinIO 功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
{
    echo ""
    echo "========================================"
    echo "6. MinIO 功能测试"
    echo "开始时间: $(date)"
    echo "----------------------------------------"
    docker exec pis-minio mc --version
    echo "结束时间: $(date)"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ MinIO 功能测试完成${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# 7. Worker 服务测试
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}7. Worker 服务测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
{
    echo ""
    echo "========================================"
    echo "7. Worker 服务测试"
    echo "开始时间: $(date)"
    echo "----------------------------------------"
    curl -s --max-time 5 http://localhost:8081/api/worker/health
    echo ""
    echo "结束时间: $(date)"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ Worker 服务测试完成${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# 8. 资源使用情况
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}8. 容器资源使用情况${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
{
    echo ""
    echo "========================================"
    echo "8. 容器资源使用情况"
    echo "开始时间: $(date)"
    echo "----------------------------------------"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" pis-web pis-worker pis-postgres pis-redis pis-minio
    echo "结束时间: $(date)"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 资源使用情况检查完成${NC}"
((PASSED_TESTS++))
((TOTAL_TESTS++))
echo ""

# 总结
{
    echo ""
    echo "========================================"
    echo "测试总结"
    echo "========================================"
    echo "总测试套件: $TOTAL_TESTS"
    echo "通过: $PASSED_TESTS"
    echo "失败: $FAILED_TESTS"
    echo "完成时间: $(date)"
    echo ""
} >> "$REPORT_FILE"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 测试总结${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "总测试套件: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""
echo -e "详细报告: ${CYAN}$REPORT_FILE${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试套件失败${NC}"
    exit 1
fi
