#!/usr/bin/env tsx
/**
 * 创建用户账户脚本
 * 
 * 使用方法:
 *   pnpm create-admin
 *   pnpm exec tsx scripts/utils/create-admin.ts
 *   tsx scripts/utils/create-admin.ts
 * 
 * 或指定邮箱、密码和角色（非交互式）:
 *   tsx scripts/utils/create-admin.ts admin@example.com your-password admin
 *   tsx scripts/utils/create-admin.ts photographer@example.com password123 photographer
 *   tsx scripts/utils/create-admin.ts retoucher@example.com password123 retoucher
 * 
 * 支持的角色:
 *   - admin (管理员，默认)
 *   - photographer (摄影师)
 *   - retoucher (修图师)
 *   - guest (访客)
 */

import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量（从项目根目录）
// 支持多种路径：项目根目录、scripts 目录
const rootEnvPath = join(__dirname, '../../.env')
const scriptsEnvPath = join(__dirname, '../.env')
if (require('fs').existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
} else if (require('fs').existsSync(scriptsEnvPath)) {
  dotenv.config({ path: scriptsEnvPath })
} else {
  // 尝试从当前工作目录加载
  dotenv.config()
}

// 简单的密码哈希函数（与 apps/web/src/lib/auth/index.ts 保持一致）
import { pbkdf2, randomBytes } from 'crypto'
import { promisify } from 'util'

const pbkdf2Async = promisify(pbkdf2)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex')
  const iterations = 100000
  const keylen = 64
  const digest = 'sha512'
  
  const derivedKey = await pbkdf2Async(password, salt, iterations, keylen, digest)
  return `${salt}:${iterations}:${derivedKey.toString('hex')}`
}

// 简单的数据库客户端（直接使用 pg）
async function createAdminUser(
  email: string, 
  passwordHash: string | null,
  role: 'admin' | 'photographer' | 'retoucher' | 'guest' = 'admin'
) {
  const { Client } = await import('pg')
  
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'pis',
    user: process.env.DATABASE_USER || 'pis',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  })
  
  await client.connect()
  
  try {
    // 检查用户是否已存在
    const checkResult = await client.query(
      'SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    )
    
    if (checkResult.rows.length > 0) {
      if (passwordHash) {
        console.log('⚠️  用户已存在，是否要更新密码？(y/n)')
        const answer = await prompt('')
        if (answer.toLowerCase() !== 'y') {
          console.log('❌ 已取消')
          return
        }
        
        // 更新密码
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
          [passwordHash, email.toLowerCase()]
        )
        
        const roleName = role === 'admin' ? '管理员' : role === 'photographer' ? '摄影师' : role === 'retoucher' ? '修图师' : '访客'
        console.log(`✅ ${roleName}密码已更新`)
        console.log(`   邮箱: ${email}`)
      } else {
        console.log('⚠️  用户已存在（密码未设置，首次登录时设置）')
        console.log(`   邮箱: ${email}`)
      }
      return
    }
    
    // 创建新用户
    // password_hash 可以为 NULL，表示首次登录需要设置密码
    const result = await client.query(
      `INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email`,
      [email.toLowerCase(), passwordHash, role, true]
    )
    
    if (result.rows.length === 0) {
      throw new Error('创建用户失败：未返回数据')
    }
    
    const roleName = role === 'admin' ? '管理员' : role === 'photographer' ? '摄影师' : role === 'retoucher' ? '修图师' : '访客'
    console.log(`✅ ${roleName}账户创建成功！`)
    console.log(`   邮箱: ${email}`)
    console.log(`   角色: ${role}`)
    console.log(`   ID: ${result.rows[0].id}`)
    console.log('')
    if (passwordHash) {
      console.log('📝 下一步:')
      console.log('   1. 访问登录页面: http://localhost:3000/admin/login')
      console.log('   2. 使用上述邮箱和密码登录')
    } else {
      console.log('📝 下一步:')
      console.log('   1. 访问登录页面: http://localhost:3000/admin/login')
      console.log('   2. 输入邮箱地址')
      console.log('   3. 系统会提示您设置初始密码')
    }
    
  } finally {
    await client.end()
  }
}

async function createAdmin() {
  // 从命令行参数或提示输入
  const email = process.argv[2] || await prompt('请输入用户邮箱: ')
  const password = process.argv[3] || await promptPassword('请输入密码（留空表示首次登录时设置）: ')
  const roleArg = process.argv[4] || await prompt('请输入角色 (admin/photographer/retoucher/guest，默认 admin): ')
  
  if (!email) {
    console.error('❌ 邮箱不能为空')
    process.exit(1)
  }
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.error('❌ 邮箱格式不正确')
    process.exit(1)
  }
  
  // 验证角色
  const validRoles: Array<'admin' | 'photographer' | 'retoucher' | 'guest'> = ['admin', 'photographer', 'retoucher', 'guest']
  const role = (roleArg && roleArg.trim() ? roleArg.trim().toLowerCase() : 'admin') as 'admin' | 'photographer' | 'retoucher' | 'guest'
  
  if (!validRoles.includes(role)) {
    console.error(`❌ 无效的角色: ${role}`)
    console.error(`   支持的角色: ${validRoles.join(', ')}`)
    process.exit(1)
  }
  
  // 如果提供了密码，验证密码长度
  if (password && password.length > 0 && password.length < 8) {
    console.error('❌ 密码至少需要 8 个字符')
    process.exit(1)
  }
  
  // 检查数据库配置
  if (!process.env.DATABASE_HOST && !process.env.DATABASE_URL) {
    console.error('❌ 未找到数据库配置')
    console.error('   请确保 .env 文件中包含 DATABASE_HOST 或 DATABASE_URL')
    process.exit(1)
  }
  
  try {
    // 哈希密码（如果提供了密码）
    let passwordHash: string | null = null
    if (password && password.length > 0) {
      console.log('🔐 正在哈希密码...')
      passwordHash = await hashPassword(password)
    } else {
      console.log('📝 将创建密码为空的用户账户（首次登录时设置）')
    }
    
    // 创建用户账户
    console.log(`👤 正在创建${role === 'admin' ? '管理员' : role === 'photographer' ? '摄影师' : role === 'retoucher' ? '修图师' : '访客'}账户...`)
    await createAdminUser(email, passwordHash, role)
    
  } catch (error) {
    console.error('❌ 发生错误:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('   提示: 请确保 PostgreSQL 服务正在运行')
    }
    process.exit(1)
  }
}

// 简单的输入提示（Node.js 环境）
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    
    readline.question(question, (answer: string) => {
      readline.close()
      resolve(answer.trim())
    })
  })
}

// 密码输入提示（隐藏输入）
function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    
    process.stdout.write(question)
    
    let password = ''
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    
    stdin.on('data', (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false)
        stdin.pause()
        process.stdout.write('\n')
        readline.close()
        resolve(password)
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit(0)
      } else if (char === '\u007f' || char === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        password += char
        process.stdout.write('*')
      }
    })
  })
}

// 运行脚本
if (require.main === module) {
  createAdmin().catch((error) => {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1)
  })
}
