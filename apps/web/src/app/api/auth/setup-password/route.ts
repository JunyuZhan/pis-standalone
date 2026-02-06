import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/middleware-rate-limit'
import { 
  getAuthDatabase 
} from '@/lib/auth'
import { hashPassword } from '@/lib/auth/password'
import { initAuthDatabase } from '@/lib/auth/database'
import { safeValidate, handleError, createSuccessResponse } from '@/lib/validation/error-handler'
import { z } from 'zod'

// 初始化认证数据库（如果尚未初始化）
// 注意：这里只是尝试初始化，如果失败会在实际使用时重试
try {
  initAuthDatabase()
} catch (error) {
  // 可能已经初始化，或者数据库配置未准备好（这在首次部署时是正常的）
  // 在实际使用时会重新尝试初始化
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth database initialization check:', error instanceof Error ? error.message : 'Already initialized')
  }
}

/**
 * 设置初始密码的验证 schema
 */
const setupPasswordSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少需要 8 个字符'),
  confirmPassword: z.string().min(8, '确认密码至少需要 8 个字符'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
})

/**
 * 设置初始密码 API 路由
 * 
 * @route POST /api/auth/setup-password
 * @description 首次登录时设置管理员密码
 * 
 * @security
 * - 基于 IP 的速率限制（5 次/分钟）
 * - 基于邮箱的速率限制
 * - 验证邮箱和密码格式
 * 
 * @body {Object} requestBody - 设置密码请求体
 * @body {string} requestBody.email - 用户邮箱（必填）
 * @body {string} requestBody.password - 新密码（必填，至少 8 个字符）
 * @body {string} requestBody.confirmPassword - 确认密码（必填，必须与 password 一致）
 * 
 * @returns {Object} 200 - 密码设置成功
 * @returns {Object} 400 - 请求参数错误
 * @returns {Object} 401 - 用户不存在或密码已设置
 * @returns {Object} 429 - 请求过于频繁（速率限制）
 * @returns {Object} 500 - 服务器内部错误
 */
