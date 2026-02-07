/**
 * 操作日志 API
 * GET: 获取操作日志列表（支持筛选、搜索、分页）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    
    // 只有管理员可以查看操作日志
    if (user.role !== 'admin') {
      throw new ApiError('无权访问操作日志', 403)
    }

    const { searchParams } = new URL(request.url)
    
    // 分页参数
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const offset = (page - 1) * pageSize
    
    // 筛选参数
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const resourceType = searchParams.get('resourceType')
    const resourceId = searchParams.get('resourceId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')

    const db = createServerSupabaseClient()

    // 构建查询
    let query = db
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // 应用筛选条件
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (action) {
      query = query.eq('action', action)
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }
    if (resourceId) {
      query = query.eq('resource_id', resourceId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (search) {
      // 简化搜索：只搜索描述字段
      // TODO: 实现多字段 OR 搜索需要扩展 PostgreSQL 客户端
      query = query.ilike('description', `%${search}%`)
    }

    // 分页
    query = query.range(offset, offset + pageSize - 1)

    const { data: logs, error, count } = await query

    if (error) {
      throw new ApiError(`获取操作日志失败: ${error.message}`, 500)
    }

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
