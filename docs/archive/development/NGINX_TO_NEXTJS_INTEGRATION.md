# Nginx 功能集成到 Next.js 方案

> 最后更新: 2026-01-31

## 📋 概述

本文档说明如何将 Nginx 容器的功能集成到 Next.js 前端容器中，从而减少一个容器。

## ✅ 可行性分析

### 技术上可行 ✅

Next.js 可以通过以下方式实现 Nginx 的功能：

1. **API Routes** - 代理请求到其他服务
2. **Rewrites** - URL 重写和转发
3. **Middleware** - 请求拦截和处理
4. **Headers** - 设置响应头

### 性能影响 ⚠️

| 功能 | Nginx | Next.js | 影响 |
|------|-------|---------|------|
| 静态文件服务 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 中等 |
| 反向代理 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 较小 |
| 大文件流式传输 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 中等 |
| WebSocket | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 较小 |
| 内存占用 | ~10MB | +20-50MB | 较小 |

## 🔧 实现方案

### 方案 1：使用 Next.js Rewrites（推荐）

在 `next.config.ts` 中添加 rewrites 配置：

```typescript
const nextConfig: NextConfig = {
  // ... 其他配置
  
  async rewrites() {
    const minioUrl = process.env.MINIO_ENDPOINT || 'http://minio:9000'
    const workerUrl = process.env.WORKER_URL || 'http://worker:3001'
    
    return [
      // 媒体文件代理（MinIO）
      {
        source: '/media/:path*',
        destination: `${minioUrl}/pis-photos/:path*`,
      },
      // MinIO Console 代理
      {
        source: '/minio-console/:path*',
        destination: `${minioUrl.replace(':9000', ':9001')}/:path*`,
      },
      // Worker API 代理（已有，但可以统一管理）
      {
        source: '/worker-api/:path*',
        destination: `${workerUrl}/:path*`,
      },
    ]
  },
}
```

**优点**：
- ✅ 配置简单
- ✅ 性能较好
- ✅ 无需额外代码

**缺点**：
- ❌ 无法设置复杂的响应头（CORS、缓存等）
- ❌ 无法处理 WebSocket（MinIO Console 需要）

### 方案 2：使用 API Routes（完整控制）

创建 API 路由处理代理：

