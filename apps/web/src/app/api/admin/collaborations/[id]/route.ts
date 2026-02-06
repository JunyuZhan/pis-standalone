/**
 * 协作邀请响应 API
 * POST: 接受或拒绝邀请
 * DELETE: 退出协作
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'
import { z } from 'zod'
import { logUpdate } from '@/lib/audit-log'

interface RouteParams {
  params: Promise<{ id: string }>
}

const respondSchema = z.object({
  action: z.enum(['accept', 'reject']),
})

// 接受或拒绝邀请
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    const { id: collaborationId } = await params

    const body = await request.json()
    const validation = respondSchema.safeParse(body)
    
    if (!validation.success) {
      throw new ApiError('请求参数无效', 400)
    }

    const { action } = validation.data
    const db = createServerSupabaseClient()

    // 检查邀请是否存在且属于当前用户
    const { data: collaboration, error: collabError } = await db
      .from('album_collaborators')
      .select(`
        id,
        album_id,
        status,
        albums!inner(id, title)
      `)
      .eq('id', collaborationId)
      .eq('user_id', user.id)
      .single()

    if (collabError || !collaboration) {
      throw new ApiError('邀请不存在', 404)
    }

    if (collaboration.status !== 'pending') {
      throw new ApiError('邀请已处理', 400)
    }

    // 更新状态
    const newStatus = action === 'accept' ? 'accepted' : 'rejected'
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (action === 'accept') {
      updateData.accepted_at = new Date().toISOString()
    }

    const { error: updateError } = await db
      .from('album_collaborators')
      .update(updateData)
      .eq('id', collaborationId)

    if (updateError) {
      throw new ApiError(`处理邀请失败: ${updateError.message}`, 500)
    }

    const albumTitle = (collaboration.albums as { title: string })?.title || ''

    // 记录日志
    logUpdate(
      { id: user.id, email: user.email, role: user.role },
      'album',
      collaboration.album_id,
      `${action === 'accept' ? '接受' : '拒绝'}协作邀请: ${albumTitle}`
    )

    return NextResponse.json({
      success: true,
      message: action === 'accept' 
        ? `已接受协作邀请，您现在可以访问相册「${albumTitle}」`
        : '已拒绝协作邀请',
      status: newStatus,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// 退出协作（自己退出）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    const { id: collaborationId } = await params

    const db = createServerSupabaseClient()

    // 检查协作是否存在且属于当前用户
    const { data: collaboration, error: collabError } = await db
      .from('album_collaborators')
      .select(`
        id,
        album_id,
        status,
        albums!inner(id, title)
      `)
      .eq('id', collaborationId)
      .eq('user_id', user.id)
      .single()

    if (collabError || !collaboration) {
      throw new ApiError('协作不存在', 404)
    }

    if (collaboration.status !== 'accepted') {
      throw new ApiError('只能退出已接受的协作', 400)
    }

    // 更新状态为已移除
    const { error: updateError } = await db
      .from('album_collaborators')
      .update({
        status: 'removed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', collaborationId)

    if (updateError) {
      throw new ApiError(`退出协作失败: ${updateError.message}`, 500)
    }

    const albumTitle = (collaboration.albums as { title: string })?.title || ''

    // 记录日志
    logUpdate(
      { id: user.id, email: user.email, role: user.role },
      'album',
      collaboration.album_id,
      `退出协作: ${albumTitle}`
    )

    return NextResponse.json({
      success: true,
      message: `已退出相册「${albumTitle}」的协作`,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
