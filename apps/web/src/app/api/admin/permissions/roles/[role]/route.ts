/**
 * 角色权限管理 API
 * GET: 获取角色权限
 * PUT: 更新角色权限
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'
import { clearPermissionCache, UserRole, ROLE_LABELS } from '@/lib/permissions'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ role: string }>
}

const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string()),
})

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    
    if (user.role !== 'admin') {
      throw new ApiError('无权访问权限管理', 403)
    }

    const { role } = await params

    // 验证角色
    if (!ROLE_LABELS[role as UserRole]) {
      throw new ApiError('无效的角色', 400)
    }

    const db = createServerSupabaseClient()

    // 获取角色权限
    const { data: rolePermissions, error } = await db
      .from('role_permissions')
      .select(`
        permission_id,
        permissions!inner(id, code, name, description, category)
      `)
      .eq('role', role)

    if (error) {
      throw new ApiError(`获取角色权限失败: ${error.message}`, 500)
    }

    const permissions = (rolePermissions || []).map(rp => {
      const perm = rp.permissions as unknown as {
        id: string
        code: string
        name: string
        description: string
        category: string
      }
      return perm
    })

    return NextResponse.json({
      role,
      roleName: ROLE_LABELS[role as UserRole],
      permissions,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    
    if (user.role !== 'admin') {
      throw new ApiError('无权修改角色权限', 403)
    }

    const { role } = await params

    // 验证角色
    if (!ROLE_LABELS[role as UserRole]) {
      throw new ApiError('无效的角色', 400)
    }

    // 不能修改管理员权限
    if (role === 'admin') {
      throw new ApiError('不能修改管理员权限', 403)
    }

    const body = await request.json()
    const validation = updateRolePermissionsSchema.safeParse(body)
    
    if (!validation.success) {
      throw new ApiError('请求参数无效', 400)
    }

    const { permissions: permissionCodes } = validation.data
    const db = createServerSupabaseClient()

    // 获取权限 ID 列表
    const { data: permissionsList, error: permsError } = await db
      .from('permissions')
      .select('id, code')
      .in('code', permissionCodes)

    if (permsError) {
      throw new ApiError(`获取权限失败: ${permsError.message}`, 500)
    }

    const permissionIds = (permissionsList || []).map(p => p.id)

    // 删除现有角色权限
    const { error: deleteError } = await db
      .from('role_permissions')
      .delete()
      .eq('role', role)

    if (deleteError) {
      throw new ApiError(`删除旧权限失败: ${deleteError.message}`, 500)
    }

    // 插入新权限
    if (permissionIds.length > 0) {
      const newRolePermissions = permissionIds.map(permissionId => ({
        role,
        permission_id: permissionId,
        granted_by: user.id,
      }))

      const { error: insertError } = await db
        .from('role_permissions')
        .insert(newRolePermissions)

      if (insertError) {
        throw new ApiError(`添加新权限失败: ${insertError.message}`, 500)
      }
    }

    // 清除所有权限缓存
    clearPermissionCache()

    return NextResponse.json({
      success: true,
      message: `角色 ${ROLE_LABELS[role as UserRole]} 的权限已更新`,
      permissionsCount: permissionIds.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
