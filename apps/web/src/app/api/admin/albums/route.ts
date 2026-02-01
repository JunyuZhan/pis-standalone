import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { getAlbumShareUrl, generateAlbumSlug } from '@/lib/utils'
import type { AlbumInsert, Json } from '@/types/database'
import { createAlbumSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 相册管理 API
 * 
 * @route GET /api/admin/albums
 * @route POST /api/admin/albums
 * @description 相册列表和创建接口
 */

/**
 * 获取相册列表
 * 
 * @route GET /api/admin/albums
 * @description 获取所有相册（支持分页和筛选）
 * 
 * @auth 需要管理员登录
 * 
 * @query {number} [page=1] - 页码（从1开始）
 * @query {number} [limit=50] - 每页数量
 * @query {boolean} [is_public] - 筛选公开状态（true/false）
 * 
 * @returns {Object} 200 - 成功返回相册列表
 * @returns {Object[]} 200.data.albums - 相册数组
 * @returns {Object} 200.data.pagination - 分页信息
 * @returns {number} 200.data.pagination.page - 当前页码
 * @returns {number} 200.data.pagination.limit - 每页数量
 * @returns {number} 200.data.pagination.total - 总数量
 * @returns {number} 200.data.pagination.totalPages - 总页数
 * 
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 500 - 服务器内部错误
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createClient()
    const { searchParams } = new URL(request.url)

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 分页参数
    const pageRaw = searchParams.get('page') || '1'
    const limitRaw = searchParams.get('limit') || '50'
    const page = Math.max(1, parseInt(pageRaw) || 1) // 确保页码至少为1
    const limit = Math.max(1, Math.min(100, parseInt(limitRaw) || 50)) // 限制在1-100之间
    const offset = (page - 1) * limit

    // 筛选参数
    const isPublic = searchParams.get('is_public')

    // 构建查询
    let query = db
      .from('albums')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)
      .offset(offset)

    // 可选：按公开状态筛选
    if (isPublic === 'true') {
      query = query.eq('is_public', true)
    } else if (isPublic === 'false') {
      query = query.eq('is_public', false)
    }

    const result = await query

    if (result.error) {
      return handleError(result.error, '查询相册列表失败')
    }

    // 从查询结果获取 count（如果支持）
    const total = result.count || result.data?.length || 0

    return NextResponse.json({
      albums: result.data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleError(error, '查询相册列表失败')
  }
}

/**
 * 创建新相册
 * 
 * @route POST /api/admin/albums
 * @description 创建新的相册
 * 
 * @auth 需要管理员登录
 * 
 * @body {Object} requestBody - 相册数据
 * @body {string} requestBody.title - 相册标题（必填，1-200字符）
 * @body {string} [requestBody.description] - 相册描述（可选，最多1000字符）
 * @body {string} [requestBody.slug] - 相册标识（可选，自动生成）
 * @body {string} [requestBody.event_date] - 活动日期（可选，ISO 8601格式）
 * @body {string} [requestBody.location] - 活动地点（可选，最多200字符）
 * @body {boolean} [requestBody.is_public=false] - 是否公开（可选，默认false）
 * @body {string} [requestBody.password] - 访问密码（可选）
 * @body {string} [requestBody.expires_at] - 过期时间（可选，ISO 8601格式）
 * @body {string} [requestBody.layout='masonry'] - 布局类型（可选，masonry/grid/carousel）
 * @body {string} [requestBody.sort_rule='capture_desc'] - 排序规则（可选）
 * @body {boolean} [requestBody.allow_download=false] - 允许下载（可选）
 * @body {boolean} [requestBody.allow_batch_download=true] - 允许批量下载（可选）
 * @body {boolean} [requestBody.show_exif=true] - 显示EXIF信息（可选）
 * @body {boolean} [requestBody.allow_share=true] - 允许分享（可选）
 * @body {Object} [requestBody.settings] - 其他设置（可选）
 * 
 * @returns {Object} 200 - 创建成功
 * @returns {Object} 200.data - 创建的相册数据
 * @returns {string} 200.data.id - 相册ID
 * @returns {string} 200.data.slug - 相册标识
 * @returns {string} 200.data.title - 相册标题
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 409 - 冲突（slug已存在）
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/albums', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     title: '我的相册',
 *     description: '相册描述',
 *     is_public: true
 *   })
 * })
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(createAlbumSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const {
      title,
      description,
      event_date,
      location,
      poster_image_url,
      is_public,
      isPublic,
      layout,
      sort_rule,
      allow_download,
      allow_batch_download,
      allowBatchDownload,
      show_exif,
      watermark_enabled,
      watermark_type,
      watermark_config,
      color_grading,
      password,
      expires_at,
      expiresAt,
    } = validation.data

    // 处理兼容性（支持两种命名方式）
    const finalIsPublic = is_public ?? isPublic ?? false
    const finalAllowBatchDownload = allow_batch_download ?? allowBatchDownload ?? false
    const finalExpiresAt = expires_at ?? expiresAt ?? null

    // 生成唯一的 slug
    const slug = generateAlbumSlug()

    // 构建插入数据
    const insertData: AlbumInsert = {
      title: title.trim(),
      slug, // 添加生成的 slug
      description: description?.trim() || null,
      event_date: event_date || null,
      location: location?.trim() || null,
      poster_image_url: poster_image_url || null,
      is_public: finalIsPublic,
      password: password?.trim() || null,
      expires_at: finalExpiresAt,
      layout: layout || 'masonry',
      sort_rule: sort_rule || 'capture_desc',
      allow_download: allow_download ?? true,
      allow_batch_download: finalAllowBatchDownload, // 默认关闭，需要管理员明确开启
      show_exif: show_exif ?? true,
      allow_share: true, // 默认允许分享
      watermark_enabled: watermark_enabled ?? false,
      watermark_type: watermark_type || null,
      watermark_config: (watermark_config || {}) as Json,
      color_grading: color_grading as Json | null,  // 新增：调色配置
    }

    // 创建相册
    const result = await db.insert('albums', insertData)

    if (result.error) {
      // 处理唯一约束冲突（slug 重复）
      const errorMessage = result.error.message || ''
      if (errorMessage.includes('23505') || errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
        return ApiError.validation('相册创建失败，请重试（可能是 slug 重复）')
      }
      return handleError(result.error, '创建相册失败')
    }

    const data = result.data && result.data.length > 0 ? result.data[0] : null
    if (!data) {
      return ApiError.internal('创建相册失败')
    }

    // 生成分享URL（添加错误处理）
    let shareUrl: string
    try {
      if (!data.slug) {
        throw new Error('Slug is required')
      }
      shareUrl = getAlbumShareUrl(data.slug)
    } catch (error) {
      console.error('Failed to generate share URL:', error)
      // 如果slug无效，使用降级方案
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      shareUrl = `${appUrl}/album/${encodeURIComponent(data.slug || '')}`
    }

    // 返回创建结果
    return createSuccessResponse({
      id: data.id,
      slug: data.slug,
      title: data.title,
      is_public: data.is_public,
      shareUrl,
    })
  } catch (error) {
    return handleError(error, '创建相册失败')
  }
}
