'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Camera, Images, Settings, LogOut, Home } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/lib/auth'

interface AdminSidebarProps {
  user: AuthUser
}

const navItems = [
  { href: '/admin', label: '相册管理', icon: Images },
  { href: '/admin/settings', label: '系统设置', icon: Settings },
]

export function SidebarContent({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    }
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
            <Camera className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="font-serif font-bold">PIS</h1>
            <p className="text-xs text-text-muted">管理后台</p>
          </div>
        </Link>
      </div>

      {/* 返回前端按钮 */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
            'border border-border hover:border-accent/20'
          )}
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">返回前端</span>
        </Link>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin' || pathname.startsWith('/admin/albums')
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 语言切换器 */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>

      {/* 用户信息 */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 bg-surface-elevated rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">
              {user.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 hidden md:block">
      <SidebarContent user={user} />
    </aside>
  )
}
