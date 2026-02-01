/**
 * 媒体文件代理 API
 * 
 * 将 /media/* 请求代理到 MinIO 对象存储
 * 
 * @route GET /media/:path*
 * @description 代理媒体文件请求到 MinIO
 * 
 * 功能：
 * - 代理 MinIO 媒体文件
 * - 设置缓存头（7天）
 * - 支持 CORS（允许跨域访问）
 * - 流式传输大文件
 */

import { NextRequest, NextResponse } from 'next/server'
import * as Minio from 'minio'

// 配置超时时间（大文件可能需要更长时间）
export const maxDuration = 300 // 5分钟

/**
 * 创建 MinIO 客户端实例
 */
function createMinioClient(): Minio.Client {
  const host = process.env.MINIO_ENDPOINT_HOST || 'localhost'
  const port = process.env.MINIO_ENDPOINT_PORT 
    ? parseInt(process.env.MINIO_ENDPOINT_PORT) 
    : 9000
  const useSSL = process.env.MINIO_USE_SSL === 'true'
  const accessKey = process.env.MINIO_ACCESS_KEY || ''
  const secretKey = process.env.MINIO_SECRET_KEY || ''
  const region = process.env.MINIO_REGION || 'us-east-1'

  return new Minio.Client({
    endPoint: host,
    port: port,
    useSSL: useSSL,
    accessKey: accessKey,
    secretKey: secretKey,
    region: region,
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.path.join('/')
    const bucket = process.env.MINIO_BUCKET || 'pis-photos'
    
    // 创建 MinIO 客户端
    const minioClient = createMinioClient()
    
    // 检查文件是否存在
    try {
      await minioClient.statObject(bucket, path)
    } catch (statError: any) {
      if (statError.code === 'NotFound' || statError.code === 'NoSuchKey') {
        return new NextResponse(null, { status: 404 })
      }
      throw statError
    }
    
    // 获取文件流
    const stream = await minioClient.getObject(bucket, path)
    
    // 设置响应头
    const responseHeaders = new Headers()
    
    // Content-Type（根据文件扩展名推断）
    const ext = path.split('.').pop()?.toLowerCase()
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
    }
    const contentType = ext ? contentTypeMap[ext] || 'application/octet-stream' : 'application/octet-stream'
    responseHeaders.set('Content-Type', contentType)
    
    // 缓存设置（媒体文件缓存 7 天）
    responseHeaders.set('Cache-Control', 'public, max-age=604800, immutable')
    responseHeaders.set('Expires', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString())
    
    // CORS 设置（允许跨域访问，便于相册分享）
    const origin = request.headers.get('origin')
    if (origin) {
      responseHeaders.set('Access-Control-Allow-Origin', origin)
    } else {
      responseHeaders.set('Access-Control-Allow-Origin', '*')
    }
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range')
    
    // Accept-Ranges（支持范围请求）
    responseHeaders.set('Accept-Ranges', 'bytes')
    
    // 流式传输响应体（避免内存占用过大）
    return new NextResponse(stream as any, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error: any) {
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      return new NextResponse(null, { status: 404 })
    }
    console.error('[Media Proxy] Error:', error)
    return NextResponse.json(
      { 
        error: { 
          code: 'PROXY_ERROR',
          message: '媒体文件代理失败',
        } 
      },
      { status: 500 }
    )
  }
}

// 支持 HEAD 请求（用于检查文件是否存在）
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.path.join('/')
    const bucket = process.env.MINIO_BUCKET || 'pis-photos'
    
    // 创建 MinIO 客户端
    const minioClient = createMinioClient()
    
    // 获取文件元数据
    const stat = await minioClient.statObject(bucket, path)
    
    const responseHeaders = new Headers()
    
    // Content-Type
    const ext = path.split('.').pop()?.toLowerCase()
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
    }
    const contentType = ext ? contentTypeMap[ext] || 'application/octet-stream' : 'application/octet-stream'
    responseHeaders.set('Content-Type', contentType)
    
    // Content-Length
    if (stat.size) {
      responseHeaders.set('Content-Length', stat.size.toString())
    }
    
    // CORS
    const origin = request.headers.get('origin')
    if (origin) {
      responseHeaders.set('Access-Control-Allow-Origin', origin)
    } else {
      responseHeaders.set('Access-Control-Allow-Origin', '*')
    }
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    
    return new NextResponse(null, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error: any) {
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      return new NextResponse(null, { status: 404 })
    }
    console.error('[Media Proxy HEAD] Error:', error)
    return new NextResponse(null, { status: 500 })
  }
}

// 支持 OPTIONS 请求（CORS 预检）
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}
