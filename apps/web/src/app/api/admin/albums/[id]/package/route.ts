import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { packageDownloadSchema, packageIdQuerySchema, albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface PhotoWithId {
  id: string
}

/**
 * 打包下载 API
 * POST /api/admin/albums/[id]/package - 创建打包下载任务
 * GET /api/admin/albums/[id]/package/[packageId] - 获取打包状态和下载链接
 */

// POST /api/admin/albums/[id]/package - 创建打包下载任务
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const { id } = idValidation.data
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误')
    }

    const bodyValidation = safeValidate(packageDownloadSchema, body)
    if (!bodyValidation.success) {
      return handleError(bodyValidation.error, '输入验证失败')
    }

    const {
      photoIds,
      photoSelection = 'all',
      includeWatermarked = true,
      includeOriginal = true,
    } = bodyValidation.data

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id, title, allow_download')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

        if (albumResult.error || !albumResult.data) {
          return ApiError.notFound('相册不存在')
        }

        const album = albumResult.data

        if (!album.allow_download) {
          return ApiError.forbidden('此相册不允许下载')
        }

    // 确定要打包的照片
    let finalPhotoIds: string[] = []

    if (photoSelection === 'selected') {
      // 获取已选照片（排除已删除的）
      const selectedPhotosResult = await db
        .from('photos')
        .select('id')
        .eq('album_id', id)
        .eq('is_selected', true)
        .eq('status', 'completed')
        .is('deleted_at', null)

      finalPhotoIds = ((selectedPhotosResult.data || []) as PhotoWithId[]).map((p) => p.id)
    } else if (photoSelection === 'custom' && Array.isArray(photoIds)) {
      finalPhotoIds = photoIds
    } else {
      // 获取所有照片（排除已删除的）
      const allPhotosResult = await db
        .from('photos')
        .select('id')
        .eq('album_id', id)
        .eq('status', 'completed')
        .is('deleted_at', null)

      finalPhotoIds = ((allPhotosResult.data || []) as PhotoWithId[]).map((p) => p.id)
    }

        if (finalPhotoIds.length === 0) {
          return ApiError.badRequest('没有可打包的照片')
        }

        // 限制打包数量
        if (finalPhotoIds.length > 500) {
          return ApiError.badRequest('单次最多打包500张照片')
        }

    // 创建打包任务记录
    const insertResult = await db.insert('package_downloads', {
      album_id: id,
      photo_ids: finalPhotoIds,
      include_watermarked: includeWatermarked,
      include_original: includeOriginal,
      status: 'pending',
    })

        if (insertResult.error) {
          return ApiError.internal(`数据库错误: ${insertResult.error.message}`)
        }

        const packageData = insertResult.data && insertResult.data.length > 0 ? insertResult.data[0] : null

        if (!packageData) {
          return ApiError.internal('创建打包任务失败')
        }

    // 触发 Worker 处理
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const workerApiKey = process.env.WORKER_API_KEY
    if (workerApiKey) {
      headers['X-API-Key'] = workerApiKey
    }
    try {
      await fetch(`${workerUrl}/api/package`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          packageId: packageData.id,
          albumId: id,
          photoIds: finalPhotoIds,
          includeWatermarked,
          includeOriginal,
        }),
      })
    } catch {
      console.error('Failed to trigger package worker:')
      // 即使 Worker 调用失败，也返回成功，因为任务已创建
    }

    return NextResponse.json({
      packageId: packageData.id,
      status: 'pending',
      message: '打包任务已创建，正在处理中...',
    })
  } catch (error) {
    return handleError(error, '创建打包任务失败')
  }
}

// GET /api/admin/albums/[id]/package/[packageId] - 获取打包状态
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const { id } = idValidation.data
    const { searchParams } = new URL(request.url)
    const packageId = searchParams.get('packageId')

    // 验证查询参数
    const queryValidation = safeValidate(packageIdQuerySchema, { packageId })
    if (!queryValidation.success) {
      return handleError(queryValidation.error, '缺少或无效的 packageId 参数')
    }

    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 获取打包任务信息
    const packageResult = await db
      .from('package_downloads')
      .select('*')
      .eq('id', queryValidation.data.packageId)
      .eq('album_id', id)
      .single()

    if (packageResult.error || !packageResult.data) {
      return ApiError.notFound('打包任务不存在')
    }

    return NextResponse.json(packageResult.data)
  } catch (error) {
    return handleError(error, '获取打包任务失败')
  }
}
