import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { albumSlugSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ slug: string }>
}

interface PhotoGroup {
  id: string
  [key: string]: unknown
}

interface PhotoWithId {
  id: string
  status: string
  deleted_at: string | null
  album_id: string
}

interface PhotoGroupAssignment {
  group_id: string
  photo_id: string
}

/**
 * 公开相册分组 API
 * - GET: 获取相册的所有分组（访客可访问）
 */

// GET /api/public/albums/[slug]/groups - 获取分组列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const slugValidation = safeValidate(albumSlugSchema, paramsData)
    if (!slugValidation.success) {
      return handleError(slugValidation.error, '无效的相册标识')
    }
    
    const { slug } = slugValidation.data
    const db = await createClient()

    // 获取相册信息（使用 slug）
    const albumResult = await db
      .from('albums')
      .select('id, is_public, deleted_at, expires_at')
      .eq('slug', slug)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    const album = albumResult.data

    // 验证相册是否公开且未过期
    if (!album.is_public || album.deleted_at) {
      return ApiError.forbidden('无权访问此相册')
    }

    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden('相册已过期')
    }

    // 获取分组列表
    const groupsResult = await db
      .from('photo_groups')
      .select('*')
      .eq('album_id', album.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (groupsResult.error) {
      return handleError(groupsResult.error, '查询分组列表失败')
    }

    const groups = (groupsResult.data || []) as PhotoGroup[]

    // 优化：批量查询所有分组的照片数量，避免 N+1 查询问题
    const groupIds = groups.map((g) => g.id)
    
    const counts = new Map<string, number>()
    
    if (groupIds.length > 0) {
      // 批量查询所有分组的照片关联（只统计已完成且相册和照片都未删除的）
      // 先查询所有照片，然后过滤
      const photosResult = await db
        .from('photos')
        .select('id, status, deleted_at, album_id')
        .eq('album_id', album.id)
        .eq('status', 'completed')
        .is('deleted_at', null)

      if (photosResult.data) {
        const photos = photosResult.data as PhotoWithId[]
        const validPhotoIds = new Set(photos.map((p) => p.id))
        
        // 查询分组关联
        const assignmentsResult = await db
          .from('photo_group_assignments')
          .select('group_id, photo_id')
          .in('group_id', groupIds)
          .in('photo_id', Array.from(validPhotoIds))

        if (assignmentsResult.data) {
          // 在前端聚合计数
          const assignments = assignmentsResult.data as PhotoGroupAssignment[]
          assignments.forEach((assignment) => {
            const groupId = assignment.group_id
            counts.set(groupId, (counts.get(groupId) || 0) + 1)
          })
        }
      }
    }

    // 为每个分组添加照片数量
    const groupsWithCounts = groups.map((group) => ({
      ...group,
      photo_count: counts.get(group.id) || 0,
    }))

    // 只返回有照片的分组
    const groupsWithPhotos = groupsWithCounts.filter((g) => g.photo_count > 0)

    return createSuccessResponse({ groups: groupsWithPhotos })
  } catch (error) {
    return handleError(error, '获取分组列表失败')
  }
}
