import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { getAuthDatabase } from '@/lib/auth'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { initAuthDatabase } from '@/lib/auth/database'
import { changePasswordSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

// 初始化认证数据库（如果尚未初始化）
try {
  initAuthDatabase()
} catch {
  // 可能已经初始化，忽略错误
}

/**
 * 修改密码 API
 * 
 * @route POST /api/auth/change-password
 * @description 修改当前登录用户的密码
 * 
 * @auth 需要用户登录
 * 
 * @body {Object} requestBody - 密码修改请求体
 * @body {string} requestBody.currentPassword - 当前密码（必填）
 * @body {string} requestBody.newPassword - 新密码（必填，8-100字符）
 * @body {string} requestBody.confirmPassword - 确认新密码（必填，需与新密码匹配）
 * 
 * @returns {Object} 200 - 密码修改成功
 * @returns {boolean} 200.data.success - 操作是否成功
 * @returns {string} 200.data.message - 操作消息
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败或当前密码错误）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 404 - 用户不存在
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/auth/change-password', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     currentPassword: 'old-password',
 *     newPassword: 'new-password-123',
 *     confirmPassword: 'new-password-123'
 *   })
 * })
 * ```
 */
export async function POST(request: NextRequest) {
  try {
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
      return handleError(new Error('请求格式错误'), '请求体格式错误')
    }

    // 验证输入
    const validation = safeValidate(changePasswordSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { currentPassword, newPassword } = validation.data

    // 获取用户信息并验证当前密码
    const authDb = getAuthDatabase()
    const userRecord = await authDb.findUserByEmail(user.email)

    if (!userRecord) {
      return ApiError.notFound('用户不存在')
    }

    // 验证当前密码
    const isValidPassword = await verifyPassword(currentPassword, userRecord.password_hash)

    if (!isValidPassword) {
      return ApiError.validation('当前密码错误')
    }

    // 哈希新密码
    const newPasswordHash = await hashPassword(newPassword)

    // 更新密码
    await authDb.updateUserPassword(user.id, newPasswordHash)

    return createSuccessResponse({
      success: true,
      message: '密码修改成功',
    })
  } catch (error) {
    return handleError(error, '密码修改失败')
  }
}
