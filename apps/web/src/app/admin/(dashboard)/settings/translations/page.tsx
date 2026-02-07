import Link from 'next/link'
import { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { TranslationManager } from '@/components/admin/translation-manager'

export const metadata: Metadata = {
  title: '语言包管理 - 管理后台',
  description: '管理系统翻译字符串',
}

export default function TranslationsPage() {
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
        <h1 className="text-2xl font-bold">语言包管理</h1>
        <p className="text-text-muted mt-1">
          管理系统的多语言翻译字符串，可以自定义覆盖默认翻译
        </p>
      </div>

      <TranslationManager />
    </div>
  )
}
