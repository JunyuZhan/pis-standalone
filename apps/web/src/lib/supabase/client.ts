import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * 创建 Supabase 浏览器客户端
 * 
 * ⚠️ 向后兼容层：仅在混合部署模式（DATABASE_TYPE=supabase）下使用
 * 默认模式（DATABASE_TYPE=postgresql）使用自定义认证系统
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
