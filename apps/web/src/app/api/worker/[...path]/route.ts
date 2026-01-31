/**
 * Worker API 代理
 * 
 * 将所有请求转发到 Worker 服务，避免 CORS 问题并统一处理 API Key 认证
 * 
 * 路由映射:
 * - /api/worker/multipart/init -> WORKER_URL/api/multipart/init
 * - /api/worker/multipart/presign-part -> WORKER_URL/api/multipart/presign-part (生成分片 presigned URL，推荐)
 * - /api/worker/multipart/upload -> WORKER_URL/api/multipart/upload (保留兼容性)
 * - /api/worker/multipart/complete -> WORKER_URL/api/multipart/complete
 * - /api/worker/multipart/abort -> WORKER_URL/api/multipart/abort
 * - /api/worker/upload -> WORKER_URL/api/upload
 * - /api/worker/presign -> WORKER_URL/api/presign
 * - /api/worker/package -> WORKER_URL/api/package
 * - /api/worker/scan -> WORKER_URL/api/scan
 * - /api/worker/process -> WORKER_URL/api/process
 * - /api/worker/check-pending -> WORKER_URL/api/check-pending
 * - /api/worker/list-files -> WORKER_URL/api/list-files
 * - /api/worker/cleanup-file -> WORKER_URL/api/cleanup-file
 * - /api/worker/clear-album-cache -> WORKER_URL/api/clear-album-cache
 * - /api/worker/health -> WORKER_URL/health
 * 
 * 注意：所有端点（除了 /health）都需要用户认证，API Key 会自动添加
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'

// 配置路由超时时间（Vercel 默认 10 秒，分片上传需要更长时间）
// 分片上传可能需要 5 分钟，设置为 300 秒
export const maxDuration = 300

// Worker 服务 URL (服务端环境变量，不暴露给客户端)
// 支持多个变量名，确保兼容性
// 使用函数在运行时获取，而不是模块加载时，以便测试可以修改环境变量
function getWorkerUrl(): string {
  return process.env.WORKER_URL || process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    return await proxyRequest(request, await params)
  } catch (error) {
    // 处理 params 解析错误
    if (error instanceof Error && error.message.includes('params')) {
      return NextResponse.json(
        { 
          error: { 
            code: 'PROXY_ERROR',
            message: error.message,
            details: '请求参数解析失败'
          } 
        },
        { status: 500 }
      )
    }
    throw error
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    console.log(`[Worker Proxy POST] Request URL: ${request.url}`)
    console.log(`[Worker Proxy POST] Resolved params:`, JSON.stringify(resolvedParams))
    console.log(`[Worker Proxy POST] Path segments:`, JSON.stringify(resolvedParams.path))
    
    const response = await proxyRequest(request, resolvedParams)
    
    // 确保所有响应都包含缓存控制头，防止 Cloudflare 缓存
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')
    
    console.log(`[Worker Proxy POST] Response status: ${response.status}`)
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    // 处理 params 解析错误
    console.error(`[Worker Proxy POST] Error:`, error)
    console.error(`[Worker Proxy POST] Request URL: ${request.url}`)
    
    // 设置缓存控制头，防止 Cloudflare 缓存错误响应
    const errorHeaders = new Headers()
    errorHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    errorHeaders.set('Pragma', 'no-cache')
    errorHeaders.set('Expires', '0')
    
    if (error instanceof Error && error.message.includes('params')) {
      return NextResponse.json(
        { 
          error: { 
            code: 'PROXY_ERROR',
            message: error.message,
            details: '请求参数解析失败'
          } 
        },
        { 
          status: 500,
          headers: errorHeaders,
        }
      )
    }
    throw error
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    return await proxyRequest(request, await params)
  } catch (error) {
    // 处理 params 解析错误
    if (error instanceof Error && error.message.includes('params')) {
      return NextResponse.json(
        { 
          error: { 
            code: 'PROXY_ERROR',
            message: error.message,
            details: '请求参数解析失败'
          } 
        },
        { status: 500 }
      )
    }
    throw error
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    return await proxyRequest(request, await params)
  } catch (error) {
    // 处理 params 解析错误
    if (error instanceof Error && error.message.includes('params')) {
      return NextResponse.json(
        { 
          error: { 
            code: 'PROXY_ERROR',
            message: error.message,
            details: '请求参数解析失败'
          } 
        },
        { status: 500 }
      )
    }
    throw error
  }
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
) {
  try {
    const pathSegments = params.path
    
    // 调试日志
    console.log(`[Worker Proxy] Request path: ${request.url}`)
    console.log(`[Worker Proxy] params:`, JSON.stringify(params))
    console.log(`[Worker Proxy] pathSegments:`, JSON.stringify(pathSegments))
    console.log(`[Worker Proxy] pathSegments type:`, typeof pathSegments, Array.isArray(pathSegments))
    
    // 确保 pathSegments 是数组
    if (!Array.isArray(pathSegments)) {
      console.error(`[Worker Proxy] pathSegments is not an array:`, pathSegments)
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_PATH',
            message: 'Invalid path segments',
            details: `pathSegments should be an array, got: ${typeof pathSegments}`
          } 
        },
        { status: 400 }
      )
    }
    
    // 添加认证检查（除了 health 端点）
    // health 端点用于监控，不需要认证
    if (pathSegments[0] !== 'health') {
      const user = await getCurrentUser(request)
      
      if (!user) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
          { 
            status: 401,
            headers: response.headers,
          }
        )
      }
    }
    
    // 构建目标 URL
    // 前端调用 /api/worker/presign，pathSegments = ['presign']
    // 需要转换为 /api/presign（Worker 服务的实际路径）
    // 前端调用 /api/worker/api/multipart/init，pathSegments = ['api', 'multipart', 'init']
    // 需要转换为 /api/multipart/init
    let targetPath: string
    
    // 特殊处理 health 端点
    if (pathSegments[0] === 'health') {
      targetPath = '/health'
    } else if (pathSegments[0] === 'presign') {
      // presign 端点需要映射到 /api/presign
      // presign/get 端点映射到 /api/presign/get
      if (pathSegments[1] === 'get') {
        targetPath = '/api/presign/get'
      } else {
        targetPath = '/api/presign'
      }
    } else if (pathSegments[0] === 'api') {
      // 如果第一个段是 'api'，保持原样
      targetPath = '/' + pathSegments.join('/')
    } else {
      // 其他情况，添加 /api 前缀
      targetPath = '/api/' + pathSegments.join('/')
    }
    
    // 保留查询参数
    const url = new URL(request.url)
    const queryString = url.search
    
    const targetUrl = `${getWorkerUrl()}${targetPath}${queryString}`
    
    console.log(`[Worker Proxy] ${request.method} ${request.url} -> ${targetUrl} (pathSegments: ${JSON.stringify(pathSegments)}, targetPath: ${targetPath})`)
    
    // 准备请求头
    const headers: HeadersInit = {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    }
    
    // 添加 Worker API Key 认证
    const workerApiKey = process.env.WORKER_API_KEY
    if (workerApiKey) {
      headers['X-API-Key'] = workerApiKey
    }
    
    // 转发请求
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    }
    
    // 对于有 body 的请求，转发 body
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers.get('Content-Type') || ''
      
      if (contentType.includes('application/json')) {
        // JSON 请求
        const body = await request.text()
        fetchOptions.body = body
      } else {
        // 二进制数据 (如分片上传)
        // 使用流式传输，避免大文件导致内存问题
        // 注意：Next.js 的 request.body 是一个 ReadableStream
        try {
          const body = await request.arrayBuffer()
          fetchOptions.body = body
          headers['Content-Type'] = contentType || 'application/octet-stream'
          
          // 添加 Content-Length（如果存在）
          const contentLength = request.headers.get('Content-Length')
          if (contentLength) {
            headers['Content-Length'] = contentLength
          }
        } catch (bodyError) {
          // 如果读取 body 失败（如连接关闭），返回错误
          console.error('[Worker Proxy] Failed to read request body:', bodyError)
          return NextResponse.json(
            { 
              error: { 
                code: 'BODY_READ_ERROR',
                message: '读取请求体失败',
                details: bodyError instanceof Error ? bodyError.message : '连接可能已关闭'
              } 
            },
            { status: 400 }
          )
        }
      }
    }
    
    // 设置超时（分片上传可能需要更长时间）
    const controller = new AbortController()
    // 检查是否是分片上传请求：/api/worker/multipart/upload 或 /api/worker/api/multipart/upload
    const isMultipartUpload = (pathSegments.includes('multipart') && pathSegments.includes('upload')) ||
                              targetPath.includes('/multipart/upload')
    const timeout = isMultipartUpload ? 300000 : 30000 // 分片上传：5分钟，其他：30秒
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    let workerResponse: Response
    try {
      workerResponse = await fetch(targetUrl, {
        ...fetchOptions,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: { 
              code: 'TIMEOUT',
              message: '请求超时',
              details: isMultipartUpload ? '分片上传超时（超过5分钟）' : '请求超时（超过30秒）'
            } 
          },
          { status: 408 }
        )
      }
      throw fetchError
    }
    
    // 读取响应
    const responseContentType = workerResponse.headers.get('Content-Type') || ''
    
    // 设置缓存控制头，防止 Cloudflare 缓存 API 路由
    const responseHeaders = new Headers()
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    responseHeaders.set('Pragma', 'no-cache')
    responseHeaders.set('Expires', '0')
    responseHeaders.set('X-Robots-Tag', 'noindex')
    
    if (responseContentType.includes('application/json')) {
      const data = await workerResponse.json()
      // 如果响应包含错误，统一错误格式
      if (!workerResponse.ok && data.error) {
        return NextResponse.json(
          { 
            error: { 
              code: data.error.code || 'WORKER_ERROR',
              message: typeof data.error === 'string' ? data.error : (data.error.message || data.error),
              details: data.error.details || data.details
            } 
          },
          { 
            status: workerResponse.status,
            headers: responseHeaders,
          }
        )
      }
      return NextResponse.json(
        data, 
        { 
          status: workerResponse.status,
          headers: responseHeaders,
        }
      )
    } else {
      const data = await workerResponse.arrayBuffer()
      responseHeaders.set('Content-Type', responseContentType)
      return new NextResponse(data, {
        status: workerResponse.status,
        headers: responseHeaders,
      })
    }
  } catch (error) {
    console.error('[Worker Proxy] Error:', error)
    
    // 设置缓存控制头，防止 Cloudflare 缓存错误响应
    const errorHeaders = new Headers()
    errorHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    errorHeaders.set('Pragma', 'no-cache')
    errorHeaders.set('Expires', '0')
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // 检查是否是连接错误
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed') || errorMessage.includes('ECONNRESET')) {
      return NextResponse.json(
        { 
          error: { 
            code: 'WORKER_UNAVAILABLE',
            message: 'Worker 服务不可用',
            details: `无法连接到 Worker 服务 (${getWorkerUrl()})。请检查 Worker 服务是否正在运行，以及 WORKER_URL 环境变量是否正确配置。`
          }
        },
        { 
          status: 503,
          headers: errorHeaders,
        }
      )
    }
    
    return NextResponse.json(
      { 
        error: { 
          code: 'PROXY_ERROR',
          message: errorMessage,
          details: '请求转发到 Worker 服务时发生错误'
        } 
      },
      { 
        status: 500,
        headers: errorHeaders,
      }
    )
  }
}