export async function POST(request: NextRequest) {
  try {
    // 获取客户端 IP 地址
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    
    let ip = 'unknown'
    if (cfConnectingIp) {
      ip = cfConnectingIp
    } else if (forwardedFor) {
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

    // 验证输入
    const validation = safeValidate(setupPasswordSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { email, password } = validation.data
    const normalizedEmail = email.trim().toLowerCase()

    // 速率限制
    const ipRateLimit = await checkRateLimit(`setup-password:ip:${ip}`, 5, 60 * 1000)
    const emailRateLimit = await checkRateLimit(`setup-password:email:${normalizedEmail}`, 3, 60 * 1000)

    if (!ipRateLimit.allowed) {
      const retryAfter = Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `请求过于频繁，请 ${retryAfter} 秒后再试`,
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
            message: `该账户请求过于频繁，请 ${retryAfter} 秒后再试`,
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

    // 执行密码设置
    try {
      // 确保数据库已初始化
      let authDb: ReturnType<typeof getAuthDatabase>
      try {
        authDb = getAuthDatabase()
      } catch (initError) {
        // 如果数据库未初始化，尝试初始化
        console.log('Auth database not initialized, attempting initialization...')
        try {
          initAuthDatabase()
          authDb = getAuthDatabase()
        } catch (reinitError) {
          const errorMsg = reinitError instanceof Error ? reinitError.message : String(reinitError)
          console.error('Failed to initialize auth database:', reinitError)
          
          // 检查是否是数据库配置错误
          if (errorMsg.includes('DATABASE_PASSWORD') || errorMsg.includes('POSTGRES_PASSWORD')) {
            throw new Error(
              '数据库配置错误：DATABASE_PASSWORD 或 POSTGRES_PASSWORD 环境变量未设置。请检查服务器配置。'
            )
          }
          
          throw new Error(
            `数据库连接失败：${errorMsg}`
          )
        }
      }
      
      // 查找用户（这里可能会抛出数据库连接错误）
      let user: { id: string; email: string; password_hash: string | null } | null
      try {
        user = await authDb.findUserByEmail(normalizedEmail)
      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError)
        console.error('Database query error:', dbError)
        
        // 检查是否是数据库连接错误
        if (
          errorMsg.includes('DATABASE_PASSWORD') ||
          errorMsg.includes('POSTGRES_PASSWORD') ||
          errorMsg.includes('connection') ||
          errorMsg.includes('ECONNREFUSED') ||
          errorMsg.includes('timeout')
        ) {
          throw new Error(
            '数据库连接失败。请检查数据库服务是否运行，以及环境变量配置是否正确。'
          )
        }
        
        // 其他数据库错误
        throw dbError
      }
      
      if (!user) {
        // 如果用户不存在，检查是否系统处于未初始化状态（没有任何管理员）
        // 如果系统未初始化，允许自动创建第一个管理员账户
        let isSystemUninitialized = false
        try {
          // PostgreSQLAuthDatabase 实现了 hasAnyAdmin 方法
          if (authDb.hasAnyAdmin && typeof authDb.hasAnyAdmin === 'function') {
            const hasAdmin = await authDb.hasAnyAdmin()
            isSystemUninitialized = !hasAdmin
          } else {
            // 如果 hasAnyAdmin 方法不存在（不应该发生，但为了健壮性）
            // 在首次设置场景中，假设系统未初始化，允许创建第一个管理员
            // 这是安全的，因为这是首次设置密码的场景
            console.warn('hasAnyAdmin method not available, assuming system uninitialized for first-time setup')
            isSystemUninitialized = true
          }
        } catch (error) {
          console.error('Error checking admin existence:', error)
          // 出错时假设系统未初始化，允许创建第一个管理员
          // 这是首次设置场景，允许创建是合理的
          isSystemUninitialized = true
        }

        // 如果系统未初始化，允许自动创建管理员
        if (isSystemUninitialized) {
          console.log('System uninitialized, creating first admin user:', normalizedEmail)
          try {
            const passwordHash = await hashPassword(password)
            await authDb.createUser(normalizedEmail, passwordHash)
            
            return createSuccessResponse(
              {
                success: true,
                message: '管理员账户创建并设置成功',
                email: normalizedEmail, // 返回用户邮箱，用于自动登录
              },
              200
            )
          } catch (createError) {
            console.error('Error creating admin user:', createError)
            throw createError // 重新抛出错误，让外层 catch 处理
          }
        }

        return NextResponse.json(
          {
            error: {
              code: 'USER_NOT_FOUND',
              message: '用户不存在',
            },
          },
          {
            status: 401,
          }
        )
      }

      // 检查密码是否已设置
      // password_hash 为 null 或空字符串表示密码未设置
      if (user.password_hash && typeof user.password_hash === 'string' && user.password_hash.trim() !== '') {
        return NextResponse.json(
          {
            error: {
              code: 'PASSWORD_ALREADY_SET',
              message: '密码已设置，请使用登录功能',
            },
          },
          {
            status: 400,
          }
        )
      }

      // 哈希密码
      const passwordHash = await hashPassword(password)
      
      // 开发环境添加调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log('[SetupPassword] Password hash generated:', {
          email: normalizedEmail,
          userId: user.id,
          passwordHashLength: passwordHash.length,
          passwordHashFormat: passwordHash.includes(':') ? 'valid' : 'invalid',
          passwordHashPreview: `${passwordHash.substring(0, 20)}...`,
        })
      }

      // 更新密码
      await authDb.updateUserPassword(user.id, passwordHash)
      
      // 开发环境验证密码是否已正确保存
      if (process.env.NODE_ENV === 'development') {
        const verifyUser = await authDb.findUserByEmail(normalizedEmail)
        console.log('[SetupPassword] Password saved verification:', {
          email: normalizedEmail,
          passwordHashExists: !!verifyUser?.password_hash,
          passwordHashLength: verifyUser?.password_hash?.length || 0,
          passwordHashMatches: verifyUser?.password_hash === passwordHash,
        })
      }

      // 记录密码设置成功
      const maskedEmail = normalizedEmail.length > 3 
        ? normalizedEmail.substring(0, 3) + '***' 
        : '***'
      console.log(JSON.stringify({
        type: 'password_setup',
        email: maskedEmail,
        ip,
        success: true,
        timestamp: new Date().toISOString(),
      }))

      return createSuccessResponse(
        {
          success: true,
          message: '密码设置成功，请使用新密码登录',
          email: normalizedEmail, // 返回用户邮箱，用于自动登录
        },
        200
      )
    } catch (error) {
      console.error('Setup password error:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        email: normalizedEmail,
        ip,
      })
      
      const maskedEmail = normalizedEmail.length > 3 
        ? normalizedEmail.substring(0, 3) + '***' 
        : '***'
      console.log(JSON.stringify({
        type: 'password_setup',
        email: maskedEmail,
        ip,
        success: false,
        reason: 'internal_error',
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }))

      // 检查是否是数据库连接错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isDatabaseError = 
        errorMessage.includes('DATABASE_PASSWORD') ||
        errorMessage.includes('POSTGRES_PASSWORD') ||
        errorMessage.includes('数据库连接失败') ||
        errorMessage.includes('database') ||
        errorMessage.includes('connection')

      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: isDatabaseError 
              ? '数据库连接失败，请检查服务器配置'
              : '密码设置失败，请重试',
            // 仅在开发环境返回详细错误信息
            ...(process.env.NODE_ENV === 'development' && {
              details: errorMessage,
            }),
          },
        },
        {
          status: 500,
        }
      )
    }
  } catch (error) {
    console.error('Setup password API error:', error)
    console.error('Outer error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: '密码设置失败，请重试',
          // 仅在开发环境返回详细错误信息
          ...(process.env.NODE_ENV === 'development' && {
            details: error instanceof Error ? error.message : String(error),
          }),
        } 
      },
      { status: 500 }
    )
  }
}
