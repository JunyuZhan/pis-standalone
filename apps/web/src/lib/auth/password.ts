/**
 * @fileoverview PIS Web - 密码哈希工具
 *
 * @description
 * 提供基于 Node.js crypto 模块的密码哈希和验证功能。
 * 使用 PBKDF2 算法 (SHA-512, 100,000 迭代)。
 *
 * 注意：由于依赖 Node.js crypto 模块，此文件不能在 Edge Runtime 中使用。
 * 请勿在 Middleware 或 Edge API Routes 中导入此文件。
 *
 * @module lib/auth/password
 */
import crypto from 'crypto'

/**
 * 使用 PBKDF2 算法对密码进行哈希
 *
 * @description
 * 使用 Node.js 原生 crypto 模块实现，无需额外依赖。
 * 哈希格式：`salt:iterations:hash`
 * 
 * 注意：使用同步版本以避免 Next.js 15 的 worker thread 问题
 *
 * @param {string} password 明文密码
 * @returns {Promise<string>} 哈希后的密码字符串
 *
 * @example
 * ```typescript
 * import { hashPassword } from '@/lib/auth/password'
 * const hash = await hashPassword('myPassword123')
 * // 输出示例: "a1b2c3...:100000:d4e5f6..."
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString('hex')
  const iterations = 100000
  const keylen = 64
  const digest = 'sha512'

  // 使用同步版本避免 Next.js 15 worker thread 问题
  // 在 API Route 中使用同步版本是安全的，因为不会阻塞事件循环
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest)
  return `${salt}:${iterations}:${derivedKey.toString('hex')}`
}

/**
 * 验证密码是否匹配哈希值
 *
 * @param {string} password 待验证的明文密码
 * @param {string} hash 存储的密码哈希值（格式：salt:iterations:hash）
 * @returns {Promise<boolean>} 密码匹配返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * import { verifyPassword } from '@/lib/auth/password'
 * const isValid = await verifyPassword('password123', hash)
 * ```
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Prevent empty string or malformed hash
  if (!hash || hash.trim() === '' || !hash.includes(':')) {
    return false
  }

  const [salt, iterations, storedHash] = hash.split(':')

  // Validate format
  if (!salt || !iterations || !storedHash) {
    return false
  }

  const iterCount = parseInt(iterations, 10)
  if (isNaN(iterCount) || iterCount <= 0) {
    return false
  }

  const keylen = 64
  const digest = 'sha512'

  try {
    // 使用同步版本避免 Next.js 15 worker thread 问题
    const derivedKey = crypto.pbkdf2Sync(password, salt, iterCount, keylen, digest)
    return derivedKey.toString('hex') === storedHash
  } catch (err) {
    return false
  }
}
