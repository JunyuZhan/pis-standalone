import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import type { AlbumTemplateInsert, Json } from '@/types/database'
import { createTemplateSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 模板管理 API
 * 
 * @route GET /api/admin/templates
 * @route POST /api/admin/templates
 * @description 相册模板管理接口（用于快速创建相册）
 */

/**
 * 获取模板列表
 * 
 * @route GET /api/admin/templates
 * @description 获取所有相册模板列表
 * 
 * @auth 需要管理员登录
 * 
 * @returns {Object} 200 - 成功返回模板列表
 * @returns {Object[]} 200.data.templates - 模板数组
 * @returns {string} 200.data.templates[].id - 模板ID
 * @returns {string} 200.data.templates[].name - 模板名称
 * @returns {string} [200.data.templates[].description] - 模板描述
 * 
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 500 - 服务器内部错误
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    const result = await db
      .from('album_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (result.error) {
      return handleError(result.error, '查询模板列表失败')
    }

    return createSuccessResponse({ templates: result.data || [] })
  } catch (error) {
    return handleError(error, '查询模板列表失败')
  }
}

/**
 * 创建新模板
 * 
 * @route POST /api/admin/templates
 * @description 创建新的相册模板，用于快速创建相册
 * 
 * @auth 需要管理员登录
 * 
 * @body {Object} requestBody - 模板数据
 * @body {string} requestBody.name - 模板名称（必填，1-200字符）
 * @body {string} [requestBody.description] - 模板描述（可选，最多1000字符）
 * @body {Object} [requestBody.settings] - 模板设置（可选）
 * @body {boolean} [requestBody.settings.is_public] - 是否公开
 * @body {string} [requestBody.settings.layout] - 布局类型
 * @body {string} [requestBody.settings.sort_rule] - 排序规则
 * @body {boolean} [requestBody.settings.allow_download] - 允许下载
 * @body {boolean} [requestBody.settings.show_exif] - 显示EXIF信息
 * 
 * @returns {Object} 200 - 创建成功
 * @returns {Object} 200.data - 创建的模板数据
 * @returns {string} 200.data.id - 模板ID
 * @returns {string} 200.data.name - 模板名称
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 500 - 服务器内部错误
 */
export async function POST(request: NextRequest) {
  try {
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
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(createTemplateSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const {
      name,
      description,
      settings,
    } = validation.data

    // 从 settings 中提取其他字段（如果存在）
    const is_public = (settings as Record<string, unknown>)?.is_public as boolean | undefined
    const layout = (settings as Record<string, unknown>)?.layout as 'masonry' | 'grid' | 'carousel' | undefined
    const sort_rule = (settings as Record<string, unknown>)?.sort_rule as 'capture_desc' | 'capture_asc' | 'manual' | undefined
    const allow_download = (settings as Record<string, unknown>)?.allow_download as boolean | undefined
    const allow_batch_download = (settings as Record<string, unknown>)?.allow_batch_download as boolean | undefined
    const show_exif = (settings as Record<string, unknown>)?.show_exif as boolean | undefined
    const password = (settings as Record<string, unknown>)?.password as string | null | undefined
    const expires_at = (settings as Record<string, unknown>)?.expires_at as string | null | undefined
    const watermark_enabled = (settings as Record<string, unknown>)?.watermark_enabled as boolean | undefined
    const watermark_type = (settings as Record<string, unknown>)?.watermark_type as 'text' | 'logo' | null | undefined
    const watermark_config = (settings as Record<string, unknown>)?.watermark_config as Json | undefined

    // 构建插入数据
    const insertData: AlbumTemplateInsert = {
      name: name.trim(),
      description: description?.trim() || null,
      is_public: is_public ?? false,
      layout: layout || 'masonry',
      sort_rule: sort_rule || 'capture_desc',
      allow_download: allow_download ?? false,
      allow_batch_download: allow_batch_download ?? true,
      show_exif: show_exif ?? true,
      password: password || null,
      expires_at: expires_at || null,
      watermark_enabled: watermark_enabled ?? false,
      watermark_type: watermark_type || null,
      watermark_config: (watermark_config || {}) as Json,
    }

    const insertResult = await db.insert('album_templates', insertData)

    if (insertResult.error) {
      return handleError(insertResult.error, '创建模板失败')
    }

    return createSuccessResponse(insertResult.data && insertResult.data.length > 0 ? insertResult.data[0] : null)
  } catch (error) {
    return handleError(error, '创建模板失败')
  }
}
