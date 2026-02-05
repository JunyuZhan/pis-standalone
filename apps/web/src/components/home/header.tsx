'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

export function HomeHeader() {
  const t = useTranslations('nav')
  const tHome = useTranslations('home')
  
  // 支持通过环境变量配置自定义 logo，默认使用新生成的图标
  const logoPath = process.env.NEXT_PUBLIC_LOGO_URL || '/icons/icon-192x192.png'
  // 添加版本号参数破坏缓存，确保 Vercel 部署后能立即看到新 logo
  // Service Worker 已更新为网络优先策略，但仍添加版本号作为额外保障
  const logoUrl = `${logoPath}?v=3` // 更新 logo 时请更新此版本号

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border safe-area-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 md:py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 cursor-pointer group touch-manipulation">
          {/* Logo */}
          <Image
            src={logoUrl}
            alt="PIS Logo"
            width={40}
            height={40}
            className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 flex-shrink-0 transition-transform group-hover:scale-110"
            unoptimized
          />
          {/* 品牌名称和说明 */}
          <div className="flex flex-col">
            <span className="text-base sm:text-lg md:text-xl font-serif font-bold leading-tight">PIS</span>
            <span className="text-[9px] sm:text-xs text-text-muted leading-tight">
              {tHome('description')}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link 
            href="/admin" 
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 text-text-muted hover:text-text-secondary transition-colors cursor-pointer group rounded-md hover:bg-surface touch-manipulation active:bg-surface-elevated"
            prefetch={false}
            title={t('admin')}
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      </div>
    </header>
  )
}
