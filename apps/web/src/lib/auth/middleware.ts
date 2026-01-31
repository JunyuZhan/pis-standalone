/**
 * 自定义认证中间件
 * 
 * 用于完全自托管模式，不依赖 Supabase
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getUserFromRequest, updateSessionMiddleware } from './index'
import { initAuthDatabase } from './database'

// 初始化认证数据库（如果尚未初始化）
try {
  initAuthDatabase()
} catch {
  // 可能已经初始化，忽略错误
}

/**
 * 更新会话中间件
 * 刷新即将过期的令牌，并处理认证重定向
 */
export async function updateSession(request: NextRequest) {
  // 更新会话（刷新令牌）
  const response = await updateSessionMiddleware(request)

  // 检查用户认证状态
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
