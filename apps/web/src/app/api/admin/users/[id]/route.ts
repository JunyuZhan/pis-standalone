import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { userIdSchema, updateUserSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 单用户管理 API
 * 
 * @route GET /api/admin/users/[id]
 * @route PATCH /api/admin/users/[id]
 * @route DELETE /api/admin/users/[id]
 * @description 用户详情、更新和删除接口
 */

/**
 * 获取用户详情
 * 
 * @route GET /api/admin/users/[id]
 * @description 获取指定用户的详细信息
 * 
 * @auth 需要管理员权限
 * 
 * @param {string} id - 用户ID（UUID格式）
 * 
 * @returns {Object} 200 - 成功返回用户详情
 * @returns {Object} 200.data - 用户数据对象（不包含密码哈希）
 * 
 * @returns {Object} 400 - 请求参数错误（无效的用户ID）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 403 - 权限不足（需要管理员权限）
 * @returns {Object} 404 - 用户不存在
 * @returns {Object} 500 - 服务器内部错误
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能查看用户详情')
    }

    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(userIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的用户ID')
    }
    
    const { id } = idValidation.data
    const db = await createAdminClient()

    // 获取用户详情（不包含密码哈希和已删除的用户）
    const result = await db
      .from('users')
      .select('id, email, role, is_active, last_login_at, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (result.error || !result.data) {
      return ApiError.notFound('用户不存在')
    }

    return createSuccessResponse(result.data)
  } catch (error) {
    return handleError(error, '查询用户详情失败')
  }
}

/**
 * 更新用户信息
 * 
 * @route PATCH /api/admin/users/[id]
 * @description 更新用户信息（支持部分更新）
 * 
 * @auth 需要管理员权限
 * 
 * @param {string} id - 用户ID（UUID格式）
 * 
 * @body {Object} requestBody - 要更新的字段（所有字段可选）
 * @body {string} [requestBody.email] - 用户邮箱
 * @body {string} [requestBody.role] - 用户角色
 * @body {boolean} [requestBody.is_active] - 激活状态
 * 
 * @returns {Object} 200 - 更新成功
 * @returns {Object} 200.data - 更新后的用户数据
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 403 - 权限不足（需要管理员权限）
 * @returns {Object} 404 - 用户不存在
 * @returns {Object} 409 - 邮箱已被使用
 * @returns {Object} 500 - 服务器内部错误
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能更新用户')
    }

    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(userIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的用户ID')
    }
    
    const { id } = idValidation.data
    const db = await createAdminClient()

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求体格式错误'), '请求体格式错误')
    }

    const validation = safeValidate(updateUserSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const validatedData = validation.data

    // 检查用户是否存在
    const existingUser = await db
      .from('users')
      .select('id, email, role')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingUser.error || !existingUser.data) {
      return ApiError.notFound('用户不存在')
    }

    const user = existingUser.data as { id: string; email: string; role: string }

    // 构建更新数据
    const updateData: Record<string, unknown> = {}

    if (validatedData.email !== undefined) {
      const normalizedEmail = validatedData.email.trim().toLowerCase()
      
      // 如果邮箱改变，检查新邮箱是否已被使用
      if (normalizedEmail !== user.email) {
        const emailCheck = await db
          .from('users')
          .select('id')
          .eq('email', normalizedEmail)
          .is('deleted_at', null)
          .maybeSingle()

        if (emailCheck.data) {
          return ApiError.conflict('该邮箱已被使用')
        }
      }
      
      updateData.email = normalizedEmail
    }

    if (validatedData.role !== undefined) {
      // 如果更新角色，检查是否是最后一个管理员
      if (user.role === 'admin' && validatedData.role !== 'admin') {
        const adminCount = await db
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin')
          .eq('is_active', true)
          .is('deleted_at', null)

        if ((adminCount.count || 0) <= 1) {
          return ApiError.badRequest('不能修改最后一个管理员账户的角色')
        }
      }
      
      updateData.role = validatedData.role
    }

    if (validatedData.is_active !== undefined) {
      // 如果禁用用户，检查是否是最后一个管理员
      if (user.role === 'admin' && validatedData.is_active === false) {
        const adminCount = await db
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin')
          .eq('is_active', true)
          .is('deleted_at', null)

        if ((adminCount.count || 0) <= 1) {
          return ApiError.badRequest('不能禁用最后一个管理员账户')
        }
      }
      
      updateData.is_active = validatedData.is_active
    }

    // 如果没有要更新的字段，直接返回当前用户信息
    if (Object.keys(updateData).length === 0) {
      const currentUser = await db
        .from('users')
        .select('id, email, role, is_active, last_login_at, created_at, updated_at')
        .eq('id', id)
        .single()

      return createSuccessResponse(currentUser.data)
    }

    // 执行更新
    updateData.updated_at = new Date().toISOString()
    const result = await db.update('users', updateData, { id, deleted_at: null })

    if (result.error) {
      return handleError(result.error, '更新用户失败')
    }

    // 返回更新后的用户信息
    const updatedUser = await db
      .from('users')
      .select('id, email, role, is_active, last_login_at, created_at, updated_at')
      .eq('id', id)
      .single()

    if (updatedUser.error || !updatedUser.data) {
      return ApiError.internal('更新成功，但查询用户信息失败')
    }

    return createSuccessResponse(updatedUser.data)
  } catch (error) {
    return handleError(error, '更新用户失败')
  }
}

/**
 * 删除用户
 * 
 * @route DELETE /api/admin/users/[id]
 * @description 软删除用户（设置 deleted_at）
 * 
 * @auth 需要管理员权限
 * 
 * @param {string} id - 用户ID（UUID格式）
 * 
 * @returns {Object} 200 - 删除成功
 * @returns {Object} 200.data - 删除确认信息
 * 
 * @returns {Object} 400 - 请求参数错误（无效的用户ID或不能删除最后一个管理员）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 403 - 权限不足（需要管理员权限）
 * @returns {Object} 404 - 用户不存在
 * @returns {Object} 500 - 服务器内部错误
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能删除用户')
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
      .select('id, role')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingUser.error || !existingUser.data) {
      return ApiError.notFound('用户不存在')
    }

    const user = existingUser.data as { id: string; role: string }

    // 防止删除最后一个管理员账户
    if (user.role === 'admin') {
      const adminCount = await db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)
        .is('deleted_at', null)

      if ((adminCount.count || 0) <= 1) {
        return ApiError.badRequest('不能删除最后一个管理员账户')
      }
    }

    // 软删除：设置 deleted_at 时间戳
    const result = await db.update(
      'users',
      { deleted_at: new Date().toISOString() },
      { id, deleted_at: null }
    )

    if (result.error) {
      return handleError(result.error, '删除用户失败')
    }

    return createSuccessResponse({ message: '用户已删除' })
  } catch (error) {
    return handleError(error, '删除用户失败')
  }
}
