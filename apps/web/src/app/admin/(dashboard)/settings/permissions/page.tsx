import { Metadata } from 'next'
import { PermissionManager } from '@/components/admin/permission-manager'

export const metadata: Metadata = {
  title: '权限管理 - 管理后台',
  description: '管理角色和用户权限',
}

export default function PermissionsPage() {
  return (
    <div className="p-6 space-y-6">
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
