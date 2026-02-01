/**
 * MinIO Console 代理 API
 * 
 * 将 /minio-console/* 请求代理到 MinIO Console
 * 
 * @route GET|POST|PUT|DELETE /minio-console/:path*
 * @description 代理 MinIO Console 请求
 * 
 * 注意：
 * - MinIO Console 需要 WebSocket 支持，Next.js API Routes 不完全支持 WebSocket
 * - 建议：MinIO Console 仅用于管理，可以通过直接暴露端口访问（仅本地）
 * - 或者：使用主机 Nginx 代理 MinIO Console
 */

import { NextRequest, NextResponse } from 'next/server'

// 配置超时时间（WebSocket 连接需要较长超时）
export const maxDuration = 300

function getMinioConsoleUrl(): string {
  const host = process.env.MINIO_ENDPOINT_HOST || 'minio'
  const port = process.env.MINIO_CONSOLE_PORT || '9001'
  const useSSL = process.env.MINIO_USE_SSL === 'true'
  const protocol = useSSL ? 'https' : 'http'
  
  return `${protocol}://${host}:${port}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, 'DELETE')
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.path.join('/')
    
    // 检查 WebSocket 升级请求
    const upgrade = request.headers.get('upgrade')
    if (upgrade === 'websocket') {
      // Next.js API Routes 不完全支持 WebSocket
      // 返回错误提示使用直接访问或 Nginx
      return NextResponse.json(
        {
          error: {
            code: 'WEBSOCKET_NOT_SUPPORTED',
            message: 'WebSocket 不支持通过 Next.js 代理，请直接访问 MinIO Console 端口（9001）或使用 Nginx',
          },
        },
        { status: 426 } // 426 Upgrade Required
      )
    }
    
    const consoleUrl = getMinioConsoleUrl()
    const searchParams = request.nextUrl.searchParams.toString()
    const targetUrl = searchParams
      ? `${consoleUrl}/${path}?${searchParams}`
      : `${consoleUrl}/${path}`
    
    // 准备请求头
    const headers: HeadersInit = {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    }
    
    // 传递 Cookie（MinIO Console 需要认证）
    const cookie = request.headers.get('Cookie')
    if (cookie) {
      headers['Cookie'] = cookie
    }
    
    // 传递其他重要请求头
    const referer = request.headers.get('Referer')
    if (referer) {
      headers['Referer'] = referer
    }
    
    const userAgent = request.headers.get('User-Agent')
    if (userAgent) {
      headers['User-Agent'] = userAgent
    }
    
    // 准备请求体
    let body: BodyInit | undefined
    if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
      body = await request.text()
    }
    
    // 代理请求
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    })
    
    // 设置响应头
    const responseHeaders = new Headers()
    
    // 复制所有响应头
    response.headers.forEach((value, key) => {
      // 排除一些不应该传递的头
      if (
        !key.toLowerCase().startsWith('content-encoding') &&
        !key.toLowerCase().startsWith('transfer-encoding')
      ) {
        responseHeaders.set(key, value)
      }
    })
    
    // CORS
    const origin = request.headers.get('origin')
    if (origin) {
      responseHeaders.set('Access-Control-Allow-Origin', origin)
    }
    
    // 流式传输响应
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[MinIO Console Proxy] Error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'PROXY_ERROR',
          message: 'MinIO Console 代理失败',
        },
      },
      { status: 500 }
    )
  }
}
