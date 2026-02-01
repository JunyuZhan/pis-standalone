import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/middleware-rate-limit'
import { 
  createSession, 
  getAuthDatabase 
} from '@/lib/auth'
import { verifyPassword } from '@/lib/auth/password'
import { initAuthDatabase } from '@/lib/auth/database'
import { loginSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse } from '@/lib/validation/error-handler'

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
    
    // 支持用户名登录：如果输入的是 "admin"，转换为 admin@example.com
    // 注意：这里只处理 "admin" 用户名，其他用户名需要是有效的邮箱格式
    if (email.toLowerCase() === 'admin') {
      email = 'admin@example.com'
    }

    // 如果配置了 Turnstile，验证 token
    const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY
    if (turnstileSecretKey) {
      if (!turnstileToken) {
        console.warn('Turnstile configured but no token provided')
        return handleError(new Error('请完成人机验证'), '请完成人机验证')
      }

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
          console.error('Turnstile verification failed:', verifyData)
          return NextResponse.json(
            { error: { code: 'CAPTCHA_FAILED', message: '人机验证失败，请重试' } },
            { status: 400 }
          )
        }
      } catch (error) {
        console.error('Turnstile verification error:', error)
        return NextResponse.json(
          { error: { code: 'CAPTCHA_ERROR', message: '验证服务暂时不可用，请稍后重试' } },
          { status: 503 }
        )
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
      const isValidPassword = await verifyPassword(password, user.password_hash)
      
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
      const session = await createSession({
        id: user.id,
        email: user.email,
      })

      // 更新最后登录时间（异步，不阻塞响应）
      if ('updateLastLogin' in authDb && typeof authDb.updateLastLogin === 'function') {
        authDb.updateLastLogin(user.id).catch((err) => {
          console.error('Failed to update last login time:', err)
        })
      }

      // 会话 cookies 已由 createSession 设置
      return createSuccessResponse(
        {
          success: true,
          user: {
            id: session.user.id,
            email: session.user.email,
          },
        },
        200
      )
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
