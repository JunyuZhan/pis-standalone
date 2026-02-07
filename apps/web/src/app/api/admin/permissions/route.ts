/**
 * 权限管理 API
 * GET: 获取所有权限定义
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'

interface RolePermissionRow {
  role: string
  permission_id: string
  permissions: {
    code: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    // 只有管理员可以查看权限列表
    if (user.role !== 'admin') {
      throw new ApiError('无权访问权限管理', 403)
    }

    const db = createServerSupabaseClient()

    // 获取所有权限
    const { data: permissions, error } = await db
      .from('permissions')
      .select('*')
      .order('category')
      .order('code')

    if (error) {
      throw new ApiError(`获取权限失败: ${error.message}`, 500)
    }

    // 获取角色权限
    const { data: rolePermissions } = await db
      .from('role_permissions')
      .select(`
        role,
        permission_id,
        permissions!inner(code)
      `)

    // 整理角色权限数据
    const rolePermsMap: Record<string, string[]> = {}
    const rolePermsArray = (rolePermissions || []) as RolePermissionRow[]
    for (const rp of rolePermsArray) {
      if (!rolePermsMap[rp.role]) {
        rolePermsMap[rp.role] = []
      }
      if (rp.permissions?.code) {
        rolePermsMap[rp.role].push(rp.permissions.code)
      }
    }

    return NextResponse.json({
      permissions: permissions || [],
      rolePermissions: rolePermsMap,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
