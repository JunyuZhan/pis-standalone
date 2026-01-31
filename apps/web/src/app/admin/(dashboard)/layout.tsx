import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/sidebar'
import { MobileSidebar } from '@/components/admin/mobile-sidebar'
import { MobileBottomNav } from '@/components/admin/mobile-bottom-nav'

/**
 * 管理后台布局
 * 包含侧边栏导航
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <AdminSidebar user={user} />
      
      {/* 移动端侧边栏 */}
      <MobileSidebar user={user} />

      {/* 主内容区 - 移动端优化 */}
      <main className="md:ml-64 min-h-screen pb-16 md:pb-0">
        <div className="p-3 sm:p-4 md:p-8 pt-16 md:pt-8 safe-area-inset-bottom">{children}</div>
      </main>

      {/* 移动端底部导航栏 */}
      <MobileBottomNav />
    </div>
  )
}
