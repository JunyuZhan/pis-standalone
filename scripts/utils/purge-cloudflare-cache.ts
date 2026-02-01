#!/usr/bin/env tsx
/**
 * Cloudflare CDN 缓存清除工具
 * 
 * 支持两种模式：
 * 1. 手动模式：清除指定的 URL
 *    tsx scripts/purge-cloudflare-cache.ts --urls <URL1> <URL2> ...
 * 
 * 2. 自动模式：清除已删除照片的缓存
 *    tsx scripts/purge-cloudflare-cache.ts --deleted-photos
 * 
 * 环境变量:
 *   - CLOUDFLARE_ZONE_ID: Cloudflare Zone ID (必需)
 *   - CLOUDFLARE_API_TOKEN: Cloudflare API Token (必需)
 *   - NEXT_PUBLIC_MEDIA_URL: 媒体服务器 URL (自动模式需要)
 *   - DATABASE_TYPE: 数据库类型 (postgresql 或 supabase，默认: postgresql)
 *   - DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD: PostgreSQL 配置
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: Supabase 配置（向后兼容）
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
config({ path: resolve(__dirname, '../.env') })

const zoneId = process.env.CLOUDFLARE_ZONE_ID
const apiToken = process.env.CLOUDFLARE_API_TOKEN
const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL
const databaseType = process.env.DATABASE_TYPE || 'postgresql'

interface PurgeCacheResult {
  success: boolean
  purgedUrls: string[]
  failedUrls: string[]
  error?: string
}

async function purgeCloudflareCache(urls: string[]): Promise<PurgeCacheResult> {
  if (!zoneId || !apiToken) {
    throw new Error('缺少 Cloudflare 配置：请设置 CLOUDFLARE_ZONE_ID 和 CLOUDFLARE_API_TOKEN')
  }

  const BATCH_SIZE = 30
  const batches: string[][] = []
  
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE))
  }

  const purgedUrls: string[] = []
  const failedUrls: string[] = []

  console.log(`准备清除 ${urls.length} 个 URL 的缓存（分 ${batches.length} 批）...\n`)

  for (const batch of batches) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: batch,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`❌ 批次清除失败:`, errorData)
        failedUrls.push(...batch)
      } else {
        const result = await response.json()
        if (result.success) {
          purgedUrls.push(...batch)
          console.log(`✅ 成功清除 ${batch.length} 个 URL`)
        } else {
          console.error(`❌ API 返回失败:`, result.errors)
          failedUrls.push(...batch)
        }
      }
    } catch (error) {
      console.error(`❌ 清除批次时出错:`, error)
      failedUrls.push(...batch)
    }

    // 避免速率限制
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return {
    success: failedUrls.length === 0,
    purgedUrls,
    failedUrls,
    ...(failedUrls.length > 0 && {
      error: `Failed to purge ${failedUrls.length} URLs`,
    }),
  }
}

function buildImageUrl(imageKey: string): string {
  if (!mediaUrl) {
    throw new Error('缺少 NEXT_PUBLIC_MEDIA_URL 配置')
  }
  const baseUrl = mediaUrl.replace(/\/$/, '')
  const key = imageKey.replace(/^\//, '')
  return `${baseUrl}/${key}`
}

async function purgeDeletedPhotos() {
  if (!mediaUrl) {
    throw new Error('缺少媒体服务器配置：请设置 NEXT_PUBLIC_MEDIA_URL')
  }

  // 动态导入数据库客户端
  let db: any
  if (databaseType === 'postgresql') {
    const { createAdminClient } = await import('../apps/web/src/lib/database')
    db = await createAdminClient()
  } else {
    // Supabase 模式（向后兼容）
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('缺少 Supabase 配置：请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
    }
    db = createClient(supabaseUrl, supabaseKey)
  }

  console.log('🔍 查询已删除的照片...')
  
  // 查询所有已删除但未永久删除的照片（deleted_at 不为空）
  let deletedPhotos: any[]
  
  if (databaseType === 'postgresql') {
    const result = await db.from('photos')
      .select('id, original_key, thumb_key, preview_key')
      .not('deleted_at', 'is', null)
      .limit(1000)
    
    if (result.error) {
      throw new Error(`查询已删除照片失败: ${result.error.message}`)
    }
    deletedPhotos = result.data || []
  } else {
    // Supabase 模式
    const result = await db
      .from('photos')
      .select('id, original_key, thumb_key, preview_key')
      .not('deleted_at', 'is', null)
      .limit(1000)
    
    if (result.error) {
      throw new Error(`查询已删除照片失败: ${result.error.message}`)
    }
    deletedPhotos = result.data || []
  }

  if (!deletedPhotos || deletedPhotos.length === 0) {
    console.log('✅ 没有找到已删除的照片')
    return
  }

  console.log(`📸 找到 ${deletedPhotos.length} 张已删除的照片`)
  console.log('🔄 开始清除 CDN 缓存...\n')

  // 构建所有图片 URL
  const urls: string[] = []
  for (const photo of deletedPhotos) {
    if (photo.original_key) urls.push(buildImageUrl(photo.original_key))
    if (photo.thumb_key) urls.push(buildImageUrl(photo.thumb_key))
    if (photo.preview_key) urls.push(buildImageUrl(photo.preview_key))
  }

  // 清除缓存
  const result = await purgeCloudflareCache(urls)

  console.log('\n📊 清除结果:')
  console.log(`  ✅ 成功: ${result.purgedUrls.length} 个 URL`)
  console.log(`  ❌ 失败: ${result.failedUrls.length} 个 URL`)

  if (result.failedUrls.length > 0) {
    console.log('\n❌ 失败的 URL:')
    result.failedUrls.slice(0, 10).forEach(url => {
      console.log(`  - ${url}`)
    })
    if (result.failedUrls.length > 10) {
      console.log(`  ... 还有 ${result.failedUrls.length - 10} 个失败的 URL`)
    }
  }

  if (result.success) {
    console.log('\n✅ 所有缓存清除完成！')
  } else {
    console.log('\n⚠️  部分缓存清除失败，请检查错误信息')
  }
}

async function purgeUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    console.error('❌ 错误: 请提供要清除的 URL')
    console.log('\n用法:')
    console.log('  tsx scripts/purge-cloudflare-cache.ts --urls <URL1> <URL2> ...')
    process.exit(1)
  }

  const result = await purgeCloudflareCache(urls)

  console.log('\n📊 清除结果:')
  console.log(`  ✅ 成功: ${result.purgedUrls.length} 个 URL`)
  console.log(`  ❌ 失败: ${result.failedUrls.length} 个 URL`)

  if (result.failedUrls.length > 0) {
    console.log('\n❌ 失败的 URL:')
    result.failedUrls.forEach(url => {
      console.log(`  - ${url}`)
    })
  }

  if (result.success) {
    console.log('\n✅ 所有缓存清除完成！')
    process.exit(0)
  } else {
    console.log('\n⚠️  部分缓存清除失败，请检查错误信息')
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Cloudflare CDN 缓存清除工具

用法:
  tsx scripts/purge-cloudflare-cache.ts [选项]

选项:
  --urls <URL1> <URL2> ...    手动清除指定的 URL
  --deleted-photos            自动清除已删除照片的缓存
  --help, -h                   显示帮助信息

环境变量:
  CLOUDFLARE_ZONE_ID          Cloudflare Zone ID (必需)
  CLOUDFLARE_API_TOKEN        Cloudflare API Token (必需)
  NEXT_PUBLIC_MEDIA_URL       媒体服务器 URL (自动模式需要)
  DATABASE_TYPE               数据库类型 (postgresql 或 supabase，默认: postgresql)
  DATABASE_HOST               PostgreSQL 主机 (PostgreSQL 模式需要)
  DATABASE_PORT               PostgreSQL 端口 (PostgreSQL 模式需要)
  DATABASE_NAME               数据库名称 (PostgreSQL 模式需要)
  DATABASE_USER               数据库用户 (PostgreSQL 模式需要)
  DATABASE_PASSWORD           数据库密码 (PostgreSQL 模式需要)
  SUPABASE_URL                Supabase URL (Supabase 模式需要，向后兼容)
  SUPABASE_SERVICE_ROLE_KEY   Supabase Service Role Key (Supabase 模式需要，向后兼容)

示例:
  # 清除指定 URL
  tsx scripts/purge-cloudflare-cache.ts --urls https://example.com/image1.jpg https://example.com/image2.jpg

  # 清除已删除照片的缓存
  tsx scripts/purge-cloudflare-cache.ts --deleted-photos
`)
    process.exit(0)
  }

  try {
    if (args.includes('--deleted-photos')) {
      await purgeDeletedPhotos()
    } else if (args.includes('--urls')) {
      const urlIndex = args.indexOf('--urls')
      const urls = args.slice(urlIndex + 1)
      await purgeUrls(urls)
    } else {
      console.error('❌ 错误: 请指定操作模式')
      console.log('使用 --help 查看帮助信息')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main().catch(console.error)
