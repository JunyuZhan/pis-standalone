import { NextResponse } from 'next/server'

/**
 * Auth Callback 路由
 * 
 * 注意：自定义认证系统不需要此回调路由
 * 此路由保留用于向后兼容，但不会执行任何操作
 * 如果未来需要 OAuth 或其他第三方认证，可以在这里实现
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get('next') ?? '/admin'

  // 自定义认证系统不需要 code 交换
  // 直接重定向到目标页面
  return NextResponse.redirect(`${origin}${next}`)
}
