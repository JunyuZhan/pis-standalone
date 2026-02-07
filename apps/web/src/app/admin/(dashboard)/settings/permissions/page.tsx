import Link from 'next/link'
import { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { PermissionManager } from '@/components/admin/permission-manager'

export const metadata: Metadata = {
  title: '权限管理 - 管理后台',
  description: '管理角色和用户权限',
}

export default function PermissionsPage() {
  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="flex items-center gap-2 text-text-secondary">
        <Link
          href="/admin/settings"
          className="flex items-center gap-1 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回系统设置
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">权限管理</h1>
        <p className="text-muted-foreground">
          配置角色权限，控制不同用户的操作范围
        </p>
      </div>

      <PermissionManager />
    </div>
  )
}
