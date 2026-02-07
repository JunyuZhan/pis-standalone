/**
 * 操作日志统计 API
 * GET: 获取操作日志统计数据
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'

interface ActionRow {
  action: string
}

interface ResourceRow {
  resource_type: string
}

interface UserRow {
  user_email: string | null
}

interface DateRow {
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    if (user.role !== 'admin') {
      throw new ApiError('无权访问操作日志', 403)
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    const db = createServerSupabaseClient()

    // 计算时间范围
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // 获取各类统计数据
    const [
      { data: totalCount },
      { data: actionStats },
      { data: resourceStats },
      { data: userStats },
      { data: recentLogs },
      { data: dailyStats },
    ] = await Promise.all([
      // 总数
      db
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDateStr),
      
      // 按操作类型统计
      db.rpc('audit_logs_action_stats', { start_date: startDateStr }),
      
      // 按资源类型统计
      db.rpc('audit_logs_resource_stats', { start_date: startDateStr }),
      
      // 按用户统计
      db.rpc('audit_logs_user_stats', { start_date: startDateStr }),
      
      // 最近活动
      db
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // 每日统计
      db.rpc('audit_logs_daily_stats', { start_date: startDateStr, num_days: days }),
    ])

    // 如果 RPC 函数不存在，使用备用查询
    let actionStatsResult = actionStats
    let resourceStatsResult = resourceStats
    let userStatsResult = userStats
    let dailyStatsResult = dailyStats

    if (!actionStats) {
      const { data } = await db
        .from('audit_logs')
        .select('action')
        .gte('created_at', startDateStr)
      
      const counts: Record<string, number> = {}
      const rows = (data || []) as ActionRow[]
      rows.forEach(row => {
        counts[row.action] = (counts[row.action] || 0) + 1
      })
      actionStatsResult = Object.entries(counts).map(([action, count]) => ({ action, count }))
    }

    if (!resourceStats) {
      const { data } = await db
        .from('audit_logs')
        .select('resource_type')
        .gte('created_at', startDateStr)
      
      const counts: Record<string, number> = {}
      const rows = (data || []) as ResourceRow[]
      rows.forEach(row => {
        counts[row.resource_type] = (counts[row.resource_type] || 0) + 1
      })
      resourceStatsResult = Object.entries(counts).map(([resource_type, count]) => ({ resource_type, count }))
    }

    if (!userStats) {
      const { data } = await db
        .from('audit_logs')
        .select('user_email')
        .gte('created_at', startDateStr)
        .not('user_email', 'is', null)
      
      const counts: Record<string, number> = {}
      const rows = (data || []) as UserRow[]
      rows.forEach(row => {
        if (row.user_email) {
          counts[row.user_email] = (counts[row.user_email] || 0) + 1
        }
      })
      userStatsResult = Object.entries(counts)
        .map(([user_email, count]) => ({ user_email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }

    if (!dailyStats) {
      const { data } = await db
        .from('audit_logs')
        .select('created_at')
        .gte('created_at', startDateStr)
      
      const counts: Record<string, number> = {}
      const rows = (data || []) as DateRow[]
      rows.forEach(row => {
        const date = new Date(row.created_at).toISOString().split('T')[0]
        counts[date] = (counts[date] || 0) + 1
      })
      dailyStatsResult = Object.entries(counts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    return NextResponse.json({
      period: { days, startDate: startDateStr },
      total: totalCount || 0,
      byAction: actionStatsResult || [],
      byResource: resourceStatsResult || [],
      byUser: userStatsResult || [],
      daily: dailyStatsResult || [],
      recentActivity: recentLogs || [],
    })
  } catch (error) {
    return handleApiError(error)
  }
}
