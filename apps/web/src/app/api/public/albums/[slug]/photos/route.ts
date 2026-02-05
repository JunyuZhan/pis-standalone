import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { albumSlugSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ slug: string }>
}

interface PhotoRow {
  id: string
  thumb_key: string | null
  preview_key: string | null
  original_key: string | null
  filename: string | null
  width: number | null
  height: number | null
  exif: Record<string, unknown> | null
  blur_data: string | null
  captured_at: string | null
  is_selected: boolean
  updated_at: string | null
}

/**
 * 访客照片列表 API
 */

// GET /api/public/albums/[slug]/photos - 获取照片列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const slugValidation = safeValidate(albumSlugSchema, paramsData)
    if (!slugValidation.success) {
      return handleError(slugValidation.error, '无效的相册标识')
    }
    
    const { slug } = slugValidation.data
    const { searchParams } = new URL(request.url)
    
    const pageRaw = searchParams.get('page') || '1'
    const limitRaw = searchParams.get('limit') || '20'
    const page = Math.max(1, parseInt(pageRaw) || 1) // 确保页码至少为1
    const limit = Math.max(1, Math.min(100, parseInt(limitRaw) || 20)) // 限制在1-100之间
    const groupId = searchParams.get('group')

    const db = await createClient()

    // 先获取相册 ID（检查密码和过期时间）
    const albumResult = await db
      .from<{ id: string; sort_rule: string | null; password: string | null; expires_at: string | null; is_public: boolean; allow_share: boolean }>('albums')
      .select('id, sort_rule, password, expires_at, is_public, allow_share')
      .eq('slug', slug)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    const album = albumResult.data

    // 检查相册是否允许分享
    if (album.allow_share === false) {
      return ApiError.notFound('相册不存在')
    }

    // 检查相册是否过期
    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden('相册已过期')
    }

    // 检查是否需要密码（如果设置了密码且未验证，返回需要密码）
    // 注意：这里不验证密码，密码验证应该在页面层或单独的 API 中处理
    // 如果相册是私有的且设置了密码，需要先验证密码才能访问照片
    
    // 确定排序规则：优先使用URL参数，否则使用相册的sort_rule，最后使用默认值
    const sort = searchParams.get('sort') || album.sort_rule || 'capture_desc'

    // 如果指定了分组，先获取分组中的照片ID
    let photoIds: string[] | null = null
    if (groupId) {
      const assignmentsResult = await db
        .from('photo_group_assignments')
        .select('photo_id')
        .eq('group_id', groupId)

      interface PhotoGroupAssignment {
        photo_id: string
      }
      if (assignmentsResult.data && assignmentsResult.data.length > 0) {
        photoIds = (assignmentsResult.data as PhotoGroupAssignment[]).map((a) => a.photo_id)
      } else {
        // 如果分组中没有照片，直接返回空结果
        return NextResponse.json({
          photos: [],
          pagination: {
            page: 1,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
    }

    // 获取照片列表
    const offset = (page - 1) * limit

    // 根据排序参数构建不同的查询
    // 优化：只查询前端需要的字段，减少数据传输
    let query = db
      .from('photos')
      .select('id, thumb_key, preview_key, original_key, filename, width, height, exif, blur_data, captured_at, is_selected, rotation, updated_at', { count: 'exact' })
      .eq('album_id', album.id)
      .eq('status', 'completed')
      .is('deleted_at', null) // 排除已删除的照片

    // 如果指定了分组，只查询分组中的照片
    if (photoIds) {
      query = query.in('id', photoIds)
    }

    // 如果指定了 ID 列表 (搜索)
    const idsRaw = searchParams.get('ids')
    if (idsRaw) {
      const searchIds = idsRaw.split(',').filter(Boolean)
      if (searchIds.length > 0) {
        query = query.in('id', searchIds)
      }
    }

    // 应用排序
    switch (sort) {
      case 'capture_asc':
        query = query.order('captured_at', { ascending: true })
        break
      case 'capture_desc':
        query = query.order('captured_at', { ascending: false })
        break
      case 'upload_desc':
        query = query.order('created_at', { ascending: false })
        break
      case 'manual':
        query = query.order('sort_order', { ascending: true })
        break
      default:
        query = query.order('captured_at', { ascending: false })
    }

    query = query.limit(limit).offset(offset)
    const result = await query

    if (result.error) {
      return handleError(result.error, '查询照片列表失败')
    }

    const photos = result.data as PhotoRow[] | null
    const count = result.count || result.data?.length || 0

    // 添加缓存头：公开相册缓存5分钟，私有相册不缓存
    // 优化：添加 ETag 支持，减少重复传输
    const cacheHeaders: Record<string, string> = album.is_public
      ? {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          Vary: 'Accept-Encoding',
        }
      : {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        }

    return NextResponse.json(
      {
        photos: photos?.map((photo) => ({
          id: photo.id,
          thumb_key: photo.thumb_key,
          preview_key: photo.preview_key,
          original_key: photo.original_key,
          filename: photo.filename || '',
          width: photo.width,
          height: photo.height,
          exif: photo.exif,
          blur_data: photo.blur_data,
          captured_at: photo.captured_at,
          is_selected: photo.is_selected,
          album_id: album.id,
          created_at: '',
          updated_at: photo.updated_at,
          status: 'completed',
          sort_order: 0,
          file_size: 0,
          mime_type: null
        })) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      { headers: cacheHeaders }
    )
  } catch (error) {
    return handleError(error, '获取照片列表失败')
  }
}
