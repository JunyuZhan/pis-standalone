/**
 * 用户协作邀请管理 API
 * GET: 获取当前用户收到的协作邀请
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ApiError, handleApiError, requireAuth } from '@/lib/api-utils'

// 获取当前用户收到的协作邀请
export async function GET() {
  try {
    const { user } = await requireAuth()
    const db = createServerSupabaseClient()

    // 获取待处理的邀请
    const { data: pending, error: pendingError } = await db
      .from('album_collaborators')
      .select(`
        id,
        role,
        can_upload,
        can_edit,
        can_delete,
        can_manage,
        can_invite,
        invited_at,
        albums!inner(id, title, slug, photo_count),
        inviter:users!album_collaborators_invited_by_fkey(id, email)
      `)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })

    if (pendingError) {
      throw new ApiError(`获取邀请失败: ${pendingError.message}`, 500)
    }

    // 获取已接受的协作（我参与的相册）
    const { data: accepted, error: acceptedError } = await db
      .from('album_collaborators')
      .select(`
        id,
        role,
        can_upload,
        can_edit,
        can_delete,
        can_manage,
        can_invite,
        accepted_at,
        albums!inner(id, title, slug, photo_count, is_public)
      `)
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false })

    if (acceptedError) {
      throw new ApiError(`获取协作相册失败: ${acceptedError.message}`, 500)
    }

    return NextResponse.json({
      pending: (pending || []).map(p => ({
        id: p.id,
        role: p.role,
        permissions: {
          canUpload: p.can_upload,
          canEdit: p.can_edit,
          canDelete: p.can_delete,
          canManage: p.can_manage,
          canInvite: p.can_invite,
        },
        invitedAt: p.invited_at,
        album: p.albums,
        invitedBy: p.inviter,
      })),
      collaborating: (accepted || []).map(a => ({
        id: a.id,
        role: a.role,
        permissions: {
          canUpload: a.can_upload,
          canEdit: a.can_edit,
          canDelete: a.can_delete,
          canManage: a.can_manage,
          canInvite: a.can_invite,
        },
        acceptedAt: a.accepted_at,
        album: a.albums,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
