/**
 * @fileoverview 角色权限检查辅助函数
 *
 * @description
 * 提供统一的角色权限检查功能，用于 API Routes。
 * 实现基于角色的访问控制（RBAC），支持多角色检查。
 *
 * @module lib/auth/role-helpers
 *
 * @example
 * ```typescript
 * import { requireRole, getUserRole } from '@/lib/auth/role-helpers'
 * import { ApiError } from '@/lib/validation/error-handler'
 *
 * // 检查用户是否具有指定角色
 * const userWithRole = await requireRole(request, ['admin', 'retoucher'])
 * if (!userWithRole) {
 *   return ApiError.forbidden('权限不足，需要管理员或修图师权限')
 * }
 *
 * // 仅获取用户角色（不进行权限检查）
 * const role = await getUserRole(request)
 * if (role === 'admin') {
 *   // 管理员专属逻辑
 * }
 * ```
 */
import { NextRequest } from 'next/server'
import { getCurrentUser } from './api-helpers'
import { createAdminClient } from '@/lib/database'

/**
 * 用户角色类型定义
 */
export type UserRole = 'admin' | 'photographer' | 'retoucher' | 'guest'

/**
 * 带角色的用户信息
 */
export interface UserWithRole {
  id: string
  email: string
  role: UserRole
}

/**
 * 获取当前用户的角色
 *
 * @description
 * 从数据库查询当前登录用户的角色信息。
 * 如果用户未登录或查询失败，返回 null。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<UserRole | null>} 用户角色，未登录或查询失败返回 null
 *
 * @example
 * ```typescript
 * const role = await getUserRole(request)
 * if (role === 'admin') {
 *   // 管理员逻辑
 * }
 * ```
 */
export async function getUserRole(request: NextRequest): Promise<UserRole | null> {
  const user = await getCurrentUser(request)
  if (!user) {
    return null
  }

  try {
    const db = await createAdminClient()
    const { data, error } = await db
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      console.error('Failed to get user role:', error)
      return null
    }

    const role = (data as { role: string }).role
    // 验证角色是否有效
    const validRoles: UserRole[] = ['admin', 'photographer', 'retoucher', 'guest']
    if (validRoles.includes(role as UserRole)) {
      return role as UserRole
    }

    // 如果角色不在有效列表中，默认返回 null（安全起见）
    console.warn(`Invalid role "${role}" for user ${user.id}, treating as null`)
    return null
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

/**
 * 要求用户具有指定角色之一
 *
 * @description
 * 检查当前用户是否已登录且具有允许的角色之一。
 * 如果用户未登录或不具有允许的角色，返回 null。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @param {UserRole[]} allowedRoles - 允许的角色列表
 * @returns {Promise<UserWithRole | null>} 带角色的用户信息，权限不足返回 null
 *
 * @example
 * ```typescript
 * // 只允许管理员或修图师访问
 * const user = await requireRole(request, ['admin', 'retoucher'])
 * if (!user) {
 *   return ApiError.forbidden('需要管理员或修图师权限')
 * }
 * // 现在可以使用 user.id, user.email, user.role
 * ```
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<UserWithRole | null> {
  const user = await getCurrentUser(request)
  if (!user) {
    return null
  }

  const role = await getUserRole(request)
  if (!role) {
    return null
  }

  if (!allowedRoles.includes(role)) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    role,
  }
}

/**
 * 检查用户是否为管理员
 *
 * @description
 * 便捷函数，检查当前用户是否为管理员。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<UserWithRole | null>} 如果是管理员返回用户信息，否则返回 null
 *
 * @example
 * ```typescript
 * const admin = await requireAdmin(request)
 * if (!admin) {
 *   return ApiError.forbidden('需要管理员权限')
 * }
 * ```
 */
export async function requireAdmin(request: NextRequest): Promise<UserWithRole | null> {
  return requireRole(request, ['admin'])
}

/**
 * 检查用户是否为修图师或管理员
 *
 * @description
 * 便捷函数，检查当前用户是否为修图师或管理员。
 * 常用于修图相关的 API。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<UserWithRole | null>} 如果是修图师或管理员返回用户信息，否则返回 null
 *
 * @example
 * ```typescript
 * const user = await requireRetoucherOrAdmin(request)
 * if (!user) {
 *   return ApiError.forbidden('需要修图师或管理员权限')
 * }
 * ```
 */
export async function requireRetoucherOrAdmin(request: NextRequest): Promise<UserWithRole | null> {
  return requireRole(request, ['admin', 'retoucher'])
}
