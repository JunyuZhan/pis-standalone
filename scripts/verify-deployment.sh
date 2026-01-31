#!/bin/bash

# ============================================
# PIS 部署验证脚本
# 用途: 端到端验证部署是否成功
# 使用方法: ./scripts/verify-deployment.sh [SSH_HOST]
# 
# 环境变量:
#   - ENV_FILE_PATH: 环境变量文件路径（默认: /opt/pis/.env）
#   - SSH_USER: SSH 用户名（默认: root）
# ============================================

set -e

SSH_HOST=${1:-"localhost"}
SSH_USER=${SSH_USER:-"root"}
ENV_FILE_PATH="${ENV_FILE_PATH:-/opt/pis/.env}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

# 测试函数
test_check() {
    local name=$1
    local command=$2
    
    echo -n "测试 $name... "
    
    if [ "$SSH_HOST" = "localhost" ]; then
        result=$(eval "$command" 2>&1)
    else
        result=$(ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "$command" 2>&1)
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}❌ 失败${NC}"
        echo "   错误: $result"
        ((FAIL_COUNT++))
        return 1
    fi
}

echo -e "${BLUE}🔍 PIS 部署验证${NC}"
echo "===================="
echo "目标: $SSH_USER@$SSH_HOST"
echo ""

# 1. Docker 服务检查
echo -e "${BLUE}1️⃣  Docker 服务状态${NC}"
echo "-------------------"

test_check "MinIO 容器运行" "docker ps --filter 'name=pis-minio' --format '{{.Names}}' | grep -q 'pis-minio'"

test_check "Redis 容器运行" "docker ps --filter 'name=pis-redis' --format '{{.Names}}' | grep -q 'pis-redis'"

# 检查 PostgreSQL 容器（如果使用完全自托管模式）
if [ "$SSH_HOST" = "localhost" ]; then
    if docker ps --filter 'name=pis-postgres' --format '{{.Names}}' | grep -q 'pis-postgres'; then
        test_check "PostgreSQL 容器运行" "docker ps --filter 'name=pis-postgres' --format '{{.Names}}' | grep -q 'pis-postgres'"
    fi
else
    if ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "docker ps --filter 'name=pis-postgres' --format '{{.Names}}'" | grep -q 'pis-postgres'; then
        test_check "PostgreSQL 容器运行" "docker ps --filter 'name=pis-postgres' --format '{{.Names}}' | grep -q 'pis-postgres'"
    fi
fi

test_check "Worker 容器运行" "docker ps --filter 'name=pis-worker' --format '{{.Names}}' | grep -q 'pis-worker'"

echo ""

# 2. 端口监听检查
echo -e "${BLUE}2️⃣  端口监听状态${NC}"
echo "-------------------"

if [ "$SSH_HOST" = "localhost" ]; then
    test_check "MinIO API (19000)" "ss -tuln 2>/dev/null | grep -q ':19000 ' || netstat -tuln 2>/dev/null | grep -q ':19000 '"
    test_check "MinIO Console (19001)" "ss -tuln 2>/dev/null | grep -q ':19001 ' || netstat -tuln 2>/dev/null | grep -q ':19001 '"
    test_check "Redis (16379)" "ss -tuln 2>/dev/null | grep -q ':16379 ' || netstat -tuln 2>/dev/null | grep -q ':16379 '"
    # PostgreSQL 端口检查（如果使用完全自托管模式）
    if docker ps --format '{{.Names}}' | grep -q "^pis-postgres$"; then
        test_check "PostgreSQL (5432)" "ss -tuln 2>/dev/null | grep -q ':5432 ' || netstat -tuln 2>/dev/null | grep -q ':5432 '"
    fi
    test_check "Worker API (3001)" "ss -tuln 2>/dev/null | grep -q ':3001 ' || netstat -tuln 2>/dev/null | grep -q ':3001 '"
