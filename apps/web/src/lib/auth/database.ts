/**
 * PIS Web - 认证数据库实现（PostgreSQL）
 *
 * 实现 AuthDatabase 接口，使用 PostgreSQL/Supabase 客户端
 *
 * @author PIS Contributors
 * @license MIT
 *
 * @example
 * ```typescript
 * import { initAuthDatabase } from '@/lib/auth/database'
 *
 * // 初始化认证数据库（在应用启动时调用）
 * initAuthDatabase()
 * ```
 */
import { createAdminClient } from '@/lib/database'
import type { AuthDatabase } from './index'

/**
 * 扩展的认证数据库接口
 *
 * @description
 * 在 AuthDatabase 基础上添加了 updateLastLogin 方法
 */
export interface ExtendedAuthDatabase extends AuthDatabase {
  /**
   * 更新用户最后登录时间
   *
   * @param userId - 用户 ID
   */
  updateLastLogin(userId: string): Promise<void>
}

/**
 * PostgreSQL/Supabase 认证数据库实现
 *
 * @description
 * 使用 Supabase 客户端与 PostgreSQL 数据库交互
 *
 * @implements {ExtendedAuthDatabase}
 *
 * @example
 * ```typescript
 * const db = new PostgreSQLAuthDatabase()
 * const user = await db.findUserByEmail('user@example.com')
 * ```
 */
export class PostgreSQLAuthDatabase implements ExtendedAuthDatabase {
  /**
   * 根据邮箱查找用户
   *
   * @param email - 用户邮箱（会自动转为小写）
   * @returns 用户对象，不存在返回 null
   *
   * @example
   * ```typescript
   * const user = await db.findUserByEmail('user@example.com')
   * if (user) {
   *   console.log('用户 ID:', user.id)
   * }
   * ```
   */
  async findUserByEmail(
    email: string
  ): Promise<{ id: string; email: string; password_hash: string | null } | null> {
    const db = await createAdminClient()
    // 明确指定要查询的字段，确保 password_hash 被包含
    const { data, error } = await db
      .from<{ id: string; email: string; password_hash: string | null }>('users')
      .select('id, email, password_hash')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      email: data.email,
      password_hash: data.password_hash, // 保持 null，用于首次登录设置密码
    }
  }

  /**
   * 创建新用户
   *
   * @param email - 用户邮箱
   * @param passwordHash - 密码哈希值
   * @returns 创建的用户对象
   * @throws {Error} 创建失败时抛出错误
   *
   * @example
   * ```typescript
   * const hash = await hashPassword('password123')
   * const user = await db.createUser('new@example.com', hash)
   * ```
   */
  async createUser(
    email: string,
    passwordHash: string
  ): Promise<{ id: string; email: string }> {
    const db = await createAdminClient()
    const { data, error } = await db.insert<
      { id: string; email: string; password_hash: string; role: string; is_active: boolean }
    >(
      'users',
      {
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
      } as unknown as { id: string; email: string; password_hash: string; role: string; is_active: boolean }
    )

    if (error || !data || data.length === 0) {
      throw new Error(error?.message || 'Failed to create user')
    }

    return {
      id: data[0].id,
      email: data[0].email,
    }
  }

  /**
   * 更新用户密码
   *
   * @param userId - 用户 ID
   * @param passwordHash - 新的密码哈希值
   * @throws {Error} 更新失败时抛出错误
   */
  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const db = await createAdminClient()
    const { error } = await db.update('users', { password_hash: passwordHash }, { id: userId })

    if (error) {
      throw new Error(error.message || 'Failed to update password')
    }
  }

  /**
   * 更新用户最后登录时间
   *
   * @description
   * 更新失败不会抛出错误，仅记录到控制台。
   * 这是因为登录时间更新失败不应阻止用户登录。
   *
   * @param userId - 用户 ID
   */
  async updateLastLogin(userId: string): Promise<void> {
    const db = await createAdminClient()
    const { error } = await db.update('users', { last_login_at: new Date().toISOString() }, { id: userId })

    if (error) {
      // 记录错误但不抛出（登录时间更新失败不应阻止登录）
      console.error('Failed to update last login time:', error)
    }
  }
}

/**
 * 初始化认证数据库
 *
 * @description
 * 创建数据库实例并注册到认证系统。
 * 使用动态导入避免循环依赖。
 *
 * @example
 * ```typescript
 * // 在 app/api/auth/login/route.ts 中调用
 * import { initAuthDatabase } from '@/lib/auth/database'
 *
 * try {
 *   initAuthDatabase()
 * } catch {
 *   // 可能已经初始化，忽略错误
 * }
 * ```
 */
export function initAuthDatabase(): void {
  // 使用动态导入避免循环依赖
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { setAuthDatabase } = require('./index')
  const db = new PostgreSQLAuthDatabase()
  setAuthDatabase(db)
}
