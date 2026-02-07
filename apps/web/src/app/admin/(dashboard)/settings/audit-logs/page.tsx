import Link from 'next/link'
import { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { AuditLogViewer } from '@/components/admin/audit-log-viewer'

export const metadata: Metadata = {
  title: '操作日志 - 管理后台',
  description: '查看系统操作日志和审计记录',
}

export default function AuditLogsPage() {
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
        <h1 className="text-2xl font-bold">操作日志</h1>
        <p className="text-muted-foreground">
          查看系统操作日志，追踪用户行为和变更记录
        </p>
      </div>

      <AuditLogViewer />
    </div>
  )
}
