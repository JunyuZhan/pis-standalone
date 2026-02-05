import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/database'
import { redirect } from 'next/navigation'
import { UserList } from '@/components/admin/user-list'

/**
 * 用户列表页
 */
export default async function UsersPage() {
  // 检查登录状态
  const user = await getCurrentUser()
  if (!user) {
    redirect('/admin/login')
  }

  // 检查管理员权限（直接查询数据库）
  const db = await createAdminClient()
  const userResult = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .is('deleted_at', null)
    .single()

  if (userResult.error || !userResult.data) {
    redirect('/admin/login')
  }

  const role = (userResult.data as { role: string }).role
  if (role !== 'admin') {
    redirect('/admin')
  }

  return (
    <Suspense fallback={<UserListSkeleton />}>
      <UserList />
    </Suspense>
  )
}

function UserListSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题骨架 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <div className="h-8 w-32 bg-surface rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-48 bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-28 bg-surface rounded-lg animate-pulse" />
      </div>

      {/* 表格骨架 */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-background rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
