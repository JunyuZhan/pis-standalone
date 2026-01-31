'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function SiteFooter() {
  const t = useTranslations('footer')
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 text-xs md:text-sm text-text-muted">
          {/* 左侧：版权和链接 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:gap-4">
            <span>© {currentYear} {process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'}</span>
            <span className="hidden md:inline">|</span>
            <div className="flex items-center gap-2">
              <span className="hover:text-accent transition-colors cursor-pointer">
                {t('privacyPolicy')}
              </span>
              <span className="text-border">·</span>
              <span className="hover:text-accent transition-colors cursor-pointer">
                {t('termsOfService')}
              </span>
            </div>
          </div>

          {/* 右侧：Powered by */}
          <div className="flex items-center gap-1">
            <span>{t('poweredBy')}</span>
            <Link
              href="https://github.com/JunyuZhan/pis-standalone"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline transition-colors"
            >
              PIS
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
