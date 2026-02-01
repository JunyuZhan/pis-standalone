import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import type { PhotoGroupInsert } from '@/types/database'
import { albumIdSchema, createGroupSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 分组管理 API
 * - GET: 获取相册的所有分组
 * - POST: 创建新分组
 */

// GET /api/admin/albums/[id]/groups - 获取分组列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const { id: albumId } = idValidation.data
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

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 获取分组列表
    const groupsResult = await db
      .from('photo_groups')
      .select('*')
      .eq('album_id', albumId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (groupsResult.error) {
      return handleError(groupsResult.error, '查询分组列表失败')
    }

    const groups = (groupsResult.data || []) as Array<{ id: string }>

    // 优化：批量查询所有分组的照片数量，避免 N+1 查询问题
    const groupIds = groups.map((g) => g.id)
    const counts = new Map<string, number>()
    
    if (groupIds.length > 0) {
      // 批量查询所有分组的照片关联
      const assignmentsResult = await db
        .from('photo_group_assignments')
        .select('group_id')
        .in('group_id', groupIds)
        .execute()

      if (assignmentsResult.data) {
        const assignments = assignmentsResult.data as unknown as { group_id: string }[]
        // 统计每个分组的照片数量
        assignments.forEach((assignment) => {
          const groupId = assignment.group_id
          counts.set(groupId, (counts.get(groupId) || 0) + 1)
        })
      }
    }

    // 为每个分组添加照片数量
    const groupsWithCounts = groups.map((group) => ({
      ...group,
      photo_count: counts.get(group.id) || 0,
    }))

    return createSuccessResponse({ groups: groupsWithCounts })
  } catch (error) {
    return handleError(error, '获取分组列表失败')
  }
}

// POST /api/admin/albums/[id]/groups - 创建新分组
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const { id: albumId } = idValidation.data
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

    // 验证输入（需要添加 albumId 到 body 中）
    const bodyWithAlbumId = { ...(body as Record<string, unknown>), albumId }
    const validation = safeValidate(createGroupSchema, bodyWithAlbumId)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { name, description } = validation.data

    // 检查分组名称是否已存在
    const existingGroupResult = await db
      .from('photo_groups')
      .select('id')
      .eq('album_id', albumId)
      .eq('name', name.trim())
      .single()

    if (existingGroupResult.data) {
      return ApiError.conflict('分组名称已存在')
    }

    // 创建分组
    const insertData: PhotoGroupInsert = {
      album_id: albumId,
      name: name.trim(),
      description: description?.trim() || null,
      sort_order: 0,
    }

    const insertResult = await dbAdmin.insert('photo_groups', insertData)

    if (insertResult.error) {
      return handleError(insertResult.error, '创建分组失败')
    }

    const newGroup = insertResult.data && insertResult.data.length > 0 ? insertResult.data[0] : null

    return createSuccessResponse({
      group: {
        ...newGroup,
        photo_count: 0,
      },
    })
  } catch (error) {
    return handleError(error, '创建分组失败')
  }
}
