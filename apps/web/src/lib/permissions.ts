/**
 * 权限管理工具库
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * 权限代码类型
 */
export type PermissionCode =
  // 相册权限
  | 'album:view'
  | 'album:create'
  | 'album:edit'
  | 'album:delete'
  | 'album:publish'
  | 'album:share'
  // 照片权限
  | 'photo:view'
  | 'photo:upload'
  | 'photo:edit'
  | 'photo:delete'
  | 'photo:download'
  | 'photo:retouch'
  // 客户权限
  | 'customer:view'
  | 'customer:create'
  | 'customer:edit'
  | 'customer:delete'
  | 'customer:notify'
  // 统计权限
  | 'analytics:view'
  | 'analytics:export'
  // 系统权限
  | 'system:settings'
  | 'system:upgrade'
  | 'system:users'
  | 'system:permissions'
  | 'system:audit'
  | 'system:backup'

/**
 * 权限分类
 */
export type PermissionCategory = 
  | 'album' 
  | 'photo' 
  | 'customer' 
  | 'analytics' 
  | 'system'

/**
 * 权限分类标签
 */
export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  album: '相册管理',
  photo: '照片管理',
  customer: '客户管理',
  analytics: '数据统计',
  system: '系统管理',
}

/**
 * 用户角色类型
 */
export type UserRole = 'admin' | 'photographer' | 'retoucher' | 'viewer'

/**
 * 角色标签
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  photographer: '摄影师',
  retoucher: '修图师',
  viewer: '查看者',
}

/**
 * 权限信息
 */
export interface Permission {
  id: string
  code: PermissionCode
  name: string
  description: string | null
  category: PermissionCategory
  is_system: boolean
}

/**
 * 用户权限信息
 */
export interface UserPermission {
  id: string
  user_id: string
  permission_id: string
  permission_code: PermissionCode
  granted: boolean
  expires_at: string | null
}

// 权限缓存（内存缓存，减少数据库查询）
const permissionCache = new Map<string, { permissions: Set<string>; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟缓存

/**
 * 获取用户的所有有效权限
 */
export async function getUserPermissions(userId: string, role: UserRole): Promise<Set<PermissionCode>> {
  // 检查缓存
  const cacheKey = `${userId}:${role}`
  const cached = permissionCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions as Set<PermissionCode>
  }

  const db = createServerSupabaseClient()
  const permissions = new Set<PermissionCode>()

  // 1. 获取角色的默认权限
  const { data: rolePerms } = await db
    .from('role_permissions')
    .select(`
      permission_id,
      permissions!inner(code)
    `)
    .eq('role', role)

  if (rolePerms) {
    for (const rp of rolePerms) {
      const perm = rp.permissions as unknown as { code: string }
      if (perm?.code) {
        permissions.add(perm.code as PermissionCode)
      }
    }
  }

  // 2. 获取用户的特殊权限（覆盖角色权限）
  const { data: userPerms } = await db
    .from('user_permissions')
    .select(`
      granted,
      expires_at,
      permissions!inner(code)
    `)
    .eq('user_id', userId)

  if (userPerms) {
    const now = new Date()
    for (const up of userPerms) {
      const perm = up.permissions as unknown as { code: string }
      if (!perm?.code) continue

      // 检查是否过期
      if (up.expires_at && new Date(up.expires_at) < now) {
        continue
      }

      if (up.granted) {
        permissions.add(perm.code as PermissionCode)
      } else {
        permissions.delete(perm.code as PermissionCode)
      }
    }
  }

  // 更新缓存
  permissionCache.set(cacheKey, {
    permissions: permissions,
    timestamp: Date.now(),
  })

  return permissions
}

/**
 * 检查用户是否有指定权限
 */
export async function hasPermission(
  userId: string,
  role: UserRole,
  permission: PermissionCode
): Promise<boolean> {
  // 管理员拥有所有权限
  if (role === 'admin') {
    return true
  }

  const permissions = await getUserPermissions(userId, role)
  return permissions.has(permission)
}

/**
 * 检查用户是否有多个权限中的任意一个
 */
