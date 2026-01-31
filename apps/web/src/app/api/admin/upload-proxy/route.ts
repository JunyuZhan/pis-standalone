import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { uploadProxyQuerySchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

/**
 * 上传代理 API
 * 浏览器 → Next.js API → 远程 Worker
 * 这样可以避免 CORS 问题
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 获取并验证上传 key
    const key = request.nextUrl.searchParams.get('key')
    const queryValidation = safeValidate(uploadProxyQuerySchema, { key })
    if (!queryValidation.success) {
      return handleError(queryValidation.error, '缺少或无效的 key 参数')
    }

    // 获取 Content-Type
    const contentType = request.headers.get('content-type') || 'application/octet-stream'
    
    // 获取 Content-Length（如果存在）
    const contentLength = request.headers.get('content-length')
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0

    // 转发到远程 Worker
    const workerUrl = process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    
    // 记录上传请求信息（用于调试）
    console.log('[Upload Proxy] Forwarding upload:', {
      key: queryValidation.data.key,
      fileSize,
      contentType,
      workerUrl,
      uploadUrl,
    })

    // 使用流式传输绕过 Vercel 的 4.5MB 请求体限制
    // 直接流式转发请求体，而不是先读取到内存
    const controller = new AbortController()
    
    // 根据文件大小动态计算超时（最大30分钟）
    const fileSizeMb = fileSize / (1024 * 1024)
    const baseTimeout = 10 * 60 * 1000 // 10分钟
    const perMbTimeout = 5 * 1000 // 每MB 5秒
    const maxTimeout = 30 * 60 * 1000 // 30分钟
    const timeout = Math.min(baseTimeout + fileSizeMb * perMbTimeout, maxTimeout)
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // 准备请求头（包含 API Key）
      const workerApiKey = process.env.WORKER_API_KEY
      const headers: HeadersInit = {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        ...(workerApiKey ? { 'X-API-Key': workerApiKey } : {}),
      }
      
      // 使用流式传输：直接将请求体流式转发到 Worker
      const uploadUrlWithKey = `${workerUrl}/api/upload?key=${encodeURIComponent(queryValidation.data.key)}`
      const workerResponse = await fetch(uploadUrlWithKey, {
        method: 'PUT',
        headers,
        body: request.body, // 直接使用请求体流，不读取到内存
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text()
        console.error('Worker upload failed:', workerResponse.status, errorText)
        return ApiError.internal(`上传失败: ${workerResponse.status}`)
      }

      const result = await workerResponse.json()
      return NextResponse.json(result)
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      
      // 记录详细错误信息
      console.error('[Upload Proxy] Error details:', {
        error: errorMessage,
        workerUrl,
        uploadUrl,
        fileSize,
        key,
      })
      
      // 检查是否是连接错误（Worker不可达）
      if (errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('getaddrinfo')) {
        console.error('[Upload Proxy] Worker connection failed:', {
          workerUrl,
          error: errorMessage,
        })
        return NextResponse.json(
          { 
            error: { 
              code: 'WORKER_UNAVAILABLE', 
              message: `无法连接到Worker服务: ${workerUrl}`,
              details: errorMessage
            } 
          },
          { status: 503 }
        )
      }
      
      // 如果是超时或连接被关闭，可能上传已经成功但响应没返回
      // 返回一个"可能成功"的响应，让前端继续处理流程
      console.warn('[Upload Proxy] Connection issue, upload may have succeeded:', errorMessage)
      
      // 返回成功，因为文件可能已经上传
      return NextResponse.json({ 
        success: true, 
        key: queryValidation.data.key,
        warning: 'Upload response timeout, but file may have been uploaded successfully'
      })
    }

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Upload Proxy] Unexpected error:', {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
    })
    return handleError(err, '上传代理失败')
  }
}

// 处理 OPTIONS 预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
