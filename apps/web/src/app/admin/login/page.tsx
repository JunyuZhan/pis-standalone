'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Eye, EyeOff, Lock } from 'lucide-react'
import { Turnstile } from '@/components/auth/turnstile'

/**
 * 管理员登录页
 */
// 固定管理员邮箱和用户名映射
const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_USERNAME = 'admin'

export default function LoginPage() {
  const router = useRouter()
  // 登录方式：'email' | 'username'
  const [loginType, setLoginType] = useState<'email' | 'username'>('username')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState(ADMIN_USERNAME)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const [isClient, setIsClient] = useState(false)
  const pageLoadTimeRef = useRef<number | null>(null)
  
  // 首次登录设置密码相关状态
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState<boolean | null>(null) // null 表示正在检查
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)

  // 检查是否配置了 Turnstile（只在客户端检查，避免 Hydration 错误）
  useEffect(() => {
    setIsClient(true)
    // 记录页面加载时间（Turnstile 验证从此时开始）
    pageLoadTimeRef.current = Date.now()
    
    // 页面加载时检查管理员账户状态
    checkAdminStatus()
  }, [])

  // 检查管理员账户状态
  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/auth/check-admin-status', {
        cache: 'no-store', // 确保每次都获取最新状态
      })
      
      if (!response.ok) {
        // 如果 API 返回错误，默认显示登录表单（更安全，避免误操作）
        setNeedsPasswordSetup(false)
        return
      }
      
      const data = await response.json()
      
      // 根据 API 返回的结果设置状态
      // 确保正确处理布尔值（防止字符串 "true"/"false"）
      const needsSetup = data.needsPasswordSetup === true || data.needsPasswordSetup === 'true'
      setNeedsPasswordSetup(needsSetup)
    } catch {
      // 网络错误或其他错误，默认显示登录表单（更安全）
      setNeedsPasswordSetup(false)
    } finally {
      setCheckingStatus(false)
    }
  }

  const hasTurnstile = isClient && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // 注意：错误消息现在由服务端统一处理，不再需要客户端映射
  // 保留此函数用于向后兼容，但实际不再使用

  // 将用户名或邮箱转换为实际邮箱
  const getEmailForLogin = (): string => {
    if (loginType === 'username') {
      // 用户名登录：固定映射到 admin@example.com
      if (username.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
        return ADMIN_EMAIL
      }
      // 其他用户名暂不支持，返回空字符串（会触发验证错误）
      return ''
    } else {
      // 邮箱登录：使用用户输入的邮箱
      return email.trim()
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 防止重复提交：如果已经在加载中，直接返回
    if (loading) {
      console.log('[Login] Already processing, ignoring duplicate click')
      return
    }
    
    // 立即设置加载状态，确保用户看到反馈
    setLoading(true)
    setError('')
    
    // 使用 requestAnimationFrame 确保 UI 更新
    await new Promise(resolve => requestAnimationFrame(resolve))

    // 前端验证
    if (loginType === 'username') {
      if (!username.trim()) {
        setError('请输入用户名')
        setLoading(false)
        return
      }
      if (username.toLowerCase() !== ADMIN_USERNAME.toLowerCase()) {
        setError('用户名错误，仅支持 admin')
        setLoading(false)
        return
      }
    } else {
      if (!email.trim()) {
        setError('请输入邮箱地址')
        setLoading(false)
        return
      }
      // 简单的邮箱格式验证
      if (!email.includes('@')) {
        setError('请输入有效的邮箱地址')
        setLoading(false)
        return
      }
    }
    
    if (!password) {
      setError('请输入密码')
      setLoading(false)
      return
    }

    // 如果配置了 Turnstile，等待验证完成
    // Invisible 模式会在页面加载时自动执行验证
    // 优化：减少等待时间，避免用户感觉没有反应
    if (hasTurnstile && !turnstileToken && !turnstileError) {
      // 计算从页面加载到现在已经过去的时间
      const timeSincePageLoad = pageLoadTimeRef.current 
        ? Date.now() - pageLoadTimeRef.current 
        : 0
      
      // Turnstile 验证从页面加载时就开始，用户输入的时间已经算在内
      // 如果已经等待了超过 3 秒（从页面加载开始），直接继续（进一步减少等待时间）
      if (timeSincePageLoad > 3000) {
        console.log('[Login] Turnstile timeout (>3s), proceeding with login')
        // 继续登录流程，让服务端处理（服务端有降级策略）
      } else {
        // 如果页面刚加载不久，最多再等待 500ms（大幅减少等待时间）
        // Turnstile 通常在页面加载后很快完成验证
        const remainingWait = Math.max(0, 500 - timeSincePageLoad)
        if (remainingWait > 0) {
          console.log(`[Login] Waiting for Turnstile (${remainingWait}ms remaining)`)
          // 使用更短的等待间隔，让 UI 能够及时更新
          const waitInterval = 50 // 进一步减少到 50ms，让 UI 更流畅
          let waited = 0
          while (!turnstileToken && !turnstileError && waited < remainingWait) {
            await new Promise((resolve) => setTimeout(resolve, waitInterval))
            waited += waitInterval
          }
        }
        
        // 如果仍然没有 token，继续登录流程（降级策略）
        if (!turnstileToken && !turnstileError) {
          console.log('[Login] Turnstile not ready, proceeding with login (fallback)')
        } else {
          console.log('[Login] Turnstile ready, proceeding with login')
        }
      }
    }

    try {
      console.log('[Login] Starting login request')
      
      // 获取实际邮箱（用户名登录会转换为 admin@example.com）
      const actualEmail = getEmailForLogin()
      
      // 调用服务端登录 API（包含速率限制和登录逻辑）
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: actualEmail,
          password,
          turnstileToken: turnstileToken || undefined, // 可选：如果配置了 Turnstile
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // 处理首次登录需要设置密码的情况（428 Precondition Required）
        if (response.status === 428 && (data.requiresPasswordSetup || data.error?.code === 'PASSWORD_NOT_SET')) {
          // 重新检查状态，确保 UI 正确显示密码设置表单
          await checkAdminStatus()
          setError('首次登录需要设置密码')
          setPassword('') // 清空密码输入
          return
        }
        
        // 处理速率限制错误
        if (response.status === 429) {
          setError(data.error?.message || '请求过于频繁，请稍后再试')
        } else if (response.status === 401) {
          // 统一错误消息，不暴露具体错误原因
          setError('邮箱或密码错误')
        } else if (response.status === 400) {
          // 显示详细的验证错误信息
          if (data.error?.details && Array.isArray(data.error.details) && data.error.details.length > 0) {
            const firstDetail = data.error.details[0]
            setError(firstDetail.message || data.error?.message || '输入验证失败')
          } else {
            setError(data.error?.message || '请求格式错误')
          }
        } else {
          setError(data.error?.message || '登录失败，请重试')
        }
        return
      }

      // 登录成功，使用 window.location 强制刷新页面以确保 cookie 生效
      console.log('[Login] Login successful, redirecting to admin')
      // 使用 window.location.href 而不是 router.push，确保浏览器重新加载页面
      // 这样可以让服务端设置的 cookie 立即生效，避免 layout 检查用户时读取不到会话
      window.location.href = '/admin'
    } catch (err) {
      console.error('[Login] Login error:', err)
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
      console.log('[Login] Login process completed')
    }
  }

  // 处理首次登录设置密码
  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupLoading(true)
    setError('')

    // 前端验证
    if (!newPassword || newPassword.length < 8) {
      setError('密码至少需要 8 个字符')
      setSetupLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      setSetupLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: ADMIN_EMAIL, // 固定使用 admin@example.com
          password: newPassword,
          confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          setError(data.error?.message || '请求过于频繁，请稍后再试')
        } else if (response.status === 400 && data.error?.code === 'PASSWORD_ALREADY_SET') {
          // 密码已设置，静默切换到登录表单（不显示错误消息，因为这是正常状态）
          // 重新检查状态，确保 UI 正确显示登录表单
          await checkAdminStatus()
          // 不设置错误消息，让用户看到登录表单即可
        } else {
          setError(data.error?.message || '密码设置失败，请重试')
        }
        return
      }

      // 密码设置成功，自动使用新密码登录
      const savedPassword = newPassword // 保存密码用于登录
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      
      // 自动尝试登录
      try {
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: ADMIN_EMAIL, // 固定使用 admin@example.com
            password: savedPassword,
            turnstileToken: turnstileToken || undefined,
          }),
        })

        const loginData = await loginResponse.json()

        if (loginResponse.ok) {
          // 登录成功，使用 window.location 强制刷新页面以确保 cookie 生效
          console.log('[SetupPassword] Login successful after password setup, redirecting to admin')
          window.location.href = '/admin'
        } else {
          // 登录失败，重新检查状态（密码已设置，应该显示登录表单）
          setError(loginData.error?.message || '密码已设置，但自动登录失败，请刷新页面后登录')
          await checkAdminStatus() // 重新检查状态，确保显示登录表单
        }
      } catch (loginErr) {
        console.error('Auto login error:', loginErr)
        setError('密码已设置，但自动登录失败，请刷新页面后登录')
        await checkAdminStatus() // 重新检查状态，确保显示登录表单
      }
    } catch (err) {
      console.error('Setup password error:', err)
      setError('密码设置失败，请重试')
    } finally {
      setSetupLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-elevated rounded-2xl mb-4">
            <Camera className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-serif font-bold">PIS 管理后台</h1>
          <p className="text-text-secondary mt-2">
            {needsPasswordSetup === null ? '正在检查...' : needsPasswordSetup ? '首次登录，请设置密码' : '请登录以继续'}
          </p>
        </div>

        {/* 正在检查状态 */}
        {checkingStatus ? (
          <div className="card space-y-6 p-6 sm:p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-text-muted" />
            <p className="text-text-secondary">正在检查账户状态...</p>
          </div>
        ) : needsPasswordSetup ? (
          /* 首次登录设置密码表单 */
          <form onSubmit={handleSetupPassword} className="card space-y-6 p-6 sm:p-8">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-full mb-3">
                <Lock className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">首次登录，请设置密码</h2>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 用户名（固定为 admin，只读） */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                用户名
              </label>
              <input
                id="username"
                type="text"
                value="admin"
                readOnly
                className="input bg-surface-elevated cursor-not-allowed"
                disabled
              />
              <p className="text-xs text-text-muted mt-1">管理员账户用户名</p>
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                新密码
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="至少 8 个字符"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1.5 -m-1.5 rounded active:scale-[0.95] touch-manipulation"
                  aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1">密码至少需要 8 个字符</p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                确认密码
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="再次输入密码"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1.5 -m-1.5 rounded active:scale-[0.95] touch-manipulation"
                  aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={setupLoading}
              className="btn-primary w-full"
            >
              {setupLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  设置中...
                </>
              ) : (
                '设置密码并登录'
              )}
            </button>
          </form>
        ) : (
          /* 登录表单 */
          <form onSubmit={handleLogin} className="card space-y-6 p-6 sm:p-8">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 登录方式选择 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                登录方式
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('username')
                    setUsername(ADMIN_USERNAME)
                    setEmail('')
                    setError('')
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    loginType === 'username'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  用户名登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('email')
                    setEmail('')
                    setUsername('')
                    setError('')
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    loginType === 'email'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  邮箱登录
                </button>
              </div>
            </div>

            {/* 用户名或邮箱输入 */}
            {loginType === 'username' ? (
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  用户名
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="admin"
                  required
                />
                <p className="text-xs text-text-muted mt-1">当前仅支持 admin</p>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  邮箱地址
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="your@email.com"
                  required
                />
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1.5 -m-1.5 rounded active:scale-[0.95] touch-manipulation"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile (Invisible 模式) */}
            {hasTurnstile && (
              <div ref={turnstileContainerRef} className="hidden">
                <Turnstile
                  onVerify={(token) => {
                    setTurnstileToken(token)
                    setTurnstileError(false)
                  }}
                  onError={() => {
                    console.warn('Turnstile verification error, will proceed with fallback')
                    setTurnstileError(true)
                    // 不设置错误消息，允许降级登录
                    // 服务端会处理 Turnstile 验证失败的情况
                  }}
                  onExpire={() => {
                    setTurnstileToken(null)
                    // Token 过期不影响登录，用户重新提交时会重新验证
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
