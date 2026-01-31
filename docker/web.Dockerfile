# ============================================
# 阶段 1: 构建阶段
# ============================================
FROM node:20-alpine AS builder

# 配置 Alpine 镜像源（尝试多个镜像源，提高可用性）
RUN ALPINE_VERSION=$(cat /etc/alpine-release | cut -d'.' -f1,2) && \
    (echo "https://mirrors.aliyun.com/alpine/v${ALPINE_VERSION}/main" > /etc/apk/repositories && \
     echo "https://mirrors.aliyun.com/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories) || \
    (echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main" > /etc/apk/repositories && \
     echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories)

# 安装构建依赖
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制 workspace 配置和 lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# 复制 web 项目的 package.json
COPY apps/web/package.json ./apps/web/

# 安装依赖（使用 workspace 模式）
RUN pnpm install --filter @pis/web... --frozen-lockfile || pnpm install --filter @pis/web... --no-frozen-lockfile

# 复制源码和配置文件（包括字体文件）
COPY apps/web ./apps/web

# 如果字体文件缺失，构建会失败
# 解决方案：
# 1. 在构建前下载字体文件到 apps/web/public/fonts/
# 2. 或修改 layout.tsx 使用系统字体（见 docs/QUICK_FIX.md）

# 构建参数（用于注入环境变量到前端）
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MEDIA_URL
ARG NEXT_PUBLIC_PHOTOGRAPHER_NAME
ARG NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_AUTH_MODE
ARG NEXT_PUBLIC_POLLING_INTERVAL
ARG NEXT_PUBLIC_ADMIN_POLLING_INTERVAL

# 设置环境变量用于构建
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_MEDIA_URL=${NEXT_PUBLIC_MEDIA_URL}
ENV NEXT_PUBLIC_PHOTOGRAPHER_NAME=${NEXT_PUBLIC_PHOTOGRAPHER_NAME}
ENV NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE=${NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE}
# Supabase 变量（向后兼容，仅在混合部署模式 DATABASE_TYPE=supabase 时使用）
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}
ENV NEXT_PUBLIC_AUTH_MODE=${NEXT_PUBLIC_AUTH_MODE}
# 轮询配置（替代 Supabase Realtime）
ENV NEXT_PUBLIC_POLLING_INTERVAL=${NEXT_PUBLIC_POLLING_INTERVAL:-3000}
ENV NEXT_PUBLIC_ADMIN_POLLING_INTERVAL=${NEXT_PUBLIC_ADMIN_POLLING_INTERVAL:-2000}

# 启用 standalone 输出模式
ENV NEXT_TELEMETRY_DISABLED=1

# 构建（生成 standalone 输出）
WORKDIR /app/apps/web
RUN pnpm build

# ============================================
# 阶段 2: 运行阶段
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# 创建非 root 用户（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制 standalone 输出（Next.js 会在 standalone 目录下保持原始路径结构）
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# 设置正确的权限
RUN mkdir -p apps/web/.next && chown -R nextjs:nodejs apps

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 生产环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查（检查 HTTP 服务是否正常）
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 运行 Next.js standalone 服务器（monorepo 结构下的路径）
CMD ["node", "apps/web/server.js"]
