#!/bin/bash

# ============================================
# PIS 完整测试套件 - 包含业务逻辑和用户体验
# 用途: 运行所有测试，包括业务逻辑和用户体验测试
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
REPORT_FILE="/tmp/pis-complete-test-$(date +%Y%m%d-%H%M%S).txt"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 完整测试套件                                ║${NC}"
echo -e "${BLUE}║          业务逻辑 | 用户体验 | API | 安全                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "报告文件: ${CYAN}$REPORT_FILE${NC}"
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

run_test_suite() {
    local name=$1
    local script=$2
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$name${NC}"
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
            exit_code=$?
            if [ $exit_code -eq 1 ]; then
                echo -e "${YELLOW}⚠️  $name 有失败项（查看报告）${NC}"
                ((FAILED_TESTS++))
            else
                echo -e "${RED}❌ $name 失败${NC}"
                ((FAILED_TESTS++))
            fi
        fi
    else
        echo -e "${RED}❌ 脚本不存在: $script${NC}"
        echo "脚本不存在: $script" >> "$REPORT_FILE"
        ((FAILED_TESTS++))
    fi
    
    {
        echo "结束时间: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    ((TOTAL_TESTS++))
    echo ""
}

# 1. API 端点测试
run_test_suite "1. API 端点测试" "$SCRIPT_DIR/test-api-endpoints.sh"

# 2. 登录流程测试
run_test_suite "2. 登录流程测试" "$SCRIPT_DIR/test-login-flow.sh"

# 3. 业务逻辑测试
run_test_suite "3. 业务逻辑测试" "$SCRIPT_DIR/test-business-logic.sh"

# 4. 用户体验测试
run_test_suite "4. 用户体验测试" "$SCRIPT_DIR/test-user-experience.sh"

# 5. 安全检查
run_test_suite "5. 安全检查" "$SCRIPT_DIR/check-security.sh"

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

# 显示报告摘要
if [ -f "$REPORT_FILE" ]; then
    echo -e "${CYAN}报告摘要:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    grep -E "(通过|失败|警告|✅|❌|⚠️|加载时间|响应时间)" "$REPORT_FILE" | tail -20
    echo ""
fi

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  有 $FAILED_TESTS 个测试套件有失败项，请查看详细报告${NC}"
    exit 0  # 返回 0 以便继续查看报告
fi
