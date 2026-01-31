#!/bin/bash

# Worker 更新脚本 - 在服务器上运行
# 用途: 拉取最新代码（可选），更新环境配置，重新构建 Worker 镜像并重启服务
#
# 用法:
#   bash scripts/update-worker-on-server.sh           # 完整流程（包括 git pull）
#   bash scripts/update-worker-on-server.sh --skip-pull  # 跳过 git pull（如果已手动拉取）
#   bash scripts/update-worker-on-server.sh --force   # 在本地运行
#   bash scripts/update-worker-on-server.sh --no-cache   # 使用 --no-cache 构建（不缓存层）

set -e

SKIP_PULL=false
FORCE=false
NO_CACHE=false

# 解析参数
for arg in "$@"; do
  case $arg in
    --skip-pull)
      SKIP_PULL=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --no-cache)
      NO_CACHE=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo "🚀 Worker 更新脚本"
echo "=================="
echo ""

# 检查是否在服务器上
if [ -z "$SSH_CONNECTION" ] && [ "$FORCE" != true ]; then
  echo "⚠️  此脚本应在服务器上运行"
  echo "   如果要在本地运行，请使用 --force 参数"
  echo ""
  read -p "继续？(y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    exit 0
  fi
fi

# 项目目录（自动检测，支持环境变量）
if [ -n "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR" ]; then
  # 使用环境变量指定的目录
  :
elif [ -d "/opt/pis" ]; then
  PROJECT_DIR="/opt/pis"
elif [ -d "/opt/PIS" ]; then
  PROJECT_DIR="/opt/PIS"
elif [ -d "/root/pis" ]; then
  PROJECT_DIR="/root/pis"
elif [ -d "/root/PIS" ]; then
  PROJECT_DIR="/root/PIS"
elif [ -d "$(dirname "$0")/.." ]; then
  # 使用脚本所在目录的父目录
  PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
else
  echo "❌ 未找到项目目录"
  echo "   请设置 PROJECT_DIR 环境变量或确保在项目目录中运行"
  echo "   例如: PROJECT_DIR=/path/to/pis-standalone bash scripts/update-worker-on-server.sh"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "📁 项目目录: $PROJECT_DIR"
echo ""

# 1. 拉取最新代码（可选）
if [ "$SKIP_PULL" = true ]; then
  echo "⏭️  跳过 git pull（使用 --skip-pull 选项）"
  echo ""
else
  echo "📥 拉取最新代码..."
  if git pull origin main; then
    echo "✅ 代码更新完成"
  else
    echo "⚠️  git pull 失败或没有更新"
  fi
  echo ""
fi

# 2. 检查环境配置文件
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  未找到 .env 文件"
  echo "   从 .env.example 创建..."
  cp .env.example .env
  echo "✅ 已创建 .env"
  echo ""
fi

# 3. 检查 WORKER_API_KEY
if ! grep -q "^WORKER_API_KEY=" "$ENV_FILE" 2>/dev/null || grep -q "^WORKER_API_KEY=your-secret-api-key-change-this-in-production" "$ENV_FILE" 2>/dev/null; then
  echo "⚠️  WORKER_API_KEY 未设置或使用示例值"
  echo ""
  read -p "是否要生成新的 API Key？(y/N): " generate
  if [ "$generate" = "y" ] || [ "$generate" = "Y" ]; then
    NEW_API_KEY=$(openssl rand -hex 32)
    if grep -q "^WORKER_API_KEY=" "$ENV_FILE" 2>/dev/null; then
      # 替换现有的
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
      else
        sed -i "s|^WORKER_API_KEY=.*|WORKER_API_KEY=${NEW_API_KEY}|" "$ENV_FILE"
      fi
    else
      # 添加新的
      echo "" >> "$ENV_FILE"
      echo "# Worker API Key" >> "$ENV_FILE"
      echo "WORKER_API_KEY=${NEW_API_KEY}" >> "$ENV_FILE"
    fi
    echo "✅ 已生成并设置新的 API Key: ${NEW_API_KEY:0:20}..."
    echo ""
    echo "⚠️  重要: 请确保 Next.js 应用也使用相同的 API Key！"
    echo ""
  else
    echo "⚠️  跳过 API Key 设置，请手动配置"
    echo ""
  fi
else
  echo "✅ WORKER_API_KEY 已配置"
  echo ""
fi

# 4. 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
  echo "❌ Docker 未安装"
  exit 1
fi

# 检测 docker-compose 命令（支持新版本 docker compose 和旧版本 docker-compose）
DOCKER_COMPOSE_CMD=""

# 先检测新版本 docker compose（作为 Docker 插件）
if docker compose version >/dev/null 2>&1; then
  # 新版本 Docker（docker compose 作为插件）
  DOCKER_COMPOSE_CMD="docker compose"
  echo "✅ 检测到 Docker Compose (新版本插件): docker compose"
# 再检测旧版本 docker-compose（独立命令）
elif command -v docker-compose >/dev/null 2>&1; then
  # 验证命令是否真的可用
  if docker-compose --version >/dev/null 2>&1 || docker-compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
    echo "✅ 检测到 Docker Compose (旧版本独立): docker-compose"
  else
    echo "⚠️  找到 docker-compose 命令但无法执行，尝试使用 docker compose..."
    if docker compose version >/dev/null 2>&1; then
      DOCKER_COMPOSE_CMD="docker compose"
      echo "✅ 使用 Docker Compose (新版本插件): docker compose"
    else
      echo "❌ Docker Compose 不可用"
      exit 1
    fi
  fi
