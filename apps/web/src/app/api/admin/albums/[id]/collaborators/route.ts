/**
 * 相册协作者管理 API
 * GET: 获取相册协作者列表
 * POST: 添加协作者
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'
import { z } from 'zod'
import { logCreate, logDelete } from '@/lib/audit-log'

interface RouteParams {
  params: Promise<{ id: string }>
}

const addCollaboratorSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['editor', 'viewer']).default('editor'),
  canUpload: z.boolean().default(true),
  canEdit: z.boolean().default(true),
  canDelete: z.boolean().default(false),
  canManage: z.boolean().default(false),
  canInvite: z.boolean().default(false),
})

// 获取相册协作者列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    const { id: albumId } = await params

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

    // 检查权限：只有管理员或相册所有者可以查看协作者
    const isOwner = album.owner_id === user.id
    const isAdmin = user.role === 'admin'
    
    if (!isOwner && !isAdmin) {
      // 检查是否是协作者且有管理权限
      const { data: collab } = await db
        .from('album_collaborators')
        .select('can_manage')
        .eq('album_id', albumId)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .single()

      if (!collab?.can_manage) {
        throw new ApiError('无权查看协作者', 403)
      }
    }

    // 获取协作者列表
    const { data: collaborators, error } = await db
      .from('album_collaborators')
      .select(`
        id,
        role,
        can_upload,
        can_edit,
        can_delete,
        can_manage,
        can_invite,
        status,
        invited_at,
        accepted_at,
        users!album_collaborators_user_id_fkey(id, email, role),
        inviter:users!album_collaborators_invited_by_fkey(id, email)
      `)
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new ApiError(`获取协作者失败: ${error.message}`, 500)
    }

    return NextResponse.json({
      albumId,
      albumTitle: album.title,
      ownerId: album.owner_id,
      collaborators: (collaborators || []).map(c => ({
        id: c.id,
        role: c.role,
        permissions: {
          canUpload: c.can_upload,
          canEdit: c.can_edit,
          canDelete: c.can_delete,
          canManage: c.can_manage,
          canInvite: c.can_invite,
        },
        status: c.status,
        invitedAt: c.invited_at,
        acceptedAt: c.accepted_at,
        user: c.users,
        invitedBy: c.inviter,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// 添加协作者
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth()
    const { id: albumId } = await params

    const body = await request.json()
    const validation = addCollaboratorSchema.safeParse(body)
    
    if (!validation.success) {
      throw new ApiError('请求参数无效', 400)
    }

    const { userId, role, canUpload, canEdit, canDelete, canManage, canInvite } = validation.data
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
        .select('can_invite')
        .eq('album_id', albumId)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .single()

      if (!collab?.can_invite) {
        throw new ApiError('无权添加协作者', 403)
      }
    }

    // 检查目标用户是否存在
    const { data: targetUser, error: userError } = await db
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      throw new ApiError('用户不存在', 404)
    }

    // 不能添加自己
    if (userId === user.id) {
      throw new ApiError('不能添加自己为协作者', 400)
    }

    // 不能添加相册所有者
    if (userId === album.owner_id) {
      throw new ApiError('不能添加相册所有者为协作者', 400)
    }

    // 检查是否已经是协作者
    const { data: existing } = await db
      .from('album_collaborators')
      .select('id, status')
      .eq('album_id', albumId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      if (existing.status === 'accepted') {
        throw new ApiError('该用户已经是协作者', 409)
      } else if (existing.status === 'pending') {
        throw new ApiError('已经向该用户发送过邀请', 409)
      }
    }

    // 添加协作者（或更新已移除的记录）
    const collaboratorData = {
      album_id: albumId,
      user_id: userId,
      role,
      can_upload: canUpload,
      can_edit: canEdit,
      can_delete: canDelete,
      can_manage: canManage,
      can_invite: canInvite,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    const { data: collaborator, error: insertError } = await db
      .from('album_collaborators')
      .upsert(collaboratorData, { onConflict: 'album_id,user_id' })
      .select()
      .single()

    if (insertError) {
      throw new ApiError(`添加协作者失败: ${insertError.message}`, 500)
    }

    // 记录日志
    logCreate(
      { id: user.id, email: user.email, role: user.role },
      'album',
      albumId,
      `添加协作者 ${targetUser.email} 到相册 ${album.title}`
    )

    return NextResponse.json({
      success: true,
      message: `已邀请 ${targetUser.email} 成为协作者`,
      collaborator: {
        id: collaborator.id,
        userId,
        email: targetUser.email,
        role,
        status: 'pending',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
