import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { config } from 'dotenv'
import { resolve } from 'path'

// 从 monorepo 根目录加载 .env（统一配置）
config({ path: resolve(__dirname, '../../.env') })

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  eslint: {
    // 构建时忽略 ESLint 错误（测试文件会被 ESLint 检查，但不应阻止构建）
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 构建时忽略 TypeScript 错误
    ignoreBuildErrors: false,
  },
  // 生成唯一的构建 ID，用于缓存破坏
  generateBuildId: async () => {
    // 优先使用 Git commit SHA（Vercel 自动提供），否则使用时间戳
    return process.env.VERCEL_GIT_COMMIT_SHA || 
           `build-${Date.now()}`
  },
  // 压缩配置（Next.js 15 默认启用）
  compress: true,
  // 输出模式：standalone（Docker 部署必需，也兼容 Vercel）
  output: 'standalone',
  // 优化生产构建
  productionBrowserSourceMaps: process.env.NODE_ENV === 'development', // 仅开发环境生成 source maps
  // 优化图片加载
  // 图片优化配置
  images: {
    // 图片优化已启用（支持 Docker 和 Vercel 部署）
    // Next.js 16+ 要求：配置本地图片模式以支持查询字符串
    localPatterns: [
      {
        pathname: '/icons/**',
        search: '**', // 允许所有查询字符串（如 ?v=3）
      },
    ],
    remotePatterns: [
      // 本地开发环境
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      // 生产环境媒体服务器（从环境变量动态获取）
      ...(process.env.NEXT_PUBLIC_MEDIA_URL
        ? (() => {
            try {
              const mediaUrl = new URL(process.env.NEXT_PUBLIC_MEDIA_URL)
              return [
                {
                  protocol: mediaUrl.protocol.replace(':', '') as 'http' | 'https',
                  hostname: mediaUrl.hostname,
                  pathname: '/**',
                },
              ]
            } catch {
              return []
            }
          })()
        : []),
      // 内网 MinIO 服务器（开发/测试环境，根据实际情况修改）
      {
        protocol: 'http',
        hostname: '192.168.x.x', // 替换为你的内网服务器IP
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '192.168.x.x', // 替换为你的内网服务器IP
        port: '9000',
        pathname: '/**',
      },
      // 示例域名（向后兼容）
      {
        protocol: 'http',
        hostname: 'media.example.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.example.com',
        pathname: '/**',
      },
      // 生产环境媒体服务器（通过 NEXT_PUBLIC_MEDIA_URL 动态配置）
      // 如果需要硬编码额外的域名，可以在这里添加
    ],
    // 图片优化配置
    formats: ['image/avif', 'image/webp'], // AVIF 优先（体积最小），WebP 作为后备
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 图片缓存 1 年（图片内容不变）
    // Next.js 16+ 要求：配置允许的 quality 值
    // 确保包含项目中使用的所有 quality 值
    qualities: [60, 75, 85, 100], // 添加 60 用于低质量占位符
    // 优化图片加载
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // 安全头配置
  async headers() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
    const isDev = process.env.NODE_ENV === 'development'
    // 检查是否使用 HTTPS（本地开发或 HTTP 部署时应禁用 HSTS）
    const isHttps = appUrl.startsWith('https://')
    const shouldEnableHsts = !isDev && isHttps
    
    // 从环境变量获取媒体服务器域名，用于 CSP connect-src
    // 同时支持 HTTP 和 HTTPS，因为 presigned URL 可能使用不同协议
    let mediaOrigins: string[] = []
    if (process.env.NEXT_PUBLIC_MEDIA_URL) {
      try {
        const mediaUrl = new URL(process.env.NEXT_PUBLIC_MEDIA_URL)
        const hostname = mediaUrl.hostname
        // 同时添加 HTTP 和 HTTPS 两种协议
        mediaOrigins = [
          `http://${hostname}`,
          `https://${hostname}`
        ]
      } catch {
        // 忽略解析错误
      }
    }
    
    // 从环境变量获取 Supabase URL，用于 WebSocket 连接（向后兼容，仅在混合模式下使用）
    let supabaseOrigins: string[] = []
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
        const hostname = supabaseUrl.hostname
        // 添加 Supabase 域名（支持 HTTPS 和 WSS）- 仅在混合模式下需要
        supabaseOrigins = [
          `https://${hostname}`,
          `wss://${hostname}`
        ]
      } catch {
        // 忽略解析错误
      }
    }
    
    // 构建 CSP connect-src，包含媒体服务器（PostgreSQL 模式下不需要 Supabase）
    const connectSrc = [
      "'self'",
      'https:',
      'wss:', // 允许所有 WebSocket 安全连接
      ...mediaOrigins,
      ...supabaseOrigins // 仅在混合模式下添加
    ].join(' ')
    
    return [
      {
        // 应用到所有 API 路由
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: isDev ? '*' : appUrl, // 开发环境允许所有来源，生产环境限制为指定域名
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // {
          //   key: 'Strict-Transport-Security',
          //   value: shouldEnableHsts ? 'max-age=31536000; includeSubDomains; preload' : '',
          // },
        ].filter(header => header.value !== ''), // 过滤空值
      },
      {
        // 应用到所有页面
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // {
          //   key: 'Strict-Transport-Security',
          //   value: shouldEnableHsts ? 'max-age=31536000; includeSubDomains; preload' : '',
          // },
          {
            key: 'Content-Security-Policy',
            value: isDev ? '' : `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src ${connectSrc} https://challenges.cloudflare.com; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none';`,
          },
        ].filter(header => header.value !== ''), // 过滤空值
      },
      {
        // 微信验证文件：确保可访问且不被缓存
        // 注意：必须放在其他规则之前，确保优先级最高
        source: '/4dedffaa9e333b0d5a389c628935fa49.txt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // 移除 Content-Disposition，确保微信可以正确读取文件内容
          {
            key: 'Content-Disposition',
            value: '',
          },
        ],
      },
      {
        // 静态资源缓存优化
        // 注意：icon.svg 使用较短的缓存时间，方便更新 logo
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: process.env.NODE_ENV === 'production' 
              ? 'public, max-age=86400, must-revalidate' // 生产环境：1天，允许重新验证
              : 'public, max-age=0, must-revalidate', // 开发环境：不缓存，确保更新立即生效
          },
        ],
      },
      {
        // 图片资源缓存优化
        source: '/processed/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // JavaScript 和 CSS 文件缓存优化
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 字体文件缓存优化
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  // Webpack 配置 - 仅设置必要的 fallback
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    return config
  },
}

export default withNextIntl(nextConfig)


