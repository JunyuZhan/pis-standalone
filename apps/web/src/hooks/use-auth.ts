'use client'

/**
 * PIS Web - 认证状态 Hook
 *
 * 提供用户认证状态管理和登出功能
 *
 * @author PIS Contributors
 * @license MIT
 *
 * @example
 * ```typescript
 * import { useAuth } from '@/hooks/use-auth'
 *
 * function MyComponent() {
 *   const { user, loading, isAuthenticated, signOut } = useAuth()
 *
 *   if (loading) return <div>加载中...</div>
 *   if (!isAuthenticated) return <div>请先登录</div>
 *
 *   return <div>欢迎, {user.email}</div>
 * }
 * ```
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 认证用户信息
 */
interface AuthUser {
  /** 用户唯一标识符（UUID） */
  id: string
  /** 用户邮箱地址 */
  email: string
}

/**
 * 认证状态 Hook 返回值
 */
interface UseAuthReturn {
  /** 当前用户信息，未登录时为 null */
  user: AuthUser | null
  /** 加载状态 */
  loading: boolean
  /** 是否已登录 */
  isAuthenticated: boolean
  /** 登出函数 */
  signOut: () => Promise<void>
}

/**
 * 认证状态 Hook
 *
 * @description
 * - 自动获取当前用户信息
 * - 每 5 分钟刷新一次认证状态
 * - 提供登出功能
 *
 * @returns 认证状态对象
 *
 * @example
 * ```typescript
 * function AdminHeader() {
 *   const { user, isAuthenticated, signOut } = useAuth()
 *
 *   return (
 *     <header>
 *       {isAuthenticated && (
 *         <>
 *           <span>{user?.email}</span>
 *           <button onClick={signOut}>登出</button>
 *         </>
 *       )}
 *     </header>
 *   )
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取当前用户
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        setUser(data.user)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // 定期检查认证状态（每 5 分钟）
    const interval = setInterval(fetchUser, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  /**
   * 登出函数
   *
   * @description
   * 调用登出 API，清除本地状态，并跳转到登录页
   */
  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch (error) {
      console.error('Sign out error:', error)
    }
    setUser(null)
    router.push('/admin/login')
    router.refresh()
  }

  return {
    user,
    loading,
    signOut,
    isAuthenticated: !!user,
  }
}
