import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkRateLimit } from '@/middleware-rate-limit'
import { 
  getAuthDatabase 
} from '@/lib/auth'
import { createAccessToken, createRefreshToken, COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/password'
import { initAuthDatabase } from '@/lib/auth/database'
import { loginSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError } from '@/lib/validation/error-handler'
import { createAdminClient } from '@/lib/database'
import { logLogin } from '@/lib/audit-log'

// 初始化认证数据库（如果尚未初始化）
try {
  initAuthDatabase()
} catch {
  // 可能已经初始化，忽略错误
}

/**
 * 登录 API 路由（服务端）
 * 
 * @route POST /api/auth/login
 * @description 用户登录接口，完全在服务端执行登录，防止客户端绕过速率限制
 * 
 * @security
 * - 基于 IP 的速率限制（5 次/分钟）
 * - 基于邮箱的速率限制（防止针对特定账户的攻击）
 * - 统一错误消息（不暴露具体错误原因）
 * - 服务端执行登录（客户端无法绕过）
 * 
 * @body {Object} requestBody - 登录请求体
 * @body {string} requestBody.email - 用户邮箱（必填）
 * @body {string} requestBody.password - 用户密码（必填）
 * 
 * @returns {Object} 200 - 登录成功
 * @returns {Object} 200.data.user - 用户信息
 * @returns {string} 200.data.user.id - 用户ID
 * @returns {string} 200.data.user.email - 用户邮箱
 * 
 * @returns {Object} 400 - 请求参数错误
 * @returns {Object} 401 - 认证失败（邮箱或密码错误）
 * @returns {Object} 429 - 请求过于频繁（速率限制）
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/auth/login', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     email: 'user@example.com',
 *     password: 'password123'
 *   })
 * })
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // 获取客户端 IP 地址（改进的 IP 提取逻辑）
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare
    
    // 优先使用 Cloudflare IP，然后是 x-forwarded-for 的第一个 IP，最后是 x-real-ip
    // 注意：NextRequest 没有 ip 属性，需要通过 headers 获取
    let ip = 'unknown'
    if (cfConnectingIp) {
      ip = cfConnectingIp
    } else if (forwardedFor) {
      // x-forwarded-for 可能包含多个 IP，取第一个（客户端真实 IP）
      ip = forwardedFor.split(',')[0].trim()
    } else if (realIp) {
      ip = realIp
    }

    // 解析和验证请求体
    let body: unknown
    try {
      const contentType = request.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return NextResponse.json(
          { error: '请求格式错误：Content-Type 必须是 application/json' },
          { status: 400 }
        )
      }
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: `请求格式错误：${error instanceof Error ? error.message : '无法解析 JSON'}` },
        { status: 400 }
      )
    }

    // 验证输入（不包括 turnstileToken，单独处理）
    const validation = safeValidate(loginSchema, body)
    if (!validation.success) {
      // 返回详细的验证错误信息
      const errorDetails = validation.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }))
      
      // 构建友好的错误消息
      const firstError = validation.error.errors[0]
      let errorMessage = '输入验证失败'
      if (firstError.path[0] === 'email') {
        errorMessage = firstError.message || '请输入有效的邮箱地址或用户名 admin'
      } else if (firstError.path[0] === 'password') {
        errorMessage = '密码不能为空'
      }
      
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: errorMessage,
            details: errorDetails,
          },
        },
        { status: 400 }
      )
    }

    let { email } = validation.data
    const { password } = validation.data
    const turnstileToken = (body as { turnstileToken?: string }).turnstileToken
    
    // 支持用户名登录：如果输入的是 "admin"，查找第一个管理员账户
    // 注意：这里只处理 "admin" 用户名，其他用户名需要是有效的邮箱格式
    if (email.toLowerCase() === 'admin') {
      // 查找第一个管理员账户的邮箱
      const authDb = getAuthDatabase()
      if (authDb.hasAnyAdmin && typeof authDb.hasAnyAdmin === 'function') {
        const hasAdmin = await authDb.hasAnyAdmin()
        if (hasAdmin) {
          // 查询第一个管理员账户
          try {
            const db = await createAdminClient()
            const adminResult = await db
              .from('users')
              .select('email')
              .eq('role', 'admin')
              .is('deleted_at', null)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle()
            
            if (adminResult.error) {
              console.error('[Login] Error querying admin user:', adminResult.error)
              email = 'admin@pis.com'
            } else if (adminResult.data) {
              const adminData = adminResult.data as { email?: string }
              if (adminData.email) {
                email = adminData.email
              } else {
                // 回退到默认邮箱
                email = 'admin@pis.com'
              }
            } else {
              // 回退到默认邮箱
              email = 'admin@pis.com'
            }
          } catch (error) {
            console.error('[Login] Error creating admin client or querying admin user:', error)
            email = 'admin@pis.com'
          }
        } else {
          email = 'admin@pis.com'
        }
      } else {
        // 回退到默认邮箱
        email = 'admin@pis.com'
      }
    }

    // 如果配置了 Turnstile，验证 token
    // 注意：Turnstile 是可选功能，如果验证失败或没有 token，允许降级登录（记录警告日志）
    const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY
    if (turnstileSecretKey) {
      if (!turnstileToken) {
        // Turnstile 配置了但没有 token，可能是：
        // 1. Turnstile 脚本加载失败
        // 2. 验证超时
        // 3. 网络问题
        // 允许降级登录，但记录警告日志
        console.warn('[Login] Turnstile configured but no token provided, allowing fallback login')
        // 不阻止登录，继续执行登录流程
      } else {

        // 验证 token
        try {
          const verifyResponse = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                secret: turnstileSecretKey,
                response: turnstileToken,
                remoteip: ip !== 'unknown' ? ip : undefined,
              }),
            }
          )

          const verifyData = await verifyResponse.json()

          if (!verifyData.success) {
            // Turnstile 验证失败，允许降级登录（记录警告日志）
            console.warn('[Login] Turnstile verification failed, allowing fallback login:', verifyData)
            // 不阻止登录，继续执行登录流程
          } else {
            console.log('[Login] Turnstile verification successful')
          }
        } catch (error) {
          // Turnstile 验证服务不可用，允许降级登录（记录警告日志）
          console.warn('[Login] Turnstile verification service unavailable, allowing fallback login:', error)
          // 不阻止登录，继续执行登录流程
        }
      }
    }

    // 邮箱已通过 zod 验证，直接使用
    const normalizedEmail = email.trim().toLowerCase()

    // 双重速率限制：
    // 1. 基于 IP 的限制（防止单 IP 暴力破解）
    // 2. 基于邮箱的限制（防止针对特定账户的攻击）
    const ipRateLimit = await checkRateLimit(`login:ip:${ip}`, 5, 60 * 1000)
    const emailRateLimit = await checkRateLimit(`login:email:${normalizedEmail}`, 3, 60 * 1000)

    if (!ipRateLimit.allowed) {
      const retryAfter = Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `登录尝试过于频繁，请 ${retryAfter} 秒后再试`,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      )
    }

    if (!emailRateLimit.allowed) {
      const retryAfter = Math.ceil((emailRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `该账户登录尝试过于频繁，请 ${retryAfter} 秒后再试`,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(emailRateLimit.resetAt).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      )
    }

    // 速率限制通过，执行登录
    try {
      const authDb = getAuthDatabase()
      
      // 查找用户
      const user = await authDb.findUserByEmail(normalizedEmail)
      
      if (!user) {
        // 用户不存在，返回统一错误消息（防止用户枚举）
        return NextResponse.json(
          {
            error: {
              code: 'AUTH_ERROR',
              message: '邮箱或密码错误',
            },
          },
          {
            status: 401,
            headers: {
              'X-RateLimit-Limit': '5',
              'X-RateLimit-Remaining': (ipRateLimit.remaining - 1).toString(),
              'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
            },
          }
        )
      }

      // 检查密码是否已设置
      // password_hash 为 null 或空字符串表示密码未设置
      if (!user.password_hash || (typeof user.password_hash === 'string' && user.password_hash.trim() === '')) {
        // 密码未设置，返回特殊状态码提示需要设置密码
        return NextResponse.json(
          {
            error: {
              code: 'PASSWORD_NOT_SET',
              message: '首次登录需要设置密码',
            },
            requiresPasswordSetup: true,
            email: user.email,
          },
          {
            status: 428, // 428 Precondition Required
            headers: {
              'X-RateLimit-Limit': '5',
              'X-RateLimit-Remaining': (ipRateLimit.remaining - 1).toString(),
              'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
            },
          }
        )
      }

      // 验证密码
      // 开发环境添加调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log('[Login] Verifying password:', {
          email: normalizedEmail,
          passwordLength: password.length,
          passwordHashExists: !!user.password_hash,
          passwordHashLength: user.password_hash?.length || 0,
          passwordHashFormat: user.password_hash ? (user.password_hash.includes(':') ? 'valid' : 'invalid') : 'null',
          passwordHashPreview: user.password_hash ? `${user.password_hash.substring(0, 20)}...` : 'null',
          passwordHashFull: user.password_hash, // 完整哈希用于调试
        })
      }
      
      const isValidPassword = await verifyPassword(password, user.password_hash)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[Login] Password verification result:', {
          email: normalizedEmail,
          isValid: isValidPassword,
        })
      }
      
      if (!isValidPassword) {
        // 密码错误，返回统一错误消息
        return NextResponse.json(
          {
            error: {
              code: 'AUTH_ERROR',
              message: '邮箱或密码错误',
            },
          },
          {
            status: 401,
            headers: {
              'X-RateLimit-Limit': '5',
              'X-RateLimit-Remaining': (ipRateLimit.remaining - 1).toString(),
              'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
            },
          }
        )
      }

      // 登录成功，创建会话
      // 使用 cookies().set() 设置 cookie，它会自动添加到响应中
      const accessToken = await createAccessToken({ id: user.id, email: user.email })
      const refreshToken = await createRefreshToken({ id: user.id, email: user.email })
      
      // 使用 cookies() API 设置 cookie（这会自动添加到响应中）
      const cookieStore = await cookies()
      
      // 根据实际请求协议设置 secure 标志
      // 如果请求是 HTTPS，设置 secure: true；如果是 HTTP，设置 secure: false
      // 这样可以支持生产环境使用 HTTP（内网部署）的情况
      const protocol = request.headers.get('x-forwarded-proto') || 
                      (request.url.startsWith('https://') ? 'https' : 'http')
      const isHttps = protocol === 'https' || request.url.startsWith('https://')
      
      // 设置访问令牌 cookie
      cookieStore.set(COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: isHttps, // 根据实际协议设置，支持 HTTP 内网部署
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60, // 1 小时
      })

      // 设置刷新令牌 cookie
      cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: isHttps, // 根据实际协议设置，支持 HTTP 内网部署
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 天
      })

      // 调试日志（仅在开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('[Login] Cookies set via cookies().set():', {
          accessTokenSet: !!accessToken,
          refreshTokenSet: !!refreshToken,
          accessTokenLength: accessToken.length,
          refreshTokenLength: refreshToken.length,
          secure: isHttps,
          protocol,
          sameSite: 'lax',
          path: '/',
        })
      }

      // 创建响应对象（cookie 已通过 cookies().set() 设置，会自动包含在响应中）
      const response = NextResponse.json(
        {
          success: true,
          data: {
            success: true,
            user: {
              id: user.id,
              email: user.email,
            },
          },
        },
        { status: 200 }
      )

      // 更新最后登录时间（异步，不阻塞响应）
      if ('updateLastLogin' in authDb && typeof authDb.updateLastLogin === 'function') {
        authDb.updateLastLogin(user.id).catch((err) => {
          console.error('Failed to update last login time:', err)
        })
      }

      // 记录登录日志（异步，不阻塞响应）
      logLogin({ id: user.id, email: user.email, role: (user as { role?: string }).role }).catch((err) => {
        console.error('Failed to log login:', err)
      })

      return response
    } catch (error) {
      // 数据库错误或其他内部错误
      console.error('Login error:', error)

      // 统一错误消息，不暴露内部错误
      return NextResponse.json(
        {
          error: {
            code: 'AUTH_ERROR',
            message: '邮箱或密码错误',
          },
        },
        {
          status: 401,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': (ipRateLimit.remaining - 1).toString(),
            'X-RateLimit-Reset': new Date(ipRateLimit.resetAt).toISOString(),
          },
        }
      )
    }
  } catch (error) {
    console.error('Login API error:', error)
    // 统一错误消息，不暴露内部错误
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '登录失败，请重试' } },
      { status: 500 }
    )
  }
}
