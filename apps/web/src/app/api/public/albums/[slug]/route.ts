import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { albumSlugSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 访客相册 API
 * 
 * @route GET /api/public/albums/[slug]
 * @description 获取相册的公开信息（不包含照片列表，照片列表由 photos 子路由处理）
 */

/**
 * 获取相册公开信息
 * 
 * @route GET /api/public/albums/[slug]
 * @description 获取相册的公开信息，用于访客访问相册页面
 * 
 * @auth 无需认证（公开接口）
 * 
 * @param {string} slug - 相册标识（URL友好格式）
 * 
 * @query {string} [If-None-Match] - ETag 值（用于缓存验证）
 * 
 * @returns {Object} 200 - 成功返回相册信息
 * @returns {Object} 200.data - 相册数据对象
 * @returns {string} 200.data.id - 相册ID
 * @returns {string} 200.data.title - 相册标题
 * @returns {string} 200.data.description - 相册描述
 * @returns {string} 200.data.layout - 布局类型
 * @returns {boolean} 200.data.allow_download - 是否允许下载
 * @returns {boolean} 200.data.show_exif - 是否显示EXIF信息
 * @returns {number} 200.data.photo_count - 照片数量
 * @returns {boolean} 200.data.requires_password - 是否需要密码
 * @returns {string} [200.data.ETag] - ETag 值（用于缓存）
 * 
 * @returns {Object} 304 - 未修改（If-None-Match 匹配）
 * @returns {Object} 400 - 请求参数错误（无效的相册标识）
 * @returns {Object} 403 - 禁止访问（相册已过期或不允许分享）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/public/albums/my-album-slug')
 * const data = await response.json()
 * ```
 */
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

    // 获取相册信息（包含密码字段，但不直接返回）
    const result = await db
      .from('albums')
      .select('id, title, description, layout, allow_download, show_exif, photo_count, password, expires_at, is_public, allow_share')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (result.error || !result.data) {
      return ApiError.notFound('相册不存在')
    }

    const album = result.data
    
    // 检查相册是否允许分享
    if (album.allow_share === false) {
      return ApiError.notFound('相册不存在')
    }

    // 检查相册是否过期
    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden('相册已过期')
    }

    // 检查是否需要密码（不返回密码本身，只返回是否需要密码）
    const requiresPassword = !!album.password

    // 返回相册信息（不包含密码）
    // 添加缓存头：公开相册缓存5分钟，私有相册不缓存
    const cacheHeaders: Record<string, string> = album.is_public
      ? {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        }
      : {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        }

    // 添加 ETag 支持（基于相册 ID 和更新时间）
    const etag = `"${album.id}-${album.expires_at || 'no-expiry'}"`
    cacheHeaders['ETag'] = etag

    // 检查 If-None-Match 头（客户端缓存验证）
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders })
    }

    return NextResponse.json(
      {
        id: album.id,
        title: album.title,
        description: album.description,
        layout: album.layout,
        allow_download: album.allow_download,
        show_exif: album.show_exif,
        photo_count: album.photo_count,
        requires_password: requiresPassword,
        is_public: album.is_public,
      },
      { headers: cacheHeaders }
    )
  } catch (error) {
    return handleError(error, '获取相册信息失败')
  }
}
