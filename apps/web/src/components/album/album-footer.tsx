'use client'

import { Camera, Heart } from 'lucide-react'
import { useTranslations } from 'next-intl'
export function AlbumFooter() {
  const t = useTranslations('footer')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-surface border-t border-border mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* 上部分：品牌信息 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-border/50">
          {/* 品牌 Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-serif font-bold text-lg">PIS</p>
              <p className="text-xs text-text-muted">{t('description')}</p>
            </div>
          </div>

          {/* 感谢语 */}
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <span>{t('thankYou')}</span>
            <Heart className="w-4 h-4 text-red-400 fill-current" />
          </div>
        </div>

        {/* 下部分：版权信息 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6 text-text-muted text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span>© {currentYear} {process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'}. All rights reserved.</span>
            <span className="hidden md:inline">|</span>
            <a href="#" className="hover:text-accent transition-colors">{t('privacyPolicy')}</a>
            <a href="#" className="hover:text-accent transition-colors">{t('termsOfService')}</a>
          </div>

          <div className="flex items-center gap-1">
            <span>{t('poweredBy')}</span>
            <a 
              href="https://github.com/JunyuZhan/pis-standalone" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              PIS
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
