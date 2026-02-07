import Link from 'next/link'
import { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { BackupManager } from '@/components/admin/backup-manager'

export const metadata: Metadata = {
  title: '数据备份 - 设置',
  description: '数据备份与恢复管理',
}

export default function BackupPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">数据备份</h1>
        <p className="text-muted-foreground">
          备份和恢复系统数据，保护您的重要信息
        </p>
      </div>
      <BackupManager />
    </div>
  )
}