else
  echo "❌ Docker Compose 未安装或不可用"
  echo ""
  echo "请选择以下方式之一安装:"
  echo "  1. 更新 Docker 到最新版本（推荐，包含 docker compose 插件）"
  echo "  2. 安装独立的 docker-compose:"
  echo "     curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
  echo "     chmod +x /usr/local/bin/docker-compose"
  exit 1
fi

# 验证变量已设置
if [ -z "$DOCKER_COMPOSE_CMD" ]; then
  echo "❌ 错误: Docker Compose 命令未正确设置"
  exit 1
fi

echo ""

# 5. 重新构建 Worker 镜像
echo "🔨 重新构建 Worker 镜像..."
cd "$PROJECT_DIR"

# 优先使用 docker-compose（推荐方式）
if [ -f "docker/docker-compose.yml" ]; then
  echo "   使用 docker-compose 构建..."
  cd docker
  if [ "$NO_CACHE" = true ]; then
    echo "   ⚠️  使用 --no-cache 选项（不缓存层）"
    $DOCKER_COMPOSE_CMD build --no-cache worker
  else
    $DOCKER_COMPOSE_CMD build worker
  fi
  echo "✅ Worker 镜像构建完成"
  echo ""
  
  echo "🔄 重启 Worker 服务..."
  $DOCKER_COMPOSE_CMD restart worker
  echo "✅ Worker 服务已重启"
  cd ..
elif [ -f "docker-compose.yml" ]; then
  # 兼容根目录的 docker-compose.yml
  echo "   使用 docker-compose 构建（根目录）..."
  if [ "$NO_CACHE" = true ]; then
    echo "   ⚠️  使用 --no-cache 选项（不缓存层）"
    $DOCKER_COMPOSE_CMD build --no-cache worker
  else
    $DOCKER_COMPOSE_CMD build worker
  fi
  echo "✅ Worker 镜像构建完成"
  echo ""
  
  echo "🔄 重启 Worker 服务..."
  $DOCKER_COMPOSE_CMD restart worker
  echo "✅ Worker 服务已重启"
else
  # 使用 Dockerfile 直接构建
  if [ -f "docker/worker.Dockerfile" ]; then
    echo "   使用 Dockerfile 构建..."
    if [ "$NO_CACHE" = true ]; then
      echo "   ⚠️  使用 --no-cache 选项（不缓存层）"
      docker build --network=host --no-cache -t pis-worker:latest -f docker/worker.Dockerfile .
    else
      docker build --network=host -t pis-worker:latest -f docker/worker.Dockerfile .
    fi
    echo "✅ Worker 镜像构建完成"
    echo ""
    
    echo "🔄 重启 Worker 容器..."
    # 尝试重启现有容器，如果不存在则启动新容器
    if docker ps -a --format '{{.Names}}' | grep -q "^pis-worker$"; then
      docker restart pis-worker
    else
      # 如果使用 docker-compose，应该通过 docker-compose 启动
      if [ -f "docker/docker-compose.yml" ]; then
        cd docker
        $DOCKER_COMPOSE_CMD up -d worker
        cd ..
      else
        echo "⚠️  未找到容器，请使用 docker-compose 启动"
      fi
    fi
    echo "✅ Worker 容器已重启"
  elif [ -f "services/worker/Dockerfile" ]; then
    echo "   使用 Dockerfile 构建..."
    if [ "$NO_CACHE" = true ]; then
      echo "   ⚠️  使用 --no-cache 选项（不缓存层）"
      docker build --network=host --no-cache -t pis-worker:latest -f services/worker/Dockerfile .
    else
      docker build --network=host -t pis-worker:latest -f services/worker/Dockerfile .
    fi
    echo "✅ Worker 镜像构建完成"
    echo ""
    
    echo "🔄 重启 Worker 容器..."
    docker restart pis-worker || echo "⚠️  请手动重启 Worker 容器"
  else
    echo "❌ 未找到 Dockerfile 或 docker-compose.yml"
    echo "   请检查项目结构或手动更新 Worker"
    exit 1
  fi
fi

echo ""
echo "📋 验证步骤:"
echo "   1. 检查 Worker 日志:"
echo "      docker logs pis-worker --tail 20"
echo ""
echo "   2. 测试健康检查（本地）:"
echo "      curl http://localhost:3001/health"
echo "      # 应该返回健康状态（不需要 API Key）"
echo ""
echo "   3. 检查 Worker 服务状态:"
if [ -f "docker/docker-compose.yml" ] || [ -f "docker-compose.yml" ]; then
  if [ -f "docker/docker-compose.yml" ]; then
    echo "      cd docker && $DOCKER_COMPOSE_CMD ps worker"
  else
    echo "      $DOCKER_COMPOSE_CMD ps worker"
  fi
else
  echo "      docker ps --filter 'name=pis-worker'"
fi
echo ""
echo "✅ Worker 更新完成！"
echo ""
echo "💡 提示:"
echo "   - 如果 Worker 使用公网模式，可以通过以下方式测试:"
echo "     curl http://$(hostname -I | awk '{print $1}'):3001/health"
echo ""
echo "   - 如果已经手动执行了 git pull，可以使用 --skip-pull 选项跳过:"
echo "     bash scripts/update-worker-on-server.sh --skip-pull"
echo ""
echo "   - 如果需要强制重新构建（不使用缓存），可以使用 --no-cache 选项:"
echo "     bash scripts/update-worker-on-server.sh --no-cache"
echo ""