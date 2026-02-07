/**
 * 数据备份导入 API
 * POST: 从 JSON 备份文件恢复数据
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'
import { logAudit } from '@/lib/audit-log'
import { z } from 'zod'

const importOptionsSchema = z.object({
  mode: z.enum(['merge', 'replace']).default('merge'),
  tables: z.array(z.string()).optional(),
  skipExisting: z.boolean().default(true),
})

// 备份数据验证 schema
const backupDataSchema = z.object({
  metadata: z.object({
    version: z.string(),
    exportedAt: z.string(),
    tables: z.array(z.string()),
  }),
  data: z.record(z.array(z.record(z.unknown()))),
})

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    // 只有管理员可以导入备份
    if (user.role !== 'admin') {
      throw new ApiError('无权执行数据恢复', 403)
    }

    // 解析请求
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const optionsStr = formData.get('options') as string | null

    if (!file) {
      throw new ApiError('请提供备份文件', 400)
    }

    // 解析选项
    let options: { mode: 'merge' | 'replace'; skipExisting: boolean; tables: string[] | undefined } = { 
      mode: 'merge', 
      skipExisting: true, 
      tables: undefined 
    }
    if (optionsStr) {
      try {
        const parsed = JSON.parse(optionsStr)
        const validated = importOptionsSchema.parse(parsed)
        options = { ...options, ...validated }
      } catch {
        throw new ApiError('无效的导入选项', 400)
      }
    }

    // 读取并解析备份文件
    let backupContent: string
    try {
      backupContent = await file.text()
    } catch {
      throw new ApiError('无法读取备份文件', 400)
    }

    let backupData: z.infer<typeof backupDataSchema>
    try {
      const parsed = JSON.parse(backupContent)
      backupData = backupDataSchema.parse(parsed)
    } catch {
      throw new ApiError('备份文件格式无效', 400)
    }

    const db = createServerSupabaseClient()
    const results: Record<string, { imported: number; skipped: number; errors: string[] }> = {}

    // 确定要导入的表
    const tablesToImport = options.tables || Object.keys(backupData.data)

    // 导入每个表的数据
    for (const table of tablesToImport) {
      const tableData = backupData.data[table]
      if (!tableData || tableData.length === 0) {
        results[table] = { imported: 0, skipped: 0, errors: [] }
        continue
      }

      results[table] = { imported: 0, skipped: 0, errors: [] }

      for (const record of tableData) {
        try {
          const recordId = record.id as string | undefined
          
          // 检查记录是否存在（如果有 id 字段）
          if (options.skipExisting && recordId) {
            const { data: existing } = await db
              .from(table)
              .select('id')
              .eq('id', recordId)
              .single()

            if (existing) {
              results[table].skipped++
              continue
            }
          }

          // 清理记录（移除可能导致问题的字段）
          const cleanRecord = { ...record } as Record<string, unknown>
          
          // 对于某些表，需要特殊处理
          if (table === 'albums' || table === 'photos' || table === 'customers') {
            // 保留 deleted_at 为 null 的状态
            if (cleanRecord.deleted_at === null) {
              delete cleanRecord.deleted_at
            }
          }

          // 插入或更新
          if (options.mode === 'replace' && recordId) {
            const { error } = await db.upsert(table, cleanRecord, 'id')

            if (error) {
              results[table].errors.push(`ID ${recordId}: ${error.message}`)
            } else {
              results[table].imported++
            }
          } else {
            const { error } = await db.insert(table, cleanRecord)

            if (error) {
              // 忽略重复键错误
              if (error.message.includes('duplicate') || error.message.includes('23505')) {
                results[table].skipped++
              } else {
                results[table].errors.push(`${error.message}`)
              }
            } else {
              results[table].imported++
            }
          }
        } catch (err) {
          results[table].errors.push(err instanceof Error ? err.message : 'Unknown error')
        }
      }
    }

    // 计算汇总
    const summary = {
      totalImported: Object.values(results).reduce((sum, r) => sum + r.imported, 0),
      totalSkipped: Object.values(results).reduce((sum, r) => sum + r.skipped, 0),
      totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors.length, 0),
    }

    // 记录日志
    logAudit(
      { id: user.id, email: user.email, role: user.role },
      {
        action: 'import',
        resourceType: 'system_settings',
        description: '导入系统数据备份',
        metadata: {
          mode: options.mode,
          tables: tablesToImport,
          summary,
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: `数据导入完成：${summary.totalImported} 条导入，${summary.totalSkipped} 条跳过，${summary.totalErrors} 条错误`,
      summary,
      details: results,
      backupInfo: {
        exportedAt: backupData.metadata.exportedAt,
        version: backupData.metadata.version,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
