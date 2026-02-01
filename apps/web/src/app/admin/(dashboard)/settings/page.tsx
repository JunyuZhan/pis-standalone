import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { User, Mail, Database, Server, Globe, Lock, HardDrive, Calendar, FileText, CheckCircle2, Download } from 'lucide-react'
import { ChangePasswordForm } from '@/components/admin/change-password-form'
import { TemplateManager } from '@/components/admin/template-manager'
import { ConsistencyChecker } from '@/components/admin/consistency-checker'
import { UpgradeManager } from '@/components/admin/upgrade-manager'

export default async function SettingsPage() {
  const db = await createClient()
  
  const user = await getCurrentUser()

  if (!user) {
    redirect('/admin/login')
  }

  // 获取相册统计
  const albumCountResult = await db
    .from('albums')
    .select('*')
    .is('deleted_at', null)
    .execute()

  const albumCount = albumCountResult.count || albumCountResult.data?.length || 0

  const photoCountResult = await db
    .from('photos')
    .select('*')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .execute()

  const photoCount = photoCountResult.count || photoCountResult.data?.length || 0

  // 获取公开相册数量
  const publicAlbumCountResult = await db
    .from('albums')
    .select('*')
    .eq('is_public', true)
    .is('deleted_at', null)
    .execute()

  const publicAlbumCount = publicAlbumCountResult.count || publicAlbumCountResult.data?.length || 0

  // 获取最近创建的相册
  const recentAlbumsResult = await db
    .from('albums')
    .select('created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .execute()

  const recentAlbums = (recentAlbumsResult.data || []) as Array<{ created_at: string }>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">系统设置</h1>
        <p className="text-text-secondary mt-1">管理您的账户和系统配置</p>
      </div>

      {/* 账户信息 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-accent" />
          账户信息
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-text-muted" />
            <div className="flex-1">
              <p className="text-sm text-text-muted">邮箱地址</p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-text-muted" />
            <div className="flex-1">
              <p className="text-sm text-text-muted">用户ID</p>
              <p className="font-mono text-sm break-all">{user.id}</p>
            </div>
          </div>
          {user.created_at && (
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-text-muted" />
              <div>
                <p className="text-sm text-text-muted">注册时间</p>
                <p className="font-medium">
                  {(() => {
                    const date = new Date(user.created_at)
                    const year = date.getFullYear()
                    const month = date.getMonth() + 1
                    const day = date.getDate()
                    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
                    return `${year}年${monthNames[month - 1]}${day}日`
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 修改密码 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-accent" />
          修改密码
        </h2>
        <ChangePasswordForm />
      </div>

      {/* 系统统计 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-accent" />
          系统统计
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface rounded-lg">
            <p className="text-sm text-text-muted mb-1">相册总数</p>
            <p className="text-2xl font-bold">{albumCount || 0}</p>
            <p className="text-xs text-text-muted mt-1">
              {publicAlbumCount || 0} 个公开
            </p>
          </div>
          <div className="p-4 bg-surface rounded-lg">
            <p className="text-sm text-text-muted mb-1">照片总数</p>
            <p className="text-2xl font-bold">{photoCount || 0}</p>
            <p className="text-xs text-text-muted mt-1">已完成处理</p>
          </div>
          <div className="p-4 bg-surface rounded-lg">
            <p className="text-sm text-text-muted mb-1">存储使用</p>
            <p className="text-2xl font-bold">
              {photoCount ? ((photoCount * 5) / 1024).toFixed(1) : '0'} GB
            </p>
            <p className="text-xs text-text-muted mt-1">估算值</p>
          </div>
        </div>
      </div>

      {/* 系统信息 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-accent" />
          系统信息
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-text-muted">应用版本</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-text-muted">数据库</span>
            <span className="font-medium">PostgreSQL</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-text-muted">存储服务</span>
            <span className="font-medium">MinIO</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <span className="text-text-muted">框架</span>
            <span className="font-medium">Next.js 15</span>
          </div>
          {recentAlbums && recentAlbums.length > 0 && (
            <div className="flex justify-between items-center py-2">
              <span className="text-text-muted">最后活动</span>
              <span className="font-medium">
                {(() => {
                  const date = new Date(recentAlbums[0].created_at)
                  const year = date.getFullYear()
                  const month = date.getMonth() + 1
                  const day = date.getDate()
                  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
                  return `${year}年${monthNames[month - 1]}${day}日`
                })()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 模板管理 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          相册模板
        </h2>
        <TemplateManager />
      </div>

      {/* 数据一致性检查 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-accent" />
          数据一致性检查
        </h2>
        <ConsistencyChecker />
      </div>

      {/* 系统升级 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-accent" />
          系统升级
        </h2>
        <UpgradeManager />
      </div>

      {/* 快速操作 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-accent" />
          快速操作
        </h2>
        <div className="space-y-2">
          <a
            href="/admin"
            className="block p-3 bg-surface rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <p className="font-medium">管理相册</p>
            <p className="text-sm text-text-muted">创建、编辑和删除相册</p>
          </a>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-surface rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <p className="font-medium">查看首页</p>
            <p className="text-sm text-text-muted">预览公开相册展示效果</p>
          </a>
        </div>
      </div>
    </div>
  )
}
