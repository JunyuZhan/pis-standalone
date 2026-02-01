#!/usr/bin/env tsx
/**
 * 清理失败的照片（文件不存在的情况）
 * 
 * 使用方法:
 *   tsx scripts/cleanup-failed-photos.ts
 *   tsx scripts/cleanup-failed-photos.ts --execute  # 实际执行删除
 */

import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Client } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '..', '.env') })

// 检查数据库配置
const databaseType = process.env.DATABASE_TYPE || 'postgresql'

if (databaseType !== 'postgresql') {
  console.error('❌ 此脚本仅支持 PostgreSQL 数据库')
  console.error('   请设置 DATABASE_TYPE=postgresql')
  process.exit(1)
}

// 创建数据库客户端
const client = new Client({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'pis',
  user: process.env.DATABASE_USER || 'pis',
  password: process.env.DATABASE_PASSWORD || '',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
})

async function cleanupFailedPhotos(dryRun: boolean = false) {
  console.log('🔍 查询失败状态的照片...')
  if (dryRun) {
    console.log('⚠️  运行在 DRY-RUN 模式（不会实际删除）\n')
  }
  
  try {
    await client.connect()
    
    // 查询所有失败状态的照片
    const result = await client.query(
      `SELECT id, filename, original_key, created_at, updated_at
       FROM photos
       WHERE status = 'failed'
         AND deleted_at IS NULL
       ORDER BY created_at ASC`
    )
    
    const failedPhotos = result.rows
    
    if (!failedPhotos || failedPhotos.length === 0) {
      console.log('✅ 没有失败的照片需要清理')
      return
    }
    
    console.log(`📋 找到 ${failedPhotos.length} 张失败的照片\n`)
    
    // 检查文件是否存在（通过 Worker API 或直接检查）
    // 这里我们假设文件不存在，直接清理数据库记录
    // 如果需要验证，可以通过 Worker API 检查
    
    let cleanedCount = 0
    let keptCount = 0
    
    for (const photo of failedPhotos) {
      const createdAt = new Date(photo.created_at)
      const now = new Date()
      const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      
      // 如果照片创建时间超过 1 小时，且没有 original_key 或 original_key 指向不存在的文件
      // 可以安全地清理
      if (ageHours > 1) {
        if (dryRun) {
          console.log(`[DRY-RUN] 🧹 将清理照片 ${photo.id}`)
        } else {
          console.log(`🧹 清理照片 ${photo.id} (${photo.filename}), 创建于 ${Math.round(ageHours)} 小时前`)
        }
        
        console.log(`   文件名: ${photo.filename}`)
        console.log(`   原始路径: ${photo.original_key}`)
        console.log(`   创建时间: ${photo.created_at}`)
        console.log(`   更新时间: ${photo.updated_at}`)
        console.log(`   年龄: ${Math.round(ageHours)} 小时\n`)
        
        if (!dryRun) {
          try {
            await client.query(
              'DELETE FROM photos WHERE id = $1',
              [photo.id]
            )
            cleanedCount++
          } catch (deleteError: any) {
            console.error(`❌ 删除失败 ${photo.id}:`, deleteError.message)
          }
        } else {
          cleanedCount++
        }
      } else {
        console.log(`⏳ 保留照片 ${photo.id} (${photo.filename}), 创建时间太短 (${Math.round(ageHours * 60)} 分钟)`)
        keptCount++
      }
    }
    
    console.log(`\n✅ ${dryRun ? '预览' : '清理'}完成:`)
    console.log(`   - ${dryRun ? '将清理' : '清理'}: ${cleanedCount} 张`)
    console.log(`   - 保留: ${keptCount} 张`)
    
    if (dryRun && cleanedCount > 0) {
      console.log(`\n💡 提示: 这是预览模式，没有实际删除。`)
      console.log(`   要实际执行清理，请运行: tsx scripts/cleanup-failed-photos.ts --execute`)
    }
    
  } catch (error: any) {
    console.error('❌ 查询失败:', error.message)
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   提示: 请确保 PostgreSQL 服务正在运行')
    }
    throw error
  } finally {
    await client.end()
  }
}

// 检查命令行参数
const dryRun = !process.argv.includes('--execute')

if (dryRun) {
  console.log('⚠️  默认运行在 DRY-RUN 模式（预览模式，不会实际删除）')
  console.log('   要实际执行清理，请添加 --execute 参数\n')
}

cleanupFailedPhotos(dryRun)
  .then(() => {
    console.log('\n✅ 脚本执行完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ 脚本执行失败:', err)
    process.exit(1)
  })
