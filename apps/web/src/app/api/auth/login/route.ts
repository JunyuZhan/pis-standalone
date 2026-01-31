import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/middleware-rate-limit'
import { 
  verifyPassword, 
  createSession, 
  getAuthDatabase 
} from '@/lib/auth'
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
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求格式错误')
    }

    // 验证输入（不包括 turnstileToken，单独处理）
    const validation = safeValidate(loginSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { email, password } = validation.data
    const turnstileToken = (body as { turnstileToken?: string }).turnstileToken

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
          console.log(JSON.stringify({
            type: 'turnstile_verification',
            success: false,
            ip,
            reason: verifyData['error-codes'] || 'unknown',
            timestamp: new Date().toISOString(),
          }))
          return NextResponse.json(
            { error: { code: 'CAPTCHA_FAILED', message: '人机验证失败，请重试' } },
            { status: 400 }
          )
        }

        // 记录成功的验证
        console.log(JSON.stringify({
          type: 'turnstile_verification',
          success: true,
          ip,
          timestamp: new Date().toISOString(),
        }))
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
        const maskedEmail = normalizedEmail.length > 3 
          ? normalizedEmail.substring(0, 3) + '***' 
          : '***'
        console.log(JSON.stringify({
          type: 'login_attempt',
          email: maskedEmail,
          ip,
          success: false,
          reason: 'user_not_found',
          timestamp: new Date().toISOString(),
        }))

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

      // 验证密码
      const isValidPassword = await verifyPassword(password, user.password_hash)
      
      if (!isValidPassword) {
        // 密码错误，返回统一错误消息
        const maskedEmail = normalizedEmail.length > 3 
          ? normalizedEmail.substring(0, 3) + '***' 
          : '***'
        console.log(JSON.stringify({
          type: 'login_attempt',
          email: maskedEmail,
          ip,
          success: false,
          reason: 'invalid_password',
          timestamp: new Date().toISOString(),
        }))

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

      // 记录成功的登录尝试（用于安全审计）
      const maskedEmail = normalizedEmail.length > 3 
        ? normalizedEmail.substring(0, 3) + '***' 
        : '***'
      console.log(JSON.stringify({
        type: 'login_attempt',
        email: maskedEmail,
        ip,
        success: true,
        timestamp: new Date().toISOString(),
      }))

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
      
      const maskedEmail = normalizedEmail.length > 3 
        ? normalizedEmail.substring(0, 3) + '***' 
        : '***'
      console.log(JSON.stringify({
        type: 'login_attempt',
        email: maskedEmail,
        ip,
        success: false,
        reason: 'internal_error',
        timestamp: new Date().toISOString(),
      }))

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
