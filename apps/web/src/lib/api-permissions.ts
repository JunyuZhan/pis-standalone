/**
 * API 权限检查辅助函数
 */

import { NextResponse } from 'next/server'
import { hasPermission, hasAnyPermission, PermissionCode, UserRole } from '@/lib/permissions'

interface UserWithRole {
  id: string
  email?: string
  role: UserRole
}

/**
 * 检查用户是否有权限，返回错误响应或 null
 */
export async function checkPermission(
  user: UserWithRole,
  permission: PermissionCode
): Promise<NextResponse | null> {
  const allowed = await hasPermission(user.id, user.role, permission)
  
  if (!allowed) {
    return NextResponse.json(
      { 
        error: {
          code: 'FORBIDDEN',
          message: '您没有执行此操作的权限',
          requiredPermission: permission,
        }
      },
      { status: 403 }
    )
  }
  
  return null
}

/**
 * 检查用户是否有任意一个权限
 */
export async function checkAnyPermission(
  user: UserWithRole,
  permissions: PermissionCode[]
): Promise<NextResponse | null> {
  const allowed = await hasAnyPermission(user.id, user.role, permissions)
  
  if (!allowed) {
    return NextResponse.json(
      { 
        error: {
          code: 'FORBIDDEN',
          message: '您没有执行此操作的权限',
          requiredPermissions: permissions,
        }
      },
      { status: 403 }
    )
  }
  
  return null
}

/**
 * 权限名称映射（用于错误提示）
 */
export const PERMISSION_NAMES: Record<PermissionCode, string> = {
  'album:view': '查看相册',
  'album:create': '创建相册',
  'album:edit': '编辑相册',
  'album:delete': '删除相册',
  'album:publish': '发布相册',
  'album:share': '分享相册',
  'photo:view': '查看照片',
  'photo:upload': '上传照片',
  'photo:edit': '编辑照片',
  'photo:delete': '删除照片',
  'photo:download': '下载照片',
  'photo:retouch': '修图',
  'customer:view': '查看客户',
  'customer:create': '创建客户',
  'customer:edit': '编辑客户',
  'customer:delete': '删除客户',
  'customer:notify': '发送通知',
  'analytics:view': '查看统计',
  'analytics:export': '导出统计',
  'system:settings': '系统设置',
  'system:upgrade': '系统升级',
  'system:users': '用户管理',
  'system:permissions': '权限管理',
  'system:audit': '审计日志',
  'system:backup': '数据备份',
}
