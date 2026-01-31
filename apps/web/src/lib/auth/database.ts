/**
 * 认证数据库实现（PostgreSQL）
 * 
 * 实现 AuthDatabase 接口，使用 PostgreSQL 客户端
 */
import { createAdminClient } from '@/lib/database'
import type { AuthDatabase } from './index'

/**
 * 扩展的认证数据库接口（包含额外方法）
 */
export interface ExtendedAuthDatabase extends AuthDatabase {
  updateLastLogin(userId: string): Promise<void>
}

/**
 * PostgreSQL 认证数据库实现
 */
export class PostgreSQLAuthDatabase implements ExtendedAuthDatabase {
  /**
   * 根据邮箱查找用户
   */
  async findUserByEmail(email: string): Promise<{ id: string; email: string; password_hash: string } | null> {
    const db = await createAdminClient()
    const { data, error } = await db.from('users').eq('email', email.toLowerCase()).single()
    
    if (error || !data) {
      return null
    }
    
    return {
      id: data.id,
      email: data.email,
      password_hash: data.password_hash,
    }
  }

  /**
   * 创建用户
   */
  async createUser(email: string, passwordHash: string): Promise<{ id: string; email: string }> {
    const db = await createAdminClient()
    const { data, error } = await db.insert('users', {
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role: 'admin',
      is_active: true,
    })
    
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
 */
export function initAuthDatabase(): void {
  // 使用动态导入避免循环依赖
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { setAuthDatabase } = require('./index')
  const db = new PostgreSQLAuthDatabase()
  setAuthDatabase(db)
}
