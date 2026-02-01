import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { templateIdSchema, updateTemplateSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 模板详情 API
 * - GET: 获取模板详情
 * - PATCH: 更新模板
 * - DELETE: 删除模板
 */

// GET /api/admin/templates/[id] - 获取模板详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(templateIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的模板ID')
    }
    
    const { id } = idValidation.data
    const db = await createClient()

    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    const result = await db
      .from('album_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (result.error || !result.data) {
      return ApiError.notFound('模板不存在')
    }

    return createSuccessResponse(result.data)
  } catch (error) {
    return handleError(error, '获取模板详情失败')
  }
}

// PATCH /api/admin/templates/[id] - 更新模板
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(templateIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的模板ID')
    }
    
    const { id } = idValidation.data
    const db = await createClient()

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

    // 验证输入（使用 partial schema）
    const validation = safeValidate(updateTemplateSchema.partial(), body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const updateData: Record<string, unknown> = {}
    const { name, description, settings } = validation.data

    // 只更新提供的字段
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (settings !== undefined) {
      // 将 settings 中的字段合并到 updateData
      Object.assign(updateData, settings)
    }

    const updateResult = await db.update('album_templates', updateData, { id })

    if (updateResult.error) {
      return handleError(updateResult.error, '更新模板失败')
    }

    return createSuccessResponse(updateResult.data && updateResult.data.length > 0 ? updateResult.data[0] : null)
  } catch (error) {
    return handleError(error, '更新模板失败')
  }
}

// DELETE /api/admin/templates/[id] - 删除模板
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(templateIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的模板ID')
    }
    
    const { id } = idValidation.data
    const db = await createClient()

    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    const deleteResult = await db.delete('album_templates', { id })

    if (deleteResult.error) {
      return handleError(deleteResult.error, '删除模板失败')
    }

    return createSuccessResponse({ success: true, message: '模板已删除' })
  } catch (error) {
    return handleError(error, '删除模板失败')
  }
}
