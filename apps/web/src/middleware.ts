/**
 * Next.js Middleware - i18n + Custom Auth
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/auth/middleware'
import { locales, defaultLocale, type Locale } from './i18n/config'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Handle custom auth for admin API routes (refresh session for API calls)
  if (pathname.startsWith('/api/admin')) {
    return await updateSession(request)
  }

  // Handle i18n: Set locale cookie if not present
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value
  let locale: Locale = defaultLocale

  // Check Accept-Language header for browser preference
  if (!localeCookie) {
    const acceptLanguage = request.headers.get('accept-language')
    if (acceptLanguage) {
      // Simple language detection
      if (acceptLanguage.includes('en')) {
        locale = 'en'
      } else {
        locale = 'zh-CN'
      }
    }
  } else if (locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale
  }

  // Handle custom auth for admin routes first (takes priority over locale)
  if (pathname.startsWith('/admin')) {
    const authResponse = await updateSession(request)
    
    // Set locale cookie on the auth response
    if (!localeCookie || localeCookie !== locale) {
      authResponse.cookies.set('NEXT_LOCALE', locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
      })
    }
    
    return authResponse
  }

  // Set locale cookie if not present or different (for non-admin routes)
  if (!localeCookie || localeCookie !== locale) {
    const response = NextResponse.next()
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    })
    
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except static files and public API routes
  matcher: [
    // Match admin API routes (for session refresh)
    '/api/admin/:path*',
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
