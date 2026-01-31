'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 用户类型定义
 */
interface AuthUser {
  id: string
  email: string
}

/**
 * 认证状态 Hook
 * 提供用户状态和登出功能
 */
export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取当前用户
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })

    // 定期检查认证状态（每5分钟）
    const interval = setInterval(() => {
      fetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => {
          setUser(data.user)
        })
        .catch(() => {
          setUser(null)
        })
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

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
