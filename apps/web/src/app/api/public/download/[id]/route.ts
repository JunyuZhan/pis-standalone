import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { photoIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 原图下载 API
 * 
 * @route GET /api/public/download/[id]
 * @description 生成带签名的临时下载链接，仅当相册允许下载时才返回
 * 
 * @auth 无需认证（公开接口，但需要相册允许下载）
 * 
 * @param {string} id - 照片ID（UUID格式）
 * 
 * @returns {Object} 200 - 成功返回下载链接
 * @returns {string} 200.data.downloadUrl - 临时下载链接（带签名，有效期有限）
 * @returns {string} 200.data.filename - 文件名
 * 
 * @returns {Object} 403 - 禁止访问（相册不允许下载）
 * @returns {Object} 404 - 照片不存在或未完成处理
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @note 下载链接是临时的，包含签名信息，有效期有限
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(photoIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的照片ID')
    }
    
    const { id } = idValidation.data
    const db = await createClient()

    // 获取照片信息
    const photoResult = await db
      .from('photos')
      .select('id, original_key, filename, album_id')
      .eq('id', id)
      .eq('status', 'completed')
      .single()

    if (photoResult.error || !photoResult.data) {
      return ApiError.notFound('照片不存在')
    }

    const photo = photoResult.data

    // 获取相册信息，检查下载权限
    const albumResult = await db
      .from('albums')
      .select('id, allow_download, deleted_at')
      .eq('id', photo.album_id)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    const album = albumResult.data

    // 检查相册是否已删除
    if (album.deleted_at) {
      return ApiError.notFound('相册不存在')
    }

    // 检查下载权限
    if (!album.allow_download) {
      return ApiError.forbidden('该相册不允许下载原图')
    }

    // 通过 Worker API 生成 Presigned URL（Vercel 无法直接连接内网 MinIO）
    const workerUrl = process.env.WORKER_API_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const workerApiKey = process.env.WORKER_API_KEY
    
    if (!workerApiKey) {
      return handleError(new Error('WORKER_API_KEY not configured'), '服务器配置错误')
    }

    // 调用 Worker API 生成 presigned URL
    const workerResponse = await fetch(`${workerUrl}/api/presign/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': workerApiKey,
      },
      body: JSON.stringify({
        key: photo.original_key || '',
        expirySeconds: 5 * 60, // 5 分钟有效期
        responseContentDisposition: `attachment; filename="${encodeURIComponent(photo.filename || 'photo')}"`,
      }),
    })

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text()
      return handleError(new Error(`Worker API error: ${errorText}`), '生成下载链接失败')
    }

    const { url: downloadUrl } = await workerResponse.json()

    return createSuccessResponse({
      downloadUrl,
      filename: photo.filename || 'photo',
      expiresIn: 300, // 5 分钟
    })
  } catch (error: unknown) {
    return handleError(error, '获取下载链接失败')
  }
}