export async function hasAnyPermission(
  userId: string,
  role: UserRole,
  requiredPermissions: PermissionCode[]
): Promise<boolean> {
  if (role === 'admin') {
    return true
  }

  const permissions = await getUserPermissions(userId, role)
  return requiredPermissions.some(p => permissions.has(p))
}

/**
 * 检查用户是否有所有指定权限
 */
export async function hasAllPermissions(
  userId: string,
  role: UserRole,
  requiredPermissions: PermissionCode[]
): Promise<boolean> {
  if (role === 'admin') {
    return true
  }

  const permissions = await getUserPermissions(userId, role)
  return requiredPermissions.every(p => permissions.has(p))
}

/**
 * 清除用户权限缓存
 */
export function clearPermissionCache(userId?: string): void {
  if (userId) {
    // 清除特定用户的缓存
    for (const key of permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        permissionCache.delete(key)
      }
    }
  } else {
    // 清除所有缓存
    permissionCache.clear()
  }
}

/**
 * 获取所有权限定义
 */
export async function getAllPermissions(): Promise<Permission[]> {
  const db = createServerSupabaseClient()
  
  const { data, error } = await db
    .from('permissions')
    .select('*')
    .order('category')
    .order('code')

  if (error) {
    console.error('Failed to get permissions:', error)
    return []
  }

  return (data || []) as Permission[]
}

/**
 * 获取角色的权限列表
 */
export async function getRolePermissions(role: UserRole): Promise<PermissionCode[]> {
  const db = createServerSupabaseClient()

  const { data, error } = await db
    .from('role_permissions')
    .select(`
      permissions!inner(code)
    `)
    .eq('role', role)

  if (error) {
    console.error('Failed to get role permissions:', error)
    return []
  }

  return (data || []).map(d => {
    const perm = d.permissions as unknown as { code: string }
    return perm.code as PermissionCode
  })
}

/**
 * 授予用户特殊权限
 */
export async function grantUserPermission(
  userId: string,
  permissionCode: PermissionCode,
  grantedBy: string,
  expiresAt?: Date
): Promise<boolean> {
  const db = createServerSupabaseClient()

  // 获取权限 ID
  const { data: permission } = await db
    .from('permissions')
    .select('id')
    .eq('code', permissionCode)
    .single()

  if (!permission) {
    console.error('Permission not found:', permissionCode)
    return false
  }

  const { error } = await db
    .from('user_permissions')
    .upsert({
      user_id: userId,
      permission_id: permission.id,
      granted: true,
      granted_by: grantedBy,
      expires_at: expiresAt?.toISOString() || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,permission_id',
    })

  if (error) {
    console.error('Failed to grant permission:', error)
    return false
  }

  // 清除缓存
  clearPermissionCache(userId)
  return true
}

/**
 * 撤销用户特殊权限
 */
export async function revokeUserPermission(
  userId: string,
  permissionCode: PermissionCode,
  grantedBy: string
): Promise<boolean> {
  const db = createServerSupabaseClient()

  // 获取权限 ID
  const { data: permission } = await db
    .from('permissions')
    .select('id')
    .eq('code', permissionCode)
    .single()

  if (!permission) {
    console.error('Permission not found:', permissionCode)
    return false
  }

  const { error } = await db
    .from('user_permissions')
    .upsert({
      user_id: userId,
      permission_id: permission.id,
      granted: false,
      granted_by: grantedBy,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,permission_id',
    })

  if (error) {
    console.error('Failed to revoke permission:', error)
    return false
  }

  // 清除缓存
  clearPermissionCache(userId)
  return true
}

/**
 * 删除用户特殊权限（恢复角色默认权限）
 */
export async function resetUserPermission(
  userId: string,
  permissionCode: PermissionCode
): Promise<boolean> {
  const db = createServerSupabaseClient()

  // 获取权限 ID
  const { data: permission } = await db
    .from('permissions')
    .select('id')
    .eq('code', permissionCode)
    .single()

  if (!permission) {
    return false
  }

  const { error } = await db
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('permission_id', permission.id)

  if (error) {
    console.error('Failed to reset permission:', error)
    return false
  }

  // 清除缓存
  clearPermissionCache(userId)
  return true
}
