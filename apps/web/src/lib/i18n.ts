/**
 * @fileoverview 国际化工具函数
 *
 * 简化的 i18n 实现，无需路由变更即可切换语言。
 * 使用 Cookie 存储用户语言偏好。
 *
 * @module lib/i18n
 *
 * @example
 * ```typescript
 * import { useLocale, setLocaleCookie } from '@/lib/i18n'
 *
 * function LanguageSelector() {
 *   const locale = useLocale()
 *   const handleChange = (newLocale: Locale) => {
 *     setLocaleCookie(newLocale)
 *     window.location.reload()
 *   }
 *   return <select value={locale} onChange={e => handleChange(e.target.value)} />
 * }
 * ```
 */

'use client'

import { useLocale as useNextIntlLocale } from 'next-intl'
import { locales, defaultLocale, type Locale } from '@/i18n/config'

/**
 * 从 Cookie 获取当前语言设置
 *
 * @description
 * 读取存储在 Cookie 中的语言偏好，如果无效则返回默认语言。
 *
 * @returns {Locale} 当前语言代码
 *
 * @example
 * ```typescript
 * const locale = getLocaleFromCookie()
 * console.log('当前语言:', locale) // 'zh' | 'en'
 * ```
 */
export function getLocaleFromCookie(): Locale {
  if (typeof window === 'undefined') return defaultLocale

  const cookies = document.cookie.split(';')
  const localeCookie = cookies.find((c) => c.trim().startsWith('NEXT_LOCALE='))

  if (localeCookie) {
    const locale = localeCookie.split('=')[1]?.trim() as Locale
    if (locales.includes(locale)) {
      return locale
    }
  }

  return defaultLocale
}

/**
 * 设置语言 Cookie
 *
 * @description
 * 将语言偏好保存到 Cookie，并触发自定义事件通知其他组件。
 *
 * @param {Locale} locale - 要设置的语言代码
 *
 * @example
 * ```typescript
 * setLocaleCookie('en')
 * // 触发 'localechange' 事件
 * window.addEventListener('localechange', (e) => {
 *   console.log('语言已变更:', e.detail.locale)
 * })
 * ```
 */
export function setLocaleCookie(locale: Locale) {
  if (typeof window === 'undefined') return
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`

  // Dispatch custom event to notify locale change
  window.dispatchEvent(
    new CustomEvent('localechange', { detail: { locale } })
  )
}

/**
 * 获取当前语言的 Hook（客户端组件）
 *
 * @description
 * 从 next-intl 获取当前语言，如果不在 Provider 中则回退到 Cookie 读取。
 *
 * @returns {Locale} 当前语言代码
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const locale = useLocale()
 *   return <div>当前语言: {locale}</div>
 * }
 * ```
 */
export function useLocale(): Locale {
  try {
    return useNextIntlLocale() as Locale
  } catch {
    // Fallback if not in NextIntlProvider
    return getLocaleFromCookie()
  }
}
