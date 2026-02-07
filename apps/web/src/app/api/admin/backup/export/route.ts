/**
 * 数据备份导出 API
 * GET: 导出系统数据为 JSON 格式
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'
import { logAudit } from '@/lib/audit-log'

// 需要备份的表
const BACKUP_TABLES = [
  'albums',
  'photos',
  'photo_groups',
  'customers',
  'customer_albums',
  'system_settings',
  'album_templates',
  'style_templates',
  'custom_translations',
] as const

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    // 只有管理员可以导出备份
    if (user.role !== 'admin') {
      throw new ApiError('无权执行数据备份', 403)
    }

    const { searchParams } = new URL(request.url)
    const tables = searchParams.get('tables')?.split(',') || [...BACKUP_TABLES]
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    const db = createServerSupabaseClient()
    const backupData: Record<string, unknown[]> = {}
    const errors: string[] = []

    // 导出每个表的数据
    for (const table of tables) {
      try {
        let query = db.from(table).select('*')
        
        // 对于有 deleted_at 字段的表，默认排除已删除数据
        if (!includeDeleted && ['albums', 'photos', 'customers'].includes(table)) {
          query = query.is('deleted_at', null)
        }

        const { data, error } = await query

        if (error) {
          errors.push(`${table}: ${error.message}`)
          continue
        }

        backupData[table] = data || []
      } catch (err) {
        errors.push(`${table}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    // 获取备份元数据
    const metadata = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      tables: Object.keys(backupData),
      counts: Object.fromEntries(
        Object.entries(backupData).map(([table, data]) => [table, data.length])
      ),
      includeDeleted,
      errors: errors.length > 0 ? errors : undefined,
    }

    const exportData = {
      metadata,
      data: backupData,
    }

    // 记录日志
    logAudit(
      { id: user.id, email: user.email, role: user.role },
      {
        action: 'export',
        resourceType: 'system_settings',
        description: '导出系统数据备份',
        metadata: { tables: metadata.tables, counts: metadata.counts },
      }
    )

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `pis-backup-${timestamp}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
