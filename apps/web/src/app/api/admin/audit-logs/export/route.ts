/**
 * 操作日志导出 API
 * GET: 导出操作日志为 JSON 或 CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'

interface AuditLog {
  created_at: string
  user_email: string | null
  user_role: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  description: string | null
  status: string
  ip_address: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    if (user.role !== 'admin') {
      throw new ApiError('无权导出操作日志', 403)
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const action = searchParams.get('action')
    const resourceType = searchParams.get('resourceType')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10000'), 10000)

    const db = createServerSupabaseClient()

    // 构建查询
    let query = db
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (action) {
      query = query.eq('action', action)
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    const { data: logsData, error } = await query
    const logs = (logsData || []) as AuditLog[]

    if (error) {
      throw new ApiError(`导出失败: ${error.message}`, 500)
    }

    if (format === 'csv') {
      // 导出为 CSV
      const headers = [
        '时间',
        '操作者',
        '角色',
        '操作类型',
        '资源类型',
        '资源ID',
        '资源名称',
        '描述',
        '状态',
        'IP地址',
      ]
      
      const rows = logs.map(log => [
        new Date(log.created_at).toLocaleString('zh-CN'),
        log.user_email || '',
        log.user_role || '',
        log.action,
        log.resource_type,
        log.resource_id || '',
        log.resource_name || '',
        log.description || '',
        log.status,
        log.ip_address || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      const timestamp = new Date().toISOString().split('T')[0]
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.csv"`,
        },
      })
    }

    // 默认导出为 JSON
    const timestamp = new Date().toISOString().split('T')[0]
    const exportData = {
      exportedAt: new Date().toISOString(),
      filters: { startDate, endDate, action, resourceType },
      total: logs?.length || 0,
      logs: logs || [],
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.json"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
