/**
 * 检查管理员账户状态 API
 * 
 * 用于检查管理员账户是否需要设置密码
 * 
 * @route GET /api/auth/check-admin-status
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/database'

/**
 * 验证密码哈希格式是否有效
 * PBKDF2 格式：salt:iterations:hash
 */
function isValidPasswordHash(hash: string | null | undefined): boolean {
  if (!hash || typeof hash !== 'string') {
    return false
  }
  
  const trimmed = hash.trim()
  if (trimmed === '') {
    return false
  }
  
  // 检查格式：必须包含两个冒号分隔符
  const parts = trimmed.split(':')
  if (parts.length !== 3) {
    return false
  }
  
  const [salt, iterations, hashValue] = parts
  
  // 验证各部分都不为空
  if (!salt || !iterations || !hashValue) {
    return false
  }
  
  // 验证 iterations 是有效的数字
  const iterCount = parseInt(iterations, 10)
  if (isNaN(iterCount) || iterCount <= 0) {
    return false
  }
  
  // 验证 salt 和 hash 都是有效的十六进制字符串
  const hexPattern = /^[0-9a-f]+$/i
  if (!hexPattern.test(salt) || !hexPattern.test(hashValue)) {
    return false
  }
  
  return true
}

export async function GET() {
  try {
    // 固定管理员邮箱为 admin@example.com（不允许自定义）
    const ADMIN_EMAIL = 'admin@example.com'
    
    // 直接查询数据库，确保能获取到 password_hash
    const db = await createAdminClient()
    const queryResult = await db
      .from('users')
      .select('id, email, password_hash')
      .eq('email', ADMIN_EMAIL.toLowerCase())
      .single()
    
    if (queryResult.error || !queryResult.data) {
      // 如果查询失败或账户不存在，返回需要设置密码
      return NextResponse.json({
        needsPasswordSetup: true,
        email: ADMIN_EMAIL,
      })
    }
    
    const adminUser = queryResult.data as { id: string; email: string; password_hash: string | null }
    
    // 检查是否需要设置密码
    // 不仅检查是否存在，还要验证格式是否正确
    const passwordHash = adminUser.password_hash
    const hasPassword = isValidPasswordHash(passwordHash)
    const needsPasswordSetup = !hasPassword
    
    return NextResponse.json({
      needsPasswordSetup,
      email: ADMIN_EMAIL,
    })
  } catch (error) {
    // 出错时默认返回需要设置密码（更安全）
    console.error('Error checking admin status:', error)
    return NextResponse.json({
      needsPasswordSetup: true,
      email: 'admin@example.com',
    })
  }
}
