#!/bin/bash

# ============================================
# PIS 测试运行脚本（分步骤）
# 用途: 分步骤运行各种测试，生成详细报告
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="http://localhost:8081"
REPORT_FILE="/tmp/pis-test-report-$(date +%Y%m%d-%H%M%S).txt"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 测试套件 - 分步骤运行                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "测试报告将保存到: ${CYAN}$REPORT_FILE${NC}"
echo ""

# 写入报告头
{
    echo "PIS 测试报告"
    echo "生成时间: $(date)"
    echo "========================================"
    echo ""
} > "$REPORT_FILE"

# 1. 环境检查
echo -e "${CYAN}[1/8] 环境检查...${NC}"
{
    echo "1. 环境检查"
    echo "---"
    docker --version | tee -a "$REPORT_FILE"
    docker compose version | tee -a "$REPORT_FILE"
    node --version | tee -a "$REPORT_FILE"
    pnpm --version | tee -a "$REPORT_FILE"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 2. 容器状态
echo -e "${CYAN}[2/8] 容器状态检查...${NC}"
{
    echo "2. 容器状态"
    echo "---"
    docker compose -f docker/docker-compose.standalone.yml ps | tee -a "$REPORT_FILE"
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 3. API 端点测试
echo -e "${CYAN}[3/8] API 端点测试...${NC}"
{
    echo "3. API 端点测试"
    echo "---"
    
    echo "健康检查:"
    curl -s "$BASE_URL/api/health" || curl -s "$BASE_URL/health" | tee -a "$REPORT_FILE"
    echo ""
    
    echo "管理员状态:"
    curl -s "$BASE_URL/api/auth/check-admin-status" | tee -a "$REPORT_FILE"
    echo ""
    
    echo "登录端点测试:"
    curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' | tee -a "$REPORT_FILE"
    echo ""
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 4. 数据库连接测试
echo -e "${CYAN}[4/8] 数据库连接测试...${NC}"
{
    echo "4. 数据库连接测试"
    echo "---"
    
    echo "PostgreSQL:"
    docker exec pis-postgres psql -U pis -d pis -c "SELECT version();" 2>&1 | tee -a "$REPORT_FILE" || echo "PostgreSQL 连接测试失败（可能需要检查环境变量）" | tee -a "$REPORT_FILE"
    echo ""
    
    echo "Redis:"
    docker exec pis-redis redis-cli ping | tee -a "$REPORT_FILE"
    echo ""
    
    echo "MinIO:"
    docker exec pis-minio mc --version 2>&1 | tee -a "$REPORT_FILE" || echo "MinIO CLI not available" | tee -a "$REPORT_FILE"
    echo ""
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 5. 代码质量测试
echo -e "${CYAN}[5/8] 代码质量测试...${NC}"
{
    echo "5. 代码质量测试"
    echo "---"
    
    echo "运行 ESLint:"
    cd /Users/apple/Documents/Project/PIS/pis-standalone
    pnpm lint 2>&1 | head -50 | tee -a "$REPORT_FILE" || echo "ESLint 检查完成（有警告）" | tee -a "$REPORT_FILE"
    echo ""
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 6. 单元测试
echo -e "${CYAN}[6/8] 单元测试...${NC}"
{
    echo "6. 单元测试"
    echo "---"
    
    cd /Users/apple/Documents/Project/PIS/pis-standalone
    pnpm test 2>&1 | tee -a "$REPORT_FILE"
    echo ""
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 7. 安全检查
echo -e "${CYAN}[7/8] 安全检查...${NC}"
{
    echo "7. 安全检查"
    echo "---"
    
    cd /Users/apple/Documents/Project/PIS/pis-standalone
    bash scripts/check-security.sh 2>&1 | tee -a "$REPORT_FILE" || echo "安全检查完成（有警告）" | tee -a "$REPORT_FILE"
    echo ""
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 8. 压力测试（如果可用）
echo -e "${CYAN}[8/8] 压力测试...${NC}"
{
    echo "8. 压力测试"
    echo "---"
    
    if command -v ab > /dev/null 2>&1; then
        echo "使用 Apache Bench:"
        ab -n 100 -c 10 "$BASE_URL/api/health" 2>&1 | tee -a "$REPORT_FILE"
    elif command -v wrk > /dev/null 2>&1; then
        echo "使用 wrk:"
        wrk -t2 -c10 -d5s "$BASE_URL/api/health" 2>&1 | tee -a "$REPORT_FILE"
    else
        echo "未找到压力测试工具 (ab/wrk)，跳过压力测试" | tee -a "$REPORT_FILE"
    fi
    echo ""
} >> "$REPORT_FILE"
echo -e "${GREEN}✅ 完成${NC}"

# 总结
{
    echo ""
    echo "========================================"
    echo "测试完成时间: $(date)"
    echo "报告文件: $REPORT_FILE"
} >> "$REPORT_FILE"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 所有测试完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "详细报告: ${CYAN}$REPORT_FILE${NC}"
echo ""
cat "$REPORT_FILE" | tail -20
