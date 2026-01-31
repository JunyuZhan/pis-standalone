/**
 * Supabase Auth 兼容层
 * 
 * 注意：此文件保留用于向后兼容，但 PIS 现在只使用 Supabase 认证
 * 自定义认证模式相关代码已移除
 */
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentUser,
  getUserFromRequest,
  destroySession,
  AuthUser,
} from './index'

// ==================== 兼容类型 ====================

interface SupabaseUser {
  id: string
  email?: string
  created_at?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: SupabaseUser
}

interface AuthError {
  message: string
  status?: number
}

// ==================== Auth 兼容对象 ====================

class CustomAuthClient {
  /**
   * 获取当前用户
   * Note: This is a compatibility layer for Supabase Auth API
   * PIS now uses Supabase only, but this file is kept for backward compatibility
   */
  async getUser(): Promise<{ data: { user: SupabaseUser | null }; error: AuthError | null }> {
    try {
      const user = await getCurrentUser()
      
      if (!user) {
        return { data: { user: null }, error: null }
      }

      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { data: { user: null }, error: { message } }
    }
  }

  /**
   * 获取当前会话
   */
  async getSession(): Promise<{ data: { session: SupabaseSession | null }; error: AuthError | null }> {
    try {
      const user = await getCurrentUser()
      
      if (!user) {
        return { data: { session: null }, error: null }
      }

      const cookieStore = await cookies()
      const accessToken = cookieStore.get('pis-auth-token')?.value || ''

      return {
        data: {
          session: {
            access_token: accessToken,
            refresh_token: '',
            user: {
              id: user.id,
              email: user.email,
            },
          },
        },
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { data: { session: null }, error: { message } }
    }
  }

  /**
   * 使用密码登录
   */
  async signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ data: { user: SupabaseUser | null; session: SupabaseSession | null }; error: AuthError | null }> {
    // This method is deprecated - PIS now uses Supabase Auth directly
    return {
      data: { user: null, session: null },
      error: { message: 'Custom auth is deprecated. Please use Supabase Auth.', status: 501 },
    }
  }

  /**
   * 登出
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      await destroySession()
      return { error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { error: { message } }
    }
  }

  /**
   * 注册新用户
   */
  async signUp(credentials: {
    email: string
    password: string
  }): Promise<{ data: { user: SupabaseUser | null; session: SupabaseSession | null }; error: AuthError | null }> {
    // This method is deprecated - PIS now uses Supabase Auth directly
    return {
      data: { user: null, session: null },
      error: { message: 'Custom auth is deprecated. Please use Supabase Auth.', status: 501 },
    }
  }

  /**
   * 监听认证状态变化（客户端使用）
   * 注意：在自定义认证中，这是一个空实现
   */
  onAuthStateChange(_callback: (event: string, session: SupabaseSession | null) => void): {
    data: { subscription: { unsubscribe: () => void } }
  } {
    // 自定义认证不支持实时监听，返回空实现
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }
  }
}

// ==================== 兼容客户端工厂 ====================
// Note: These functions are kept for backward compatibility but are not used in PostgreSQL mode
// PIS now uses PostgreSQL by default, so these compatibility functions are deprecated

/**
 * 创建兼容的 Auth 客户端（服务端）
 * @deprecated Not used - PIS now uses Supabase directly
 */
export function createCompatAuthClient() {
  return {
    auth: new CustomAuthClient(),
    from: () => {
      throw new Error('Database queries should use Supabase client directly. This compatibility layer is deprecated.')
    },
  }
}

/**
 * 从请求创建兼容的 Auth 客户端
 * @deprecated Not used - PIS now uses PostgreSQL by default
 */
export function createCompatAuthClientFromRequest(_request: NextRequest, _response?: NextResponse) {
  return {
    auth: new CustomAuthClient(),
    from: () => {
      throw new Error('Database queries should use Supabase client directly. This compatibility layer is deprecated.')
    },
  }
}

// ==================== Middleware 兼容 ====================

/**
 * 自定义认证 Middleware（替代 Supabase middleware）
 * Note: This is kept for backward compatibility but is not used in PostgreSQL mode
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request })
  
  const user = await getUserFromRequest(request)

  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 登录页面逻辑
    if (request.nextUrl.pathname === '/admin/login') {
      if (user) {
        // 已登录，重定向到管理后台首页
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
      // 未登录，允许访问登录页
      return response
    }

    // 其他管理后台页面逻辑
    if (!user) {
      // 未登录，重定向到登录页
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
  }

  return response
}
