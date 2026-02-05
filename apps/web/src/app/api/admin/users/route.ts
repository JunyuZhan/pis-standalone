import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { createUserSchema, userListQuerySchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'
import { hashPassword } from '@/lib/auth/password'
import { getAuthDatabase } from '@/lib/auth'

/**
 * 用户管理 API
 * 
 * @route GET /api/admin/users
 * @route POST /api/admin/users
 * @description 用户列表和创建接口
 */

/**
 * 获取用户列表
 * 
 * @route GET /api/admin/users
 * @description 获取所有用户（支持分页、筛选和搜索）
 * 
 * @auth 需要管理员权限
 * 
 * @query {number} [page=1] - 页码（从1开始）
 * @query {number} [limit=50] - 每页数量（最大100）
 * @query {string} [role] - 筛选角色（admin, photographer, retoucher, guest）
 * @query {boolean} [is_active] - 筛选激活状态（true/false）
 * @query {string} [search] - 搜索邮箱
 * 
 * @returns {Object} 200 - 成功返回用户列表
 * @returns {Object[]} 200.data.users - 用户数组
 * @returns {Object} 200.data.pagination - 分页信息
 * 
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 403 - 权限不足（需要管理员权限）
 * @returns {Object} 500 - 服务器内部错误
 */
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能访问用户列表')
    }

    const db = await createAdminClient()
    const { searchParams } = new URL(request.url)

    // 验证查询参数
    const queryParams: Record<string, unknown> = {}
    if (searchParams.get('page')) queryParams.page = searchParams.get('page')
    if (searchParams.get('limit')) queryParams.limit = searchParams.get('limit')
    if (searchParams.get('role')) queryParams.role = searchParams.get('role')
    if (searchParams.get('is_active')) queryParams.is_active = searchParams.get('is_active')
    if (searchParams.get('search')) queryParams.search = searchParams.get('search')

    const validation = safeValidate(userListQuerySchema, queryParams)
    if (!validation.success) {
      return handleError(validation.error, '查询参数验证失败')
    }

    const { page, limit, role, is_active, search } = validation.data
    const offset = (page - 1) * limit

    // 构建查询
    let query = db
      .from('users')
      .select('id, email, role, is_active, last_login_at, created_at, updated_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)
      .offset(offset)

    // 按角色筛选
    if (role) {
      query = query.eq('role', role)
    }

    // 按激活状态筛选
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active)
    }

    // 邮箱搜索
    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    const result = await query

    if (result.error) {
      return handleError(result.error, '查询用户列表失败')
    }

    const total = result.count || result.data?.length || 0

    return createSuccessResponse({
      users: result.data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleError(error, '查询用户列表失败')
  }
}

/**
 * 创建新用户
 * 
 * @route POST /api/admin/users
 * @description 创建新用户
 * 
 * @auth 需要管理员权限
 * 
 * @body {Object} requestBody - 用户数据
 * @body {string} requestBody.email - 用户邮箱（必填）
 * @body {string} [requestBody.password] - 用户密码（可选，首次登录时设置）
 * @body {string} [requestBody.role='admin'] - 用户角色（可选，默认 admin）
 * 
 * @returns {Object} 200 - 创建成功
 * @returns {Object} 200.data - 创建的用户数据（不包含密码哈希）
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 403 - 权限不足（需要管理员权限）
 * @returns {Object} 409 - 用户已存在（邮箱冲突）
 * @returns {Object} 500 - 服务器内部错误
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能创建用户')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return ApiError.badRequest('请求体格式错误，请提供有效的JSON')
    }

    const validation = safeValidate(createUserSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { email, password, role = 'admin' } = validation.data
    const normalizedEmail = email.trim().toLowerCase()

    // 检查邮箱是否已存在
    const db = await createAdminClient()
    const existingUser = await db
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingUser.data) {
      return ApiError.conflict('该邮箱已被使用')
    }

    // 哈希密码（如果提供了密码）
    let passwordHash: string | null = null
    if (password && password.trim() !== '') {
      passwordHash = await hashPassword(password)
    }

    // 创建用户
    const authDb = getAuthDatabase()
    const newUser = await authDb.createUser(normalizedEmail, passwordHash, role)

    // 返回用户信息（不包含密码哈希）
    const userResult = await db
      .from('users')
      .select('id, email, role, is_active, created_at, updated_at')
      .eq('id', newUser.id)
      .single()

    if (userResult.error || !userResult.data) {
      return ApiError.internal('创建用户成功，但查询用户信息失败')
    }

    return createSuccessResponse(userResult.data)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('duplicate') || error.message.includes('unique'))) {
      return ApiError.conflict('该邮箱已被使用')
    }
    return handleError(error, '创建用户失败')
  }
}
