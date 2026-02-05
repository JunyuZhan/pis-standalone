/**
 * Language Switcher Component
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Languages } from 'lucide-react'
import { locales, localeNames, type Locale, defaultLocale } from '@/i18n/config'
import { getLocaleFromCookie, setLocaleCookie } from '@/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitcher() {
  const router = useRouter()
  const t = useTranslations('common')
  const [locale, setLocale] = useState<Locale>(defaultLocale)

  useEffect(() => {
    // Initialize locale from cookie
    setLocale(getLocaleFromCookie())

    // Listen for locale changes
    const handleLocaleChange = (event: CustomEvent<{ locale: Locale }>) => {
      setLocale(event.detail.locale)
    }

    window.addEventListener('localechange', handleLocaleChange as EventListener)

    return () => {
      window.removeEventListener('localechange', handleLocaleChange as EventListener)
    }
  }, [])

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return
    
    setLocaleCookie(newLocale)
    setLocale(newLocale)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface transition-colors min-h-[44px] active:scale-[0.98] touch-manipulation"
          aria-label={t('changeLanguage')}
          suppressHydrationWarning
        >
          <Languages className="w-4 h-4" />
          <span className="text-sm font-medium">{localeNames[locale]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={`cursor-pointer ${locale === loc ? 'bg-surface font-medium' : ''}`}
          >
            <span className="flex items-center gap-2">
              {locale === loc && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
              {localeNames[loc]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
