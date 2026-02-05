import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { userIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 重置用户密码 API
 * 
 * @route POST /api/admin/users/[id]/reset-password
 * @description 管理员重置用户密码（将密码设置为 NULL，用户首次登录时需要设置新密码）
 * 
 * @auth 需要管理员权限
 * 
 * @param {string} id - 用户ID（UUID格式）
 * 
 * @returns {Object} 200 - 重置成功
 * @returns {Object} 200.data - 重置确认信息
 * 
 * @returns {Object} 400 - 请求参数错误（无效的用户ID）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 403 - 权限不足（需要管理员权限）
 * @returns {Object} 404 - 用户不存在
 * @returns {Object} 500 - 服务器内部错误
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能重置用户密码')
    }

    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(userIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的用户ID')
    }
    
    const { id } = idValidation.data
    const db = await createAdminClient()

    // 检查用户是否存在
    const existingUser = await db
      .from('users')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingUser.error || !existingUser.data) {
      return ApiError.notFound('用户不存在')
    }

    // 重置密码：将 password_hash 设置为 NULL
    const result = await db.update(
      'users',
      { 
        password_hash: null,
        updated_at: new Date().toISOString()
      },
      { id, deleted_at: null }
    )

    if (result.error) {
      return handleError(result.error, '重置密码失败')
    }

    return createSuccessResponse({ 
      message: '密码已重置，用户首次登录时需要设置新密码'
    })
  } catch (error) {
    return handleError(error, '重置密码失败')
  }
}