else
    test_check "MinIO API (19000)" "ss -tuln 2>/dev/null | grep -q ':19000 ' || netstat -tuln 2>/dev/null | grep -q ':19000 '"
    test_check "MinIO Console (19001)" "ss -tuln 2>/dev/null | grep -q ':19001 ' || netstat -tuln 2>/dev/null | grep -q ':19001 '"
    test_check "Redis (16379)" "ss -tuln 2>/dev/null | grep -q ':16379 ' || netstat -tuln 2>/dev/null | grep -q ':16379 '"
    # PostgreSQL 端口检查（如果使用完全自托管模式）
    if ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "docker ps --format '{{.Names}}'" | grep -q "^pis-postgres$"; then
        test_check "PostgreSQL (5432)" "ss -tuln 2>/dev/null | grep -q ':5432 ' || netstat -tuln 2>/dev/null | grep -q ':5432 '"
    fi
    test_check "Worker API (3001)" "ss -tuln 2>/dev/null | grep -q ':3001 ' || netstat -tuln 2>/dev/null | grep -q ':3001 '"
fi

echo ""

# 3. 健康检查
echo -e "${BLUE}3️⃣  服务健康检查${NC}"
echo "-------------------"

if [ "$SSH_HOST" = "localhost" ]; then
    # MinIO 健康检查
    echo -n "MinIO 健康状态... "
    minio_health=$(curl -s http://localhost:19000/minio/health/live 2>/dev/null || echo "FAIL")
    if [ "$minio_health" = "OK" ]; then
        echo -e "${GREEN}✅ 正常${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${RED}❌ 异常${NC}"
        ((FAIL_COUNT++))
    fi

    # Redis 健康检查
    echo -n "Redis 连接状态... "
    redis_ping=$(docker exec pis-redis redis-cli ping 2>/dev/null || echo "FAIL")
    if [ "$redis_ping" = "PONG" ]; then
        echo -e "${GREEN}✅ 正常${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${RED}❌ 异常${NC}"
        ((FAIL_COUNT++))
    fi

    # PostgreSQL 健康检查（如果使用完全自托管模式）
    if docker ps --format '{{.Names}}' | grep -q "^pis-postgres$"; then
        echo -n "PostgreSQL 连接状态... "
        pg_status=$(docker exec pis-postgres pg_isready -U ${DATABASE_USER:-pis} -d ${DATABASE_NAME:-pis} 2>/dev/null || echo "FAIL")
        if echo "$pg_status" | grep -q "accepting connections"; then
            echo -e "${GREEN}✅ 正常${NC}"
            ((PASS_COUNT++))
        else
            echo -e "${RED}❌ 异常${NC}"
            echo "   状态: $pg_status"
            ((FAIL_COUNT++))
        fi
    fi

    # Worker 健康检查
    echo -n "Worker 健康状态... "
    worker_health=$(curl -s http://localhost:3001/health 2>/dev/null || echo '{"status":"error"}')
    if echo "$worker_health" | grep -q '"status":"ok"'; then
        echo -e "${GREEN}✅ 正常${NC}"
        echo "   详细信息:"
        echo "$worker_health" | jq '.' 2>/dev/null || echo "$worker_health"
        ((PASS_COUNT++))
    else
        echo -e "${RED}❌ 异常${NC}"
        echo "   响应: $worker_health"
        ((FAIL_COUNT++))
    fi
else
    # 远程健康检查
    test_check "MinIO 健康检查" "curl -s http://localhost:19000/minio/health/live | grep -q 'OK'"
    
    test_check "Redis 连接测试" "docker exec pis-redis redis-cli ping | grep -q 'PONG'"
    
    # PostgreSQL 健康检查（如果使用完全自托管模式）
    if ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "docker ps --format '{{.Names}}'" | grep -q "^pis-postgres$"; then
        test_check "PostgreSQL 连接测试" "docker exec pis-postgres pg_isready -U ${DATABASE_USER:-pis} -d ${DATABASE_NAME:-pis} | grep -q 'accepting connections'"
    fi
    
    test_check "Worker 健康检查" "curl -s http://localhost:3001/health | grep -q '\"status\":\"ok\"'"
fi

echo ""

# 4. 环境变量检查
echo -e "${BLUE}4️⃣  环境变量检查${NC}"
echo "-------------------"

# 检测部署模式（PostgreSQL 或 Supabase）
check_database_type() {
    local env_file="$ENV_FILE_PATH"
    if [ "$SSH_HOST" != "localhost" ]; then
        env_file=$(ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "echo $ENV_FILE_PATH")
    fi
    
    if [ "$SSH_HOST" = "localhost" ]; then
        if [ -f "$env_file" ]; then
            if grep -q "^DATABASE_TYPE=postgresql" "$env_file" 2>/dev/null; then
                echo "postgresql"
            elif grep -q "^DATABASE_TYPE=supabase" "$env_file" 2>/dev/null; then
                echo "supabase"
            elif grep -q "^DATABASE_HOST=" "$env_file" 2>/dev/null; then
                echo "postgresql"
            elif grep -q "^SUPABASE_URL=" "$env_file" 2>/dev/null; then
                echo "supabase"
            else
                echo "postgresql"  # 默认 PostgreSQL
            fi
        else
            echo "postgresql"  # 默认 PostgreSQL
        fi
    else
        if ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "test -f $env_file" 2>/dev/null; then
            if ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "grep -q '^DATABASE_TYPE=postgresql' $env_file" 2>/dev/null; then
                echo "postgresql"
            elif ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "grep -q '^DATABASE_TYPE=supabase' $env_file" 2>/dev/null; then
                echo "supabase"
            elif ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "grep -q '^DATABASE_HOST=' $env_file" 2>/dev/null; then
                echo "postgresql"
            elif ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "grep -q '^SUPABASE_URL=' $env_file" 2>/dev/null; then
                echo "supabase"
            else
                echo "postgresql"  # 默认 PostgreSQL
            fi
        else
            echo "postgresql"  # 默认 PostgreSQL
        fi
    fi
}

DB_TYPE=$(check_database_type)

if [ "$SSH_HOST" = "localhost" ]; then
    if [ -f "$ENV_FILE_PATH" ]; then
        # 通用配置检查
        test_check "MINIO_ACCESS_KEY 配置" "grep -q '^MINIO_ACCESS_KEY=' $ENV_FILE_PATH"
        test_check "MINIO_SECRET_KEY 配置" "grep -q '^MINIO_SECRET_KEY=' $ENV_FILE_PATH"
        test_check "WORKER_API_KEY 配置" "grep -q '^WORKER_API_KEY=' $ENV_FILE_PATH"
        
        # 根据数据库类型检查
        if [ "$DB_TYPE" = "postgresql" ]; then
            test_check "DATABASE_TYPE=postgresql" "grep -q '^DATABASE_TYPE=postgresql' $ENV_FILE_PATH"
            test_check "DATABASE_HOST 配置" "grep -q '^DATABASE_HOST=' $ENV_FILE_PATH"
            test_check "DATABASE_NAME 配置" "grep -q '^DATABASE_NAME=' $ENV_FILE_PATH"
            test_check "DATABASE_USER 配置" "grep -q '^DATABASE_USER=' $ENV_FILE_PATH"
            test_check "DATABASE_PASSWORD 配置" "grep -q '^DATABASE_PASSWORD=' $ENV_FILE_PATH"
            test_check "AUTH_JWT_SECRET 配置" "grep -q '^AUTH_JWT_SECRET=' $ENV_FILE_PATH"
        else
            test_check "DATABASE_TYPE=supabase" "grep -q '^DATABASE_TYPE=supabase' $ENV_FILE_PATH"
            test_check "SUPABASE_URL 配置" "grep -q '^SUPABASE_URL=' $ENV_FILE_PATH"
            test_check "SUPABASE_SERVICE_ROLE_KEY 配置" "grep -q '^SUPABASE_SERVICE_ROLE_KEY=' $ENV_FILE_PATH"
        fi
    else
        echo -e "${YELLOW}⚠️  环境变量文件不存在 ($ENV_FILE_PATH)${NC}"
        ((FAIL_COUNT++))
    fi
else
    test_check "环境变量文件存在" "test -f $ENV_FILE_PATH"
    # 通用配置检查
    test_check "MINIO_ACCESS_KEY 配置" "grep -q '^MINIO_ACCESS_KEY=' $ENV_FILE_PATH"
    test_check "MINIO_SECRET_KEY 配置" "grep -q '^MINIO_SECRET_KEY=' $ENV_FILE_PATH"
    test_check "WORKER_API_KEY 配置" "grep -q '^WORKER_API_KEY=' $ENV_FILE_PATH"
    
    # 根据数据库类型检查
    if [ "$DB_TYPE" = "postgresql" ]; then
        test_check "DATABASE_TYPE=postgresql" "grep -q '^DATABASE_TYPE=postgresql' $ENV_FILE_PATH"
        test_check "DATABASE_HOST 配置" "grep -q '^DATABASE_HOST=' $ENV_FILE_PATH"
        test_check "DATABASE_NAME 配置" "grep -q '^DATABASE_NAME=' $ENV_FILE_PATH"
        test_check "DATABASE_USER 配置" "grep -q '^DATABASE_USER=' $ENV_FILE_PATH"
        test_check "DATABASE_PASSWORD 配置" "grep -q '^DATABASE_PASSWORD=' $ENV_FILE_PATH"
        test_check "AUTH_JWT_SECRET 配置" "grep -q '^AUTH_JWT_SECRET=' $ENV_FILE_PATH"
    else
        test_check "DATABASE_TYPE=supabase" "grep -q '^DATABASE_TYPE=supabase' $ENV_FILE_PATH"
        test_check "SUPABASE_URL 配置" "grep -q '^SUPABASE_URL=' $ENV_FILE_PATH"
        test_check "SUPABASE_SERVICE_ROLE_KEY 配置" "grep -q '^SUPABASE_SERVICE_ROLE_KEY=' $ENV_FILE_PATH"
    fi
fi

echo ""

# 5. MinIO Bucket 检查
echo -e "${BLUE}5️⃣  MinIO Bucket 检查${NC}"
echo "-------------------"

if [ "$SSH_HOST" = "localhost" ]; then
    bucket_check=$(docker exec pis-minio mc ls local/pis-photos 2>/dev/null || echo "FAIL")
    if [ "$bucket_check" != "FAIL" ]; then
        echo -e "${GREEN}✅ Bucket 存在${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠️  Bucket 可能不存在${NC}"
        ((FAIL_COUNT++))
    fi
else
    test_check "MinIO Bucket 存在" "docker exec pis-minio mc ls local/pis-photos 2>/dev/null | head -1"
fi

echo ""

# 6. Worker 日志检查（最近错误）
echo -e "${BLUE}6️⃣  Worker 日志检查${NC}"
echo "-------------------"

if [ "$SSH_HOST" = "localhost" ]; then
    worker_errors=$(docker logs --tail 50 pis-worker 2>&1 | grep -i "error\|failed" | tail -5 || echo "")
    if [ -z "$worker_errors" ]; then
        echo -e "${GREEN}✅ 最近无错误日志${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠️  发现错误日志:${NC}"
        echo "$worker_errors"
        ((FAIL_COUNT++))
    fi
else
    echo "Worker 最近日志:"
    ssh -o StrictHostKeyChecking=no $SSH_USER@$SSH_HOST "docker logs --tail 20 pis-worker 2>&1" | tail -10
fi

echo ""
echo "===================="
echo -e "${BLUE}测试结果汇总${NC}"
echo "-------------------"
echo -e "${GREEN}通过: $PASS_COUNT${NC}"
echo -e "${RED}失败: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！部署验证成功。${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分测试失败，请检查上述错误信息。${NC}"
    exit 1
fi