#### 1. 媒体文件代理 (`apps/web/src/app/media/[...path]/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  
  const minioUrl = process.env.MINIO_ENDPOINT || 'http://minio:9000'
  const targetUrl = `${minioUrl}/pis-photos/${path}`
  
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    })
    
    if (!response.ok) {
      return new NextResponse(null, { status: response.status })
    }
    
    // 设置响应头
    const headers = new Headers()
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('Media proxy error:', error)
    return new NextResponse(null, { status: 500 })
  }
}
```

#### 2. MinIO Console 代理 (`apps/web/src/app/minio-console/[...path]/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  const path = resolvedParams.path.join('/')
  
  const minioConsoleUrl = process.env.MINIO_CONSOLE_URL || 'http://minio:9001'
  const targetUrl = `${minioConsoleUrl}/${path}${request.nextUrl.search}`
  
  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    })
    
    // 处理 WebSocket 升级（如果需要）
    if (request.headers.get('upgrade') === 'websocket') {
      // Next.js 不支持 WebSocket，需要特殊处理
      // 建议：MinIO Console 直接暴露端口或使用 Nginx
    }
    
    const headers = new Headers(response.headers)
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('MinIO Console proxy error:', error)
    return new NextResponse(null, { status: 500 })
  }
}
```

**优点**：
- ✅ 完全控制请求和响应
- ✅ 可以设置自定义响应头
- ✅ 可以添加认证和限流

**缺点**：
- ❌ 代码复杂度增加
- ❌ 性能略低于 Nginx（需要 Node.js 处理）
- ❌ WebSocket 支持有限

### 方案 3：混合方案（推荐用于生产）

**保留 Nginx 容器，但简化配置**：

- Nginx 只处理：媒体文件服务、MinIO Console（WebSocket）
- Next.js 处理：Worker API 代理（已有）

这样可以：
- ✅ 减少 Nginx 配置复杂度
- ✅ 利用 Nginx 的高性能文件服务
- ✅ 保持 WebSocket 支持

## 📊 方案对比

| 方案 | 容器数 | 复杂度 | 性能 | WebSocket | 推荐度 |
|------|--------|--------|------|-----------|--------|
| **当前（Nginx 容器）** | 7 | 低 | ⭐⭐⭐⭐⭐ | ✅ | ⭐⭐⭐⭐⭐ |
| **Next.js Rewrites** | 6 | 低 | ⭐⭐⭐ | ❌ | ⭐⭐⭐ |
| **Next.js API Routes** | 6 | 中 | ⭐⭐⭐ | ⚠️ | ⭐⭐⭐⭐ |
| **混合方案** | 7 | 中 | ⭐⭐⭐⭐ | ✅ | ⭐⭐⭐⭐ |

## ⚠️ 注意事项

### 1. WebSocket 支持

MinIO Console 需要 WebSocket 支持，Next.js 的 API Routes **不完全支持 WebSocket**。

**解决方案**：
- 选项 A：MinIO Console 直接暴露端口（仅本地访问）
- 选项 B：保留 Nginx 容器处理 MinIO Console
- 选项 C：使用 Next.js Middleware + 外部 WebSocket 服务器

### 2. 大文件流式传输

媒体文件可能很大（几 MB 到几十 MB），Next.js 的流式传输性能不如 Nginx。

**影响**：
- 小文件（< 10MB）：影响较小
- 大文件（> 10MB）：可能影响性能

### 3. 内存占用

Next.js 处理代理会增加内存占用：
- 当前：Web 容器 ~200-300MB
- 集成后：Web 容器 ~250-350MB（+50MB）

### 4. 并发性能

Nginx 使用事件驱动模型，并发性能更好：
- Nginx：可以处理数万并发连接
- Next.js：受 Node.js 限制，通常数千并发

## 🎯 推荐方案

### 开发/测试环境

**去掉 Nginx，直接暴露端口**：

```yaml
services:
  web:
    ports:
      - "3000:3000"  # 直接访问
  minio:
    ports:
      - "9000:9000"  # 直接访问
      - "9001:9001"  # Console
```

### 生产环境（完全 Docker 化）

**保留 Nginx 容器**：
- ✅ 性能最优
- ✅ 配置简单
- ✅ 资源占用小（~10MB）

### 生产环境（已有主机 Nginx）

**使用主机 Nginx，移除容器**：
- ✅ 性能更好
- ✅ 更容易管理 SSL
- ✅ 减少容器数

## 📝 实施步骤（如果选择集成）

### 步骤 1：创建代理 API Routes

创建以下文件：
- `apps/web/src/app/media/[...path]/route.ts`
- `apps/web/src/app/minio-console/[...path]/route.ts`

### 步骤 2：修改 docker-compose.standalone.yml

```yaml
services:
  web:
    ports:
      - "8081:3000"  # 直接暴露，替代 Nginx
    # ... 其他配置
  
  # 移除或注释掉 nginx 服务
  # nginx:
  #   ...
```

### 步骤 3：更新环境变量

```bash
# .env
MINIO_ENDPOINT=http://minio:9000
MINIO_CONSOLE_URL=http://minio:9001
WORKER_URL=http://worker:3001
```

### 步骤 4：测试

```bash
# 测试媒体文件
curl http://localhost:8081/media/processed/image.jpg

# 测试 Worker API
curl http://localhost:8081/api/worker/health

# 测试 MinIO Console（如果支持）
curl http://localhost:8081/minio-console/
```

## 🔍 性能测试建议

如果选择集成方案，建议进行性能测试：

1. **小文件（< 1MB）**：对比响应时间
2. **大文件（> 10MB）**：对比传输速度
3. **并发请求**：对比吞吐量
4. **内存占用**：监控容器内存使用

## 💡 结论

**是否集成到 Next.js？**

- ✅ **可以集成** - 技术上完全可行
- ⚠️ **性能略降** - 特别是大文件和 WebSocket
- 💡 **推荐保留 Nginx** - 除非有特殊需求（如资源限制）

**最佳实践**：
- **开发环境**：去掉 Nginx，直接暴露端口
- **生产环境（Docker）**：保留 Nginx 容器
- **生产环境（主机 Nginx）**：使用主机 Nginx，移除容器
