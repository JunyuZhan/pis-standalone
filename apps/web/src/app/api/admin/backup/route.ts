/**
 * 备份管理 API
 * GET: 获取备份相关信息和系统统计
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'

interface PhotoSize {
  file_size: number | null
}

// 可备份的表及其描述
const BACKUP_TABLES_INFO = {
  albums: { name: '相册', description: '相册基本信息' },
  photos: { name: '照片', description: '照片元数据' },
  photo_groups: { name: '照片分组', description: '照片分组信息' },
  customers: { name: '客户', description: '客户信息' },
  customer_albums: { name: '客户相册', description: '客户与相册关联' },
  system_settings: { name: '系统设置', description: '全局系统配置' },
  album_templates: { name: '相册模板', description: '相册模板配置' },
  style_templates: { name: '样式模板', description: '自定义样式模板' },
  custom_translations: { name: '自定义翻译', description: '多语言翻译' },
  audit_logs: { name: '操作日志', description: '系统操作记录' },
  permissions: { name: '权限定义', description: '系统权限' },
  role_permissions: { name: '角色权限', description: '角色权限配置' },
  user_permissions: { name: '用户权限', description: '用户特殊权限' },
  album_collaborators: { name: '相册协作者', description: '协作者关联' },
  collaboration_invites: { name: '协作邀请', description: '协作邀请记录' },
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    // 只有管理员可以查看备份信息
    if (user.role !== 'admin') {
      throw new ApiError('无权查看备份信息', 403)
    }

    const db = createServerSupabaseClient()
    
    // 获取各表的数据统计
    const tableStats: Record<string, { count: number; info: typeof BACKUP_TABLES_INFO[keyof typeof BACKUP_TABLES_INFO] }> = {}

    for (const [table, info] of Object.entries(BACKUP_TABLES_INFO)) {
      try {
        const { count, error } = await db
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (!error) {
          tableStats[table] = { count: count || 0, info }
        }
      } catch {
        // 表可能不存在，跳过
      }
    }

    // 获取最近的备份/导入操作记录
    const { data: recentBackupLogs } = await db
      .from('audit_logs')
      .select('*')
      .eq('resource_type', 'system_settings')
      .in('action', ['export', 'import'])
      .order('created_at', { ascending: false })
      .limit(10)

    // 获取存储使用情况（照片总数和占用空间）
    const { data: storageData } = await db
      .from('photos')
      .select('file_size')
      .is('deleted_at', null)

    const photos = (storageData || []) as PhotoSize[]
    const totalStorageBytes = photos.reduce((sum, p) => sum + (p.file_size || 0), 0)
    const totalPhotos = photos.length

    return NextResponse.json({
      tables: tableStats,
      storage: {
        totalPhotos,
        totalBytes: totalStorageBytes,
        formattedSize: formatBytes(totalStorageBytes),
      },
      recentOperations: recentBackupLogs || [],
      backupTables: Object.keys(BACKUP_TABLES_INFO),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
