/**
 * 单个协作者管理 API
 * PATCH: 更新协作者权限
 * DELETE: 移除协作者
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'
import { z } from 'zod'
import { logUpdate, logDelete } from '@/lib/audit-log'

interface RouteParams {
  params: Promise<{ id: string; collaboratorId: string }>
}

const updateCollaboratorSchema = z.object({
  role: z.enum(['editor', 'viewer']).optional(),
  canUpload: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canManage: z.boolean().optional(),
  canInvite: z.boolean().optional(),
})

// 更新协作者权限
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    const { id: albumId, collaboratorId } = await params

    const body = await request.json()
    const validation = updateCollaboratorSchema.safeParse(body)
    
    if (!validation.success) {
      throw new ApiError('请求参数无效', 400)
    }

    const db = createServerSupabaseClient()

    // 检查相册是否存在
    const { data: album, error: albumError } = await db
      .from('albums')
      .select('id, title, owner_id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      throw new ApiError('相册不存在', 404)
    }

    // 检查权限
    const isOwner = album.owner_id === user.id
    const isAdmin = user.role === 'admin'
    
    if (!isOwner && !isAdmin) {
      const { data: collab } = await db
        .from('album_collaborators')
        .select('can_manage')
        .eq('album_id', albumId)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .single()

      if (!collab?.can_manage) {
        throw new ApiError('无权修改协作者权限', 403)
      }
    }

    // 检查协作者是否存在
    const { data: existing, error: existingError } = await db
      .from('album_collaborators')
      .select('id, user_id, users!album_collaborators_user_id_fkey(email)')
      .eq('id', collaboratorId)
      .eq('album_id', albumId)
      .single()

    if (existingError || !existing) {
      throw new ApiError('协作者不存在', 404)
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const { role, canUpload, canEdit, canDelete, canManage, canInvite } = validation.data

    if (role !== undefined) updateData.role = role
    if (canUpload !== undefined) updateData.can_upload = canUpload
    if (canEdit !== undefined) updateData.can_edit = canEdit
    if (canDelete !== undefined) updateData.can_delete = canDelete
    if (canManage !== undefined) updateData.can_manage = canManage
    if (canInvite !== undefined) updateData.can_invite = canInvite

    // 更新协作者
    const { data: updated, error: updateError } = await db
      .from('album_collaborators')
      .update(updateData)
      .eq('id', collaboratorId)
      .select()
      .single()

    if (updateError) {
      throw new ApiError(`更新协作者失败: ${updateError.message}`, 500)
    }

    const collaboratorEmail = (existing.users as { email: string })?.email || ''

    // 记录日志
    logUpdate(
      { id: user.id, email: user.email, role: user.role },
      'album',
      albumId,
      `更新协作者 ${collaboratorEmail} 权限`,
      { after: validation.data }
    )

    return NextResponse.json({
      success: true,
      message: '协作者权限已更新',
      collaborator: updated,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// 移除协作者
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    const { id: albumId, collaboratorId } = await params

    const db = createServerSupabaseClient()

    // 检查相册是否存在
    const { data: album, error: albumError } = await db
      .from('albums')
      .select('id, title, owner_id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumError || !album) {
      throw new ApiError('相册不存在', 404)
    }

    // 检查权限
    const isOwner = album.owner_id === user.id
    const isAdmin = user.role === 'admin'
    
    if (!isOwner && !isAdmin) {
      const { data: collab } = await db
        .from('album_collaborators')
        .select('can_manage')
        .eq('album_id', albumId)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .single()

      if (!collab?.can_manage) {
        throw new ApiError('无权移除协作者', 403)
      }
    }

    // 检查协作者是否存在
    const { data: existing, error: existingError } = await db
      .from('album_collaborators')
      .select('id, user_id, users!album_collaborators_user_id_fkey(email)')
      .eq('id', collaboratorId)
      .eq('album_id', albumId)
      .single()

    if (existingError || !existing) {
      throw new ApiError('协作者不存在', 404)
    }

    // 不能移除自己（如果是协作者）
    if (existing.user_id === user.id && !isOwner && !isAdmin) {
      throw new ApiError('不能移除自己', 400)
    }

    // 更新状态为已移除（软删除）
    const { error: deleteError } = await db
      .from('album_collaborators')
      .update({ 
        status: 'removed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', collaboratorId)

    if (deleteError) {
      throw new ApiError(`移除协作者失败: ${deleteError.message}`, 500)
    }

    const collaboratorEmail = (existing.users as { email: string })?.email || ''

    // 记录日志
    logDelete(
      { id: user.id, email: user.email, role: user.role },
      'album',
      albumId,
      `移除协作者 ${collaboratorEmail}`
    )

    return NextResponse.json({
      success: true,
      message: `已移除协作者 ${collaboratorEmail}`,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
