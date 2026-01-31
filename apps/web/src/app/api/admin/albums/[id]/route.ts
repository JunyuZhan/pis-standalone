import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import type { AlbumUpdate } from '@/types/database'
import { updateAlbumSchema, albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 单相册管理 API
 * 
 * @route GET /api/admin/albums/[id]
 * @route PATCH /api/admin/albums/[id]
 * @route DELETE /api/admin/albums/[id]
 * @description 相册详情、更新和删除接口
 */

/**
 * 获取相册详情
 * 
 * @route GET /api/admin/albums/[id]
 * @description 获取指定相册的详细信息
 * 
 * @auth 需要管理员登录
 * 
 * @param {string} id - 相册ID（UUID格式）
 * 
 * @returns {Object} 200 - 成功返回相册详情
 * @returns {Object} 200.data - 相册数据对象
 * @returns {string} 200.data.id - 相册ID
 * @returns {string} 200.data.title - 相册标题
 * @returns {string} 200.data.slug - 相册标识
 * @returns {number} 200.data.photo_count - 照片数量
 * 
 * @returns {Object} 400 - 请求参数错误（无效的相册ID）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 500 - 服务器内部错误
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // 获取相册详情（含照片数量）
    const result = await db
      .from('albums')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (result.error || !result.data) {
      return ApiError.notFound('相册不存在')
    }

    return createSuccessResponse(result.data)
  } catch (error) {
    return handleError(error, '查询相册详情失败')
  }
}

/**
 * 更新相册设置
 * 
 * @route PATCH /api/admin/albums/[id]
 * @description 更新相册的设置信息（支持部分更新）
 * 
 * @auth 需要管理员登录
 * 
 * @param {string} id - 相册ID（UUID格式）
 * 
 * @body {Object} requestBody - 要更新的字段（所有字段可选）
 * @body {string} [requestBody.title] - 相册标题
 * @body {string} [requestBody.description] - 相册描述
 * @body {boolean} [requestBody.is_public] - 是否公开
 * @body {string} [requestBody.layout] - 布局类型
 * @body {string} [requestBody.sort_rule] - 排序规则
 * @body {boolean} [requestBody.allow_download] - 允许下载
 * @body {boolean} [requestBody.show_exif] - 显示EXIF信息
 * @body {Object} [requestBody.settings] - 其他设置
 * 
 * @returns {Object} 200 - 更新成功
 * @returns {Object} 200.data - 更新后的相册数据
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 500 - 服务器内部错误
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // 验证输入（使用 partial 允许所有字段可选）
    const validation = safeValidate(updateAlbumSchema.partial(), body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const validatedData = validation.data
    
    // 构建更新数据（已验证的数据可以直接使用）
    const updateData: AlbumUpdate = {}
    
    // 处理每个字段（只包含提供的字段）
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title.trim()
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description?.trim() || null
    }
    if (validatedData.cover_photo_id !== undefined) {
      updateData.cover_photo_id = validatedData.cover_photo_id || null
    }
    if (validatedData.is_public !== undefined) {
      updateData.is_public = validatedData.is_public
    }
    if (validatedData.is_live !== undefined) {
      updateData.is_live = validatedData.is_live
    }
    if (validatedData.layout !== undefined) {
      updateData.layout = validatedData.layout
    }
    if (validatedData.sort_rule !== undefined) {
      updateData.sort_rule = validatedData.sort_rule
    }
    if (validatedData.allow_download !== undefined) {
      updateData.allow_download = validatedData.allow_download
    }
    if (validatedData.allow_batch_download !== undefined) {
      updateData.allow_batch_download = validatedData.allow_batch_download
    }
    if (validatedData.show_exif !== undefined) {
      updateData.show_exif = validatedData.show_exif
    }
    if (validatedData.watermark_enabled !== undefined) {
      updateData.watermark_enabled = validatedData.watermark_enabled
    }
    if (validatedData.watermark_type !== undefined) {
      updateData.watermark_type = validatedData.watermark_type || null
    }
    if (validatedData.watermark_config !== undefined) {
      updateData.watermark_config = validatedData.watermark_config as Json || null
    }
    if (validatedData.color_grading !== undefined) {
      updateData.color_grading = validatedData.color_grading as Json || null
    }
    if (validatedData.password !== undefined) {
      // 密码字段：空字符串转换为 null
      updateData.password = validatedData.password || null
    }
    if (validatedData.expires_at !== undefined) {
      // 时间字段：空字符串转换为 null，否则使用 ISO 格式
      updateData.expires_at = validatedData.expires_at || null
    }
    if (validatedData.share_title !== undefined) {
      updateData.share_title = validatedData.share_title?.trim() || null
    }
    if (validatedData.share_description !== undefined) {
      updateData.share_description = validatedData.share_description?.trim() || null
    }
    if (validatedData.share_image_url !== undefined) {
      updateData.share_image_url = validatedData.share_image_url || null
    }
    if (validatedData.poster_image_url !== undefined) {
      updateData.poster_image_url = validatedData.poster_image_url || null
    }
    if (validatedData.event_date !== undefined) {
      updateData.event_date = validatedData.event_date || null
    }
    if (validatedData.location !== undefined) {
      updateData.location = validatedData.location?.trim() || null
    }

    // 同步照片计数（确保计数准确，排除已删除的）
    // 获取实际照片数量
    const photoCountResult = await db
      .from('photos')
      .select('*')
      .eq('album_id', id)
      .eq('status', 'completed')
      .is('deleted_at', null)
    
    const actualPhotoCount = photoCountResult.count || photoCountResult.data?.length || 0
    if (actualPhotoCount !== null) {
      updateData.photo_count = actualPhotoCount
    }

    // 执行更新
    // 注意：水印配置变更后，只对新上传的照片生效
    // 已上传的照片不会被重新处理，避免数据库错误和性能问题
    // 水印配置会在照片上传时由 Worker 读取并应用
    const result = await db.update('albums', updateData, { id, deleted_at: null })

    if (result.error) {
      return handleError(result.error, '更新相册失败')
    }

    const album = result.data && result.data.length > 0 ? result.data[0] : null
    if (!album) {
      return ApiError.notFound('相册不存在')
    }

    // 注意：水印配置变更后，只对新上传的照片生效
    // 已上传的照片不会被重新处理，避免数据库错误和性能问题
    // 水印配置会在照片上传时由 Worker 读取并应用（见 services/worker/src/index.ts）

    return createSuccessResponse({
      ...album,
      message: '设置已更新。水印配置将应用于之后上传的新照片。'
    })
  } catch (error) {
    return handleError(error, '更新相册失败')
  }
}

/**
 * 软删除相册
 * 
 * @route DELETE /api/admin/albums/[id]
 * @description 软删除相册（将相册移至回收站，不立即删除数据）
 * 
 * @auth 需要管理员登录
 * 
 * @param {string} id - 相册ID（UUID格式）
 * 
 * @returns {Object} 200 - 删除成功
 * @returns {boolean} 200.data.success - 操作是否成功
 * @returns {string} 200.data.message - 操作消息
 * 
 * @returns {Object} 400 - 请求参数错误（无效的相册ID）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @note 软删除后，相册数据仍保留在数据库中，可以通过恢复功能恢复
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // 软删除：设置 deleted_at 时间戳
    const result = await db.update('albums', { deleted_at: new Date().toISOString() }, { id, deleted_at: null })

    if (result.error) {
      return handleError(result.error, '删除相册失败')
    }

    const album = result.data && result.data.length > 0 ? result.data[0] : null
    if (!album) {
      return ApiError.notFound('相册不存在或已删除')
    }

    return createSuccessResponse({
      success: true,
      message: `相册「${album.title}」已删除`,
    })
  } catch (error) {
    return handleError(error, '删除相册失败')
  }
}
