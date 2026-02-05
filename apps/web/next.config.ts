import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Next.js 会自动从项目根目录加载 .env.local 文件
// 开发环境使用 .env.local，生产环境通过平台环境变量注入
// 无需手动加载，避免重复加载导致警告

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

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
      {
        pathname: '/media/**',
        // 不设置 search，允许所有查询字符串（Next.js 15 要求）
      },
      {
        pathname: '/media/processed/**',
        // 明确匹配 processed 路径
      },
      {
        pathname: '/media/processed/thumbs/**',
        // 明确匹配 thumbs 路径
      },
      {
        pathname: '/media/processed/previews/**',
        // 明确匹配 previews 路径
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
  // Turbopack 配置（显式声明以避免 Next.js 15.5.6 的误报警告）
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // 确保模块正确加载
    optimizePackageImports: ['lucide-react'],
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
        const port = mediaUrl.port
        // 同时添加 HTTP 和 HTTPS 两种协议，包括端口（如果有）
        if (port) {
          mediaOrigins = [
            `http://${hostname}:${port}`,
            `https://${hostname}:${port}`
          ]
        } else {
          mediaOrigins = [
            `http://${hostname}`,
            `https://${hostname}`
          ]
        }
      } catch {
        // 忽略解析错误
      }
    }
    
    // 从 STORAGE_PUBLIC_URL 或 MINIO_PUBLIC_URL 获取 presigned URL 使用的地址
    // 这些 URL 可能不同于 NEXT_PUBLIC_MEDIA_URL（用于读取文件）
    const storagePublicUrl = process.env.STORAGE_PUBLIC_URL || process.env.MINIO_PUBLIC_URL
    if (storagePublicUrl && !mediaOrigins.some(origin => storagePublicUrl.includes(origin))) {
      try {
        const storageUrl = new URL(storagePublicUrl)
        const hostname = storageUrl.hostname
        const port = storageUrl.port
        // 添加 presigned URL 使用的地址（可能包括 localhost）
        if (port) {
          const storageOrigin = `${storageUrl.protocol}//${hostname}:${port}`
          if (!mediaOrigins.includes(storageOrigin)) {
            mediaOrigins.push(storageOrigin)
          }
        } else {
          const storageOriginHttp = `http://${hostname}`
          const storageOriginHttps = `https://${hostname}`
          if (!mediaOrigins.includes(storageOriginHttp)) {
            mediaOrigins.push(storageOriginHttp)
          }
          if (!mediaOrigins.includes(storageOriginHttps)) {
            mediaOrigins.push(storageOriginHttps)
          }
        }
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
    // 注意：presigned URL 需要直接访问 MinIO，所以需要允许所有媒体服务器地址
    const connectSrc = [
      "'self'",
      'https:',
      'wss:', // 允许所有 WebSocket 安全连接
      ...mediaOrigins,
      ...supabaseOrigins, // 仅在混合模式下添加
      // 在开发环境或 standalone 模式下，允许 localhost 连接（包括常用端口）
      // 这对于 presigned URL 直接上传到 MinIO 是必需的
      // 注意：CSP 不支持通配符端口，需要明确列出端口
      // 开发模式（多端口暴露）：允许所有开发环境需要的端口
      ...(isDev || process.env.NODE_ENV !== 'production' 
        ? [
            'http://localhost',
            'https://localhost',
            'http://localhost:3000',  // Next.js Web 端口（开发模式）
            'https://localhost:3000',  // Next.js Web 端口 (HTTPS)
            'http://localhost:9000',  // MinIO API 端口（开发模式多端口暴露）
            'http://localhost:9001',  // MinIO Console 端口（开发模式多端口暴露）
            'http://localhost:3001',  // Worker API 端口（开发模式多端口暴露）
            // 保留旧端口配置以兼容其他模式
            'http://localhost:8081',  // Next.js Web 端口（生产模式）
            'https://localhost:8081',  // Next.js Web 端口 (HTTPS)
            'http://localhost:19000', // MinIO API 端口（旧配置）
          ] 
        : [])
    ]
    
    // 在生产环境中，如果 mediaOrigins 包含 localhost，也需要添加到 CSP
    // 这适用于 standalone 模式，其中可能使用 localhost:8081 作为媒体服务器
    // 开发模式使用 localhost:3000（多端口暴露）
    if (!isDev && process.env.NODE_ENV === 'production') {
      const hasLocalhost = mediaOrigins.some(origin => origin.includes('localhost'))
      if (hasLocalhost) {
        // 添加所有可能的 localhost 端口（standalone 模式常用）
        connectSrc.push(
          'http://localhost:8081',  // 生产模式（单端口）
          'https://localhost:8081',
          'http://localhost:3000',   // 开发模式（多端口暴露）
          'https://localhost:3000',
          'http://localhost:9000',   // 开发模式 MinIO API
          'http://localhost:9001'    // 开发模式 MinIO Console
        )
      }
    }
    
    const connectSrcString = connectSrc.join(' ')
    
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
            // 注意：presigned URL 需要直接访问 MinIO，但 MinIO API 端口在 standalone 模式下不暴露
            // 上传组件有回退机制：如果 presigned URL 失败，会通过 Next.js API 代理上传
            // 所以 CSP 不需要允许 localhost:19000，因为上传会回退到代理方式
            value: isDev ? '' : `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src ${connectSrcString} https://challenges.cloudflare.com; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none';`,
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
  // Webpack 配置
  // 生产级别的 webpack 配置，确保模块解析和代码分割的正确性
  webpack: (config, { isServer, webpack }) => {
    // 客户端配置
    if (!isServer) {
      // 设置必要的 fallback（避免 Node.js 模块在浏览器中报错）
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
      
      // 生产级别的优化配置
      // 确保模块工厂函数正确工作，避免 "Cannot read properties of undefined (reading 'call')" 错误
      config.optimization = {
        ...config.optimization,
        // 禁用模块连接，避免模块工厂函数冲突
        concatenateModules: false,
        // 配置代码分割策略，确保模块正确加载
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // 默认组：确保所有模块都能正确加载
            default: {
              minChunks: 1,
              priority: -20,
              reuseExistingChunk: true,
            },
            // 第三方库组：分离 node_modules 中的包
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // React 相关库：单独打包，确保稳定性
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'react',
              priority: 20,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // Next.js 相关库：单独打包
            nextjs: {
              test: /[\\/]node_modules[\\/](next|@next)[\\/]/,
              name: 'nextjs',
              priority: 20,
              reuseExistingChunk: true,
              chunks: 'all',
            },
          },
        },
        // 确保模块 ID 生成稳定
        moduleIds: 'deterministic',
        // 确保 chunk ID 生成稳定
        chunkIds: 'deterministic',
      }
      
      // 确保模块解析配置正确
      config.resolve = {
        ...config.resolve,
        // 确保模块扩展名解析顺序正确
        extensions: [...(config.resolve?.extensions || []), '.ts', '.tsx', '.js', '.jsx'],
        // 保持现有的别名配置
        alias: {
          ...config.resolve?.alias,
        },
        // 确保模块解析顺序正确
        mainFields: ['browser', 'module', 'main'],
      }
      
      // 确保 webpack 插件配置正确
      config.plugins = config.plugins || []
    }
    
    // 忽略已知的、不影响功能的警告
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules/ },
      { file: /\.next/ },
      // 忽略 source map 解析警告（不影响功能）
      /Failed to parse source map/,
    ]
    
    // 确保返回配置对象
    return config
  },
}

export default withNextIntl(nextConfig)


