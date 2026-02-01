#!/usr/bin/env tsx
/**
 * 检查数据库中管理员账户状态
 * 
 * 用法: npx tsx scripts/check-admin-status.ts
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env')
dotenv.config({ path: envPath })

const ADMIN_EMAIL = 'admin@example.com'

async function checkAdminStatus() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'pis',
    user: process.env.DATABASE_USER || 'pis',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  })

  try {
    await client.connect()
    console.log('✅ 已连接到数据库\n')

    // 查询管理员账户
    const result = await client.query(
      'SELECT id, email, password_hash, role, is_active, created_at, updated_at, last_login_at FROM users WHERE email = $1',
      [ADMIN_EMAIL.toLowerCase()]
    )

    if (result.rows.length === 0) {
      console.log('❌ 管理员账户不存在')
      console.log(`   邮箱: ${ADMIN_EMAIL}`)
      console.log('\n💡 提示: 可以使用以下命令创建管理员账户:')
      console.log('   npx tsx scripts/utils/create-admin.ts')
      return
    }

    const admin = result.rows[0]
    console.log('✅ 管理员账户存在')
    console.log(`   ID: ${admin.id}`)
    console.log(`   邮箱: ${admin.email}`)
    console.log(`   角色: ${admin.role}`)
    console.log(`   状态: ${admin.is_active ? '激活' : '未激活'}`)
    console.log(`   创建时间: ${admin.created_at}`)
    console.log(`   更新时间: ${admin.updated_at}`)
    if (admin.last_login_at) {
      console.log(`   最后登录: ${admin.last_login_at}`)
    } else {
      console.log(`   最后登录: 从未登录`)
    }
    console.log()

    // 检查密码状态
    const passwordHash = admin.password_hash
    if (!passwordHash || passwordHash.trim() === '') {
      console.log('⚠️  密码状态: 未设置')
      console.log('   首次登录时需要设置密码')
    } else {
      // 验证密码哈希格式
      const parts = passwordHash.split(':')
      if (parts.length === 3) {
        const [salt, iterations, hash] = parts
        console.log('✅ 密码状态: 已设置')
        console.log(`   密码哈希格式: 正确 (PBKDF2)`)
        console.log(`   迭代次数: ${iterations}`)
        console.log(`   Salt 长度: ${salt.length} 字符`)
        console.log(`   Hash 长度: ${hash.length} 字符`)
        console.log(`   密码哈希预览: ${passwordHash.substring(0, 30)}...`)
      } else {
        console.log('⚠️  密码状态: 格式异常')
        console.log(`   密码哈希值: ${passwordHash.substring(0, 50)}...`)
        console.log('   提示: 密码哈希格式不正确，可能需要重新设置密码')
      }
    }

    console.log('\n📊 总结:')
    if (!passwordHash || passwordHash.trim() === '') {
      console.log('   - 管理员账户存在，但密码未设置')
      console.log('   - 首次登录时会显示密码设置表单')
    } else if (parts.length === 3) {
      console.log('   - 管理员账户存在，密码已设置')
      console.log('   - 登录时会显示登录表单')
    } else {
      console.log('   - 管理员账户存在，但密码格式异常')
      console.log('   - 建议重新设置密码')
    }
  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 提示: 请确保 PostgreSQL 服务正在运行')
      console.error('   如果使用 Docker: docker ps | grep postgres')
    } else if (error instanceof Error && error.message.includes('password authentication')) {
      console.error('\n💡 提示: 数据库认证失败，请检查 .env 文件中的数据库配置')
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

checkAdminStatus().catch((error) => {
  console.error('❌ 未预期的错误:', error)
  process.exit(1)
})
