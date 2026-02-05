import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/database'
import { UserDetailClient } from '@/components/admin/user-detail-client'

interface UserDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * 用户详情/编辑页
 */
export default async function UserDetailPage({ params }: UserDetailPageProps) {
  // 检查登录状态
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    redirect('/admin/login')
  }

  // 检查管理员权限（直接查询数据库）
  const adminDb = await createAdminClient()
  const userRoleResult = await adminDb
    .from('users')
    .select('role')
    .eq('id', currentUser.id)
    .is('deleted_at', null)
    .single()

  if (userRoleResult.error || !userRoleResult.data) {
    redirect('/admin/login')
  }

  const role = (userRoleResult.data as { role: string }).role
  if (role !== 'admin') {
    redirect('/admin')
  }

  const { id } = await params
  const db = await createAdminClient()

  // 获取用户详情
  const userResult = await db
    .from('users')
    .select('id, email, role, is_active, last_login_at, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (userResult.error || !userResult.data) {
    notFound()
  }

  const user = userResult.data as {
    id: string
    email: string
    role: 'admin' | 'photographer' | 'retoucher' | 'guest'
    is_active: boolean
    last_login_at: string | null
    created_at: string
    updated_at: string
  }

  return <UserDetailClient user={user} />
}
