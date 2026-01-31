import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import type { PhotoGroupUpdate } from '@/types/database'
import { albumGroupParamsSchema, updateGroupSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string; groupId: string }>
}

/**
 * 分组操作 API
 * - GET: 获取分组详情
 * - PATCH: 更新分组
 * - DELETE: 删除分组
 */

// GET /api/admin/albums/[id]/groups/[groupId] - 获取分组详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const paramsValidation = safeValidate(albumGroupParamsSchema, paramsData)
    if (!paramsValidation.success) {
      return handleError(paramsValidation.error, '无效的路径参数')
    }
    
    const { id: albumId, groupId } = paramsValidation.data
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (!albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 获取分组详情
    const groupResult = await db
      .from('photo_groups')
      .select('*')
      .eq('id', groupId)
      .eq('album_id', albumId)
      .single()

    if (groupResult.error || !groupResult.data) {
      return ApiError.notFound('分组不存在')
    }

    // 获取照片数量
    const countResult = await db
      .from('photo_group_assignments')
      .select('*')
      .eq('group_id', groupId)

    const count = countResult.count || countResult.data?.length || 0

    return createSuccessResponse({
      group: {
        ...groupResult.data,
        photo_count: count,
      },
    })
  } catch (error) {
    return handleError(error, '获取分组详情失败')
  }
}

// PATCH /api/admin/albums/[id]/groups/[groupId] - 更新分组
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const paramsValidation = safeValidate(albumGroupParamsSchema, paramsData)
    if (!paramsValidation.success) {
      return handleError(paramsValidation.error, '无效的路径参数')
    }
    
    const { id: albumId, groupId } = paramsValidation.data
    const db = await createClient()
    const dbAdmin = await createAdminClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (!albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 验证分组存在
    const groupResult = await db
      .from('photo_groups')
      .select('id')
      .eq('id', groupId)
      .eq('album_id', albumId)
      .single()

    if (!groupResult.data) {
      return ApiError.notFound('分组不存在')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入（使用 partial schema）
    const validation = safeValidate(updateGroupSchema.partial(), body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const updateData: PhotoGroupUpdate = {}
    const { name, description } = validation.data

    if (name !== undefined) {
      // 检查名称是否与其他分组重复
      const existingGroupResult = await db
        .from('photo_groups')
        .select('id')
        .eq('album_id', albumId)
        .eq('name', name.trim())
        .neq('id', groupId)
        .single()

      if (existingGroupResult.data) {
        return ApiError.conflict('分组名称已存在')
      }

      updateData.name = name.trim()
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    // 更新分组
    const updateResult = await dbAdmin.update('photo_groups', updateData, { id: groupId })

    if (updateResult.error) {
      return handleError(updateResult.error, '更新分组失败')
    }

    const updatedGroup = updateResult.data && updateResult.data.length > 0 ? updateResult.data[0] : null

    // 获取照片数量
    const countResult = await db
      .from('photo_group_assignments')
      .select('*')
      .eq('group_id', groupId)

    const count = countResult.count || countResult.data?.length || 0

    return createSuccessResponse({
      group: {
        ...updatedGroup,
        photo_count: count,
      },
    })
  } catch (error) {
    return handleError(error, '更新分组失败')
  }
}

// DELETE /api/admin/albums/[id]/groups/[groupId] - 删除分组
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const paramsValidation = safeValidate(albumGroupParamsSchema, paramsData)
    if (!paramsValidation.success) {
      return handleError(paramsValidation.error, '无效的路径参数')
    }
    
    const { id: albumId, groupId } = paramsValidation.data
    const db = await createClient()
    const dbAdmin = await createAdminClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (!albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 验证分组存在
    const groupResult = await db
      .from('photo_groups')
      .select('id')
      .eq('id', groupId)
      .eq('album_id', albumId)
      .single()

    if (!groupResult.data) {
      return ApiError.notFound('分组不存在')
    }

    // 删除分组（关联的照片会自动解除关联，因为外键设置了 ON DELETE CASCADE）
    const deleteResult = await dbAdmin.delete('photo_groups', { id: groupId })

    if (deleteResult.error) {
      return handleError(deleteResult.error, '删除分组失败')
    }

    return createSuccessResponse({ success: true })
  } catch (error) {
    return handleError(error, '删除分组失败')
  }
}
