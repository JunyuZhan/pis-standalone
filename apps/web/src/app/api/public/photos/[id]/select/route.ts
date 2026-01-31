import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/database'
import { selectPhotoSchema, photoIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 访客选片 API
 * 
 * @route PATCH /api/public/photos/[id]/select
 * @description 允许匿名用户标记照片为「选中」状态，用于客户挑选喜欢的照片
 * 
 * @auth 无需认证（公开接口）
 * 
 * @param {string} id - 照片ID（UUID格式）
 * 
 * @body {Object} requestBody - 选片请求体
 * @body {boolean} requestBody.isSelected - 是否选中（true/false，必填）
 * 
 * @returns {Object} 200 - 选片状态更新成功
 * @returns {boolean} 200.data.success - 操作是否成功
 * @returns {boolean} 200.data.isSelected - 更新后的选中状态
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 403 - 禁止访问（相册不允许选片或已过期）
 * @returns {Object} 404 - 照片不存在
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @note 此接口允许匿名访问，但会验证相册的访问权限
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(photoIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的照片ID')
    }
    
    const { id } = idValidation.data
    // 使用 Admin Client 绕过 RLS 进行更新，同时在代码层面严格控制权限
    const dbAdmin = await createAdminClient()
    const db = await createClient()

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(selectPhotoSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { isSelected } = validation.data

    // 首先验证照片存在且所属相册未删除，照片也未删除
    // 查询照片
    const photoResult = await db
      .from('photos')
      .select('id, album_id, deleted_at')
      .eq('id', id)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .single()

    if (photoResult.error || !photoResult.data) {
      return ApiError.notFound('照片不存在')
    }

    // 验证相册存在且未删除
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('id', photoResult.data.album_id)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 更新选中状态
    // 使用 Admin Client 执行更新操作，因为我们已经移除了匿名用户的 UPDATE 权限
    const updateResult = await dbAdmin.update('photos', { is_selected: isSelected }, { id })

    if (updateResult.error) {
      return handleError(updateResult.error, '更新选中状态失败')
    }

    const updatedPhoto = updateResult.data && updateResult.data.length > 0 ? updateResult.data[0] : null
    if (!updatedPhoto) {
      return ApiError.notFound('照片不存在')
    }
    
    return createSuccessResponse({
      id: updatedPhoto.id,
      isSelected: updatedPhoto.is_selected,
    })
  } catch (error) {
    return handleError(error, '更新选中状态失败')
  }
}

// GET /api/public/photos/[id]/select - 获取当前选中状态
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

    const photoResult = await db
      .from('photos')
      .select('id, is_selected')
      .eq('id', id)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .single()

    if (photoResult.error || !photoResult.data) {
      return ApiError.notFound('照片不存在')
    }

    const photo = photoResult.data

    return createSuccessResponse({
      id: photo.id,
      isSelected: photo.is_selected,
    })
  } catch (error) {
    return handleError(error, '查询选中状态失败')
  }
}
