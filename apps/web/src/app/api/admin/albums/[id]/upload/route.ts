import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { v4 as uuidv4 } from 'uuid'
import { checkRateLimit } from '@/middleware-rate-limit'
import { uploadPhotoSchema, albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'
import { getInternalApiUrl } from '@/lib/utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 获取上传凭证 API
 * 
 * @route POST /api/admin/albums/[id]/upload
 * @description 为客户端生成 Presigned URL，用于直接上传文件到 MinIO 存储
 * 
 * @auth 需要管理员登录
 * 
 * @security
 * - 速率限制：每个用户每分钟最多 20 次请求
 * - 文件类型限制：仅支持 image/jpeg, image/png, image/heic, image/webp, image/gif, image/tiff
 * - 文件大小限制：最大 100MB
 * 
 * @param {string} id - 相册ID（UUID格式）
 * 
 * @body {Object} requestBody - 上传请求体
 * @body {string} requestBody.filename - 文件名（必填）
 * @body {string} requestBody.contentType - MIME 类型（必填，必须是支持的图片类型）
 * @body {number} [requestBody.fileSize] - 文件大小（字节，可选，用于验证）
 * 
 * @returns {Object} 200 - 成功返回上传凭证
 * @returns {string} 200.data.photoId - 照片ID（UUID）
 * @returns {string} 200.data.uploadUrl - Presigned URL（用于上传文件）
 * @returns {string} 200.data.originalKey - 原始文件在存储中的键名
 * @returns {string} 200.data.albumId - 相册ID
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败或文件类型不支持）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 429 - 请求过于频繁（速率限制）
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/albums/album-id/upload', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     filename: 'photo.jpg',
 *     contentType: 'image/jpeg',
 *     fileSize: 1024000
 *   })
 * })
 * const { photoId, uploadUrl } = await response.json()
 * // 使用 uploadUrl 上传文件到存储
 * ```
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/albums/album-123/upload', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     filename: 'photo.jpg',
 *     contentType: 'image/jpeg',
 *     fileSize: 1024000
 *   })
 * });
 * const data = await response.json();
 * // 使用 data.uploadUrl 上传文件
 * ```
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  let response: NextResponse | null = null
  let photoId: string | null = null
  
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const albumId = idValidation.data.id
    response = new NextResponse()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 速率限制：每个用户每分钟最多 300 次上传请求（支持批量并发上传）
    // 假设并发为 5，每秒处理 5 张，一分钟可处理 300 张
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const identifier = `upload:${user.id}:${ip}`
    const rateLimit = await checkRateLimit(identifier, 300, 60 * 1000) // 300 次/分钟

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `上传请求过于频繁，请稍后再试。将在 ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} 秒后重置`,
          },
        },
        {
          status: 429,
          headers: {
            ...(response && response.headers ? Array.from(response.headers.entries()).reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}) : {}),
            'X-RateLimit-Limit': '300',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // 验证相册存在
    const db = await createClient()
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(uploadPhotoSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { filename, contentType, fileSize, hash } = validation.data

    // 清理和验证文件名（防止路径遍历、注入攻击）
    // 1. 移除路径分隔符和特殊字符（防止路径遍历）
    const sanitizedFilename = filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // 移除特殊字符和控制字符
      .replace(/^\.+/, '') // 移除开头的点
      .replace(/\.+$/, '') // 移除结尾的点
      .trim()
    
    // 2. 验证文件名长度（防止DoS攻击）
    const MAX_FILENAME_LENGTH = 255 // 标准文件名长度限制
    if (!sanitizedFilename || sanitizedFilename.length === 0) {
      return ApiError.badRequest('文件名无效')
    }
    
    if (sanitizedFilename.length > MAX_FILENAME_LENGTH) {
      return ApiError.badRequest(`文件名过长（最大 ${MAX_FILENAME_LENGTH} 字符）`)
    }
    
    // 3. 验证文件名不包含路径遍历字符
    if (sanitizedFilename.includes('..') || sanitizedFilename.includes('../') || sanitizedFilename.includes('..\\')) {
      return ApiError.badRequest('文件名包含非法字符')
    }

    // 验证文件类型（双重验证：MIME 类型 + 文件扩展名）
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'image/gif', 'image/tiff']
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif', '.tiff', '.tif']
    
    // 1. 验证 MIME 类型
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_TYPE', message: '不支持的文件格式' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }
    
    // 2. 验证文件扩展名（防止伪造 MIME 类型）
    const ext = sanitizedFilename.split('.').pop()?.toLowerCase() || ''
    const fileExtension = ext ? `.${ext}` : ''
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_TYPE', message: '不支持的文件扩展名' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }
    
    // 3. 验证 MIME 类型与扩展名是否匹配（防止类型伪造）
    const mimeToExtMap: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/tiff': ['.tiff', '.tif'],
    }
    const validExtensions = mimeToExtMap[contentType] || []
    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_TYPE', message: '文件类型与扩展名不匹配' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }

    // 验证文件大小 (100MB)
    if (fileSize && fileSize > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: '文件大小不能超过 100MB' } },
        { 
          status: 400,
          headers: response.headers,
        }
      )
    }

    // 生成照片 ID 和存储路径
    photoId = uuidv4()
    const originalKey = `raw/${albumId}/${photoId}.${ext}`

    // 创建照片记录 (状态为 pending)
    const adminClient = await createAdminClient()
    const insertResult = await adminClient.insert('photos', {
      id: photoId,
      album_id: albumId,
      original_key: originalKey,
      filename: sanitizedFilename, // 使用清理后的文件名
      file_size: fileSize,
      mime_type: contentType,
      hash: hash, // hash 字段在 schema 中已定义
      status: 'pending',
    })

    if (insertResult.error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: insertResult.error.message } },
        { 
          status: 500,
          headers: response.headers,
        }
      )
    }

    // 获取 presigned URL 用于直接上传到 MinIO
    try {
      // 优先使用 Next.js 代理路由，避免直接连接 Worker 的问题
      // 代理路由会自动处理 Worker URL 配置和认证
      // 使用相对路径，Next.js 会自动处理
      const presignUrl = getInternalApiUrl('/api/worker/presign')
      
      let presignResponse: Response
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }
        
        // 传递认证 cookie，代理路由会处理认证
        const cookieHeader = request.headers.get('cookie')
        if (cookieHeader) {
          headers['cookie'] = cookieHeader
        }
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        
        try {
          presignResponse = await fetch(presignUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ key: originalKey }),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
        } catch (fetchErr) {
          clearTimeout(timeoutId)
          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            throw new Error('请求超时：Worker 服务响应时间过长（超过30秒）')
          }
          throw fetchErr
        }
      } catch (fetchError) {
        console.error('[Upload API] Fetch error when calling presign:', fetchError)
        
        // 确保 response 已初始化
        if (!response) {
          response = new NextResponse()
        }
        
        try {
          await adminClient.delete('photos', { id: photoId })
        } catch (cleanupError) {
          console.error('[Upload API] Failed to cleanup photo record:', cleanupError)
        }
        
        const errorMsg = fetchError instanceof Error ? fetchError.message : '无法连接到 Worker 服务'
        
        // 检查是否是连接错误
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed') || errorMsg.includes('ECONNRESET')) {
          try {
            await adminClient.delete('photos', { id: photoId })
          } catch (cleanupError) {
            console.error('[Upload API] Failed to cleanup photo record:', cleanupError)
          }
          
          return NextResponse.json(
            {
              error: {
                code: 'WORKER_UNAVAILABLE',
                message: 'Worker 服务不可用',
                details: '无法连接到 Worker 服务。请确保 Worker 服务正在运行（运行 `pnpm dev:worker` 启动 Worker 服务）。',
              },
              photoId, // 包含 photoId，让前端知道需要清理
            },
            {
              status: 503,
              headers: response.headers,
            }
          )
        }
        
        return NextResponse.json(
          { 
            error: { 
              code: 'PRESIGN_FETCH_ERROR', 
              message: '获取上传凭证失败',
              details: `调用 Worker API 时出错: ${errorMsg}`
            },
            photoId // 包含 photoId，让前端知道需要清理
          },
          { 
            status: 500,
            headers: response.headers,
          }
        )
      }
      
      if (!presignResponse.ok) {
        if (!response) {
          response = new NextResponse()
        }
        
        const errorText = await presignResponse.text()
        let errorData: { error?: string | { code?: string; message?: string; details?: string }; details?: string } = {}
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        
        // 处理嵌套的错误对象
        const errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : (errorData.error && typeof errorData.error === 'object' ? errorData.error.message : null) || '获取上传凭证失败'
        const errorCode = typeof errorData.error === 'string' 
          ? 'PRESIGN_FAILED'
          : (errorData.error && typeof errorData.error === 'object' ? errorData.error.code : null) || 'PRESIGN_FAILED'
        const errorDetails = (typeof errorData.error === 'object' && errorData.error && 'details' in errorData.error 
          ? errorData.error.details 
          : null) || errorData.details || errorText
        
        console.error('[Upload API] Failed to get presigned URL:', {
          status: presignResponse.status,
          statusText: presignResponse.statusText,
          url: presignUrl,
          errorMessage,
          errorCode,
          errorDetails,
          errorText,
          errorData
        })
        
        try {
          await adminClient.delete('photos', { id: photoId })
        } catch (cleanupError) {
          console.error('[Upload API] Failed to cleanup photo record:', cleanupError)
        }
        
        return NextResponse.json(
          { 
            error: { 
              code: errorCode, 
              message: errorMessage,
              details: errorDetails
            },
            photoId // 包含 photoId，让前端知道需要清理
          },
          { 
            status: presignResponse.status,
            headers: response.headers,
          }
        )
      }
      
      const presignData = await presignResponse.json()
      const { url: presignedUrl } = presignData
      
      if (!presignedUrl) {
        if (!response) {
          response = new NextResponse()
        }
        
        console.error('[Upload API] Presigned URL is missing in response')
        
        try {
          await adminClient.delete('photos', { id: photoId })
        } catch (cleanupError) {
          console.error('[Upload API] Failed to cleanup photo record:', cleanupError)
        }
        
        return NextResponse.json(
          { error: { code: 'INVALID_RESPONSE', message: '服务器返回格式错误', details: 'Presigned URL 缺失' } },
          { 
            status: 500,
            headers: response ? response.headers : {},
          }
        )
      }
      
      return NextResponse.json(
        {
          photoId,
          uploadUrl: presignedUrl,
          originalKey,
          albumId,
        },
        {
          headers: response ? response.headers : {},
        }
      )
    } catch (presignError) {
      console.error('[Upload API] Error getting presigned URL:', presignError)
      
      if (!response) {
        response = new NextResponse()
      }
      
      try {
        await adminClient.delete('photos', { id: photoId })
      } catch (cleanupError) {
        console.error('[Upload API] Failed to cleanup photo record:', cleanupError)
      }
      
      const errorMessage = presignError instanceof Error ? presignError.message : '获取上传凭证时发生未知错误'
      
      return NextResponse.json(
        { 
          error: { 
            code: 'PRESIGN_ERROR', 
            message: '获取上传凭证失败',
            details: errorMessage
          } 
        },
        { 
          status: 500,
          headers: response.headers,
        }
      )
    }
  } catch (error) {
    console.error('[Upload API] Unhandled error:', error)
    
    const errorMessage = error instanceof Error ? error.message : '服务器错误'
    
    if (photoId) {
      Promise.resolve().then(async () => {
        try {
          const adminClient = await createAdminClient()
          await adminClient.delete('photos', { id: photoId })
        } catch (cleanupError) {
          console.error('[Upload API] Failed to cleanup photo record:', cleanupError)
        }
      }).catch(() => {})
    }
    
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: errorMessage
        } 
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
