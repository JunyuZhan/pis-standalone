import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// 类型宽松的 Supabase 客户端，避免类型推断问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>

/**
 * 服务端 Admin 客户端 (绕过 RLS)
 * 使用 Service Role Key，拥有完全权限
 * 
 * ⚠️ 向后兼容层：仅在混合部署模式（DATABASE_TYPE=supabase）下使用
 * 默认模式（DATABASE_TYPE=postgresql）使用 PostgreSQL Admin 客户端
 */
export function createAdminClient(): AnySupabaseClient {
  return createServerClient<Database>(
    process.env.SUPABASE_URL! || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    }
  )
}
