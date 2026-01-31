import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { getAlbumShareUrl } from '@/lib/utils'
import type { AlbumInsert, Database } from '@/types/database'
import { albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

type Album = Database['public']['Tables']['albums']['Row']

interface RouteParams {
  params: Promise<{ id: string }>
}

// 静态导出模式下跳过此路由
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/albums/[id]/duplicate - 复制相册
 * 复制相册的所有配置，但不复制照片
 */
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

    // 获取原相册信息
    const originalAlbumResult = await db
      .from('albums')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (originalAlbumResult.error || !originalAlbumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 构建新相册数据（复制所有配置，但不复制照片）
    const album = originalAlbumResult.data as Album
    const newAlbumData: AlbumInsert = {
      title: `${album.title} (副本)`,
      description: album.description,
      is_public: album.is_public,
      layout: album.layout,
      sort_rule: album.sort_rule,
      allow_download: album.allow_download,
      allow_batch_download: album.allow_batch_download,
      show_exif: album.show_exif,
      allow_share: album.allow_share ?? true,
      password: album.password || null,
      expires_at: album.expires_at || null,
      watermark_enabled: album.watermark_enabled,
      watermark_type: album.watermark_type,
      watermark_config: album.watermark_config,
      share_title: album.share_title || null,
      share_description: album.share_description || null,
      share_image_url: album.share_image_url || null,
      // 不复制封面和照片
      cover_photo_id: null,
      photo_count: 0,
      selected_count: 0,
      view_count: 0,
    }

    // 创建新相册
    const insertResult = await db.insert('albums', newAlbumData)

    if (insertResult.error) {
      return ApiError.internal(`数据库错误: ${insertResult.error.message}`)
    }

    const newAlbum = insertResult.data && insertResult.data.length > 0 ? insertResult.data[0] : null

    if (!newAlbum) {
      return ApiError.internal('创建相册失败')
    }

    // 生成分享URL（添加错误处理）
    let shareUrl: string
    try {
      shareUrl = getAlbumShareUrl(newAlbum.slug)
    } catch (error) {
      console.error('Failed to generate share URL:', error)
      // 如果slug无效，使用降级方案
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      shareUrl = `${appUrl}/album/${encodeURIComponent(newAlbum.slug || '')}`
    }

    return NextResponse.json({
      id: newAlbum.id,
      slug: newAlbum.slug,
      title: newAlbum.title,
      shareUrl,
      message: '相册已复制',
    })
  } catch (error) {
    return handleError(error, '复制相册失败')
  }
}
