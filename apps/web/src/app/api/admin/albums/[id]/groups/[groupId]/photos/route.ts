import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { albumGroupParamsSchema, assignPhotosToGroupSchema, removePhotosFromGroupSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string; groupId: string }>
}

interface PhotoGroupAssignment {
  photo_id: string
}

/**
 * 照片分组分配 API
 * - GET: 获取分组中的所有照片ID
 * - POST: 将照片分配到分组
 * - DELETE: 从分组移除照片
 */

// GET /api/admin/albums/[id]/groups/[groupId]/photos - 获取分组中的照片ID列表
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

    // 验证登录状态（管理员）或公开访问（访客）
    const user = await getCurrentUser(request)

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id, user_id, is_public')
      .eq('id', albumId)
      .single()

    if (!albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    const album = albumResult.data

    // 验证权限：管理员或公开相册的访客
    if (user && album.user_id === user.id) {
      // 管理员可以访问
    } else if (album.is_public) {
      // 公开相册的访客可以访问
    } else {
      return ApiError.forbidden('无权访问此相册')
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

    // 获取分组中的照片ID列表
    const assignmentsResult = await db
      .from('photo_group_assignments')
      .select('photo_id')
      .eq('group_id', groupId)

    if (assignmentsResult.error) {
      return ApiError.internal(`数据库错误: ${assignmentsResult.error.message}`)
    }

    const photoIds = ((assignmentsResult.data || []) as PhotoGroupAssignment[]).map((a) => a.photo_id)

    return NextResponse.json({ photo_ids: photoIds })
  } catch (error) {
    return handleError(error, '获取分组照片失败')
  }
}

// POST /api/admin/albums/[id]/groups/[groupId]/photos - 分配照片到分组
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      return handleError(new Error('请求格式错误'), '请求体格式错误')
    }

    const bodyValidation = safeValidate(assignPhotosToGroupSchema, body)
    if (!bodyValidation.success) {
      return handleError(bodyValidation.error, '输入验证失败')
    }
    
    const { photo_ids } = bodyValidation.data

    // 验证所有照片都属于该相册
    const photosResult = await db
      .from('photos')
      .select('id')
      .eq('album_id', albumId)
      .in('id', photo_ids)

    if (photosResult.error || !photosResult.data || photosResult.data.length !== photo_ids.length) {
      return ApiError.badRequest('部分照片不存在或不属于此相册')
    }

    // 批量插入分组关联（忽略已存在的关联）
    // 注意：PostgreSQL客户端暂不支持upsert，需要先检查是否存在，然后插入
    const assignments = photo_ids.map((photoId: string) => ({
      photo_id: photoId,
      group_id: groupId,
    }))

    // 先检查已存在的关联
    const existingResult = await dbAdmin
      .from('photo_group_assignments')
      .select('photo_id')
      .eq('group_id', groupId)
      .in('photo_id', photo_ids)

    const existingPhotoIds = new Set(((existingResult.data || []) as PhotoGroupAssignment[]).map((a: PhotoGroupAssignment) => a.photo_id))
    const newAssignments = assignments.filter((a: { group_id: string; photo_id: string }) => !existingPhotoIds.has(a.photo_id))

    if (newAssignments.length > 0) {
      const insertResult = await dbAdmin.insert('photo_group_assignments', newAssignments)

    if (insertResult.error) {
      return ApiError.internal(`数据库错误: ${insertResult.error.message}`)
    }
    }

    return NextResponse.json({
      success: true,
      assigned_count: photo_ids.length,
    })
  } catch (error) {
    return handleError(error, '分配照片到分组失败')
  }
}

// DELETE /api/admin/albums/[id]/groups/[groupId]/photos - 从分组移除照片
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

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误')
    }

    const bodyValidation = safeValidate(removePhotosFromGroupSchema, body)
    if (!bodyValidation.success) {
      return handleError(bodyValidation.error, '输入验证失败')
    }
    
    const { photo_ids } = bodyValidation.data

    // 删除分组关联
    // 批量删除：为每个照片ID执行删除操作
    interface DeleteResult {
      error?: Error | null
    }
    const deletePromises = photo_ids.map((photoId: string) => 
      dbAdmin.delete('photo_group_assignments', { group_id: groupId, photo_id: photoId })
    )
    const deleteResults = await Promise.all(deletePromises)
    const deleteError = deleteResults.find((r: DeleteResult) => r.error)?.error

    if (deleteError) {
      return ApiError.internal(`数据库错误: ${deleteError.message}`)
    }

    return NextResponse.json({
      success: true,
      removed_count: photo_ids.length,
    })
  } catch (error) {
    return handleError(error, '从分组移除照片失败')
  }
}
