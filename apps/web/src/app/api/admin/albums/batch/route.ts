import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { batchOperationSchema, batchUpdateSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 相册批量操作 API
 * DELETE /api/admin/albums/batch - 批量删除相册
 */

export async function DELETE(request: NextRequest) {
  try {
    const db = await createClient()

    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入（注意：batchOperationSchema 包含 operation，但这里只支持 delete）
    const validation = safeValidate(batchOperationSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { albumIds, operation } = validation.data

    // 验证操作类型
    if (operation !== 'delete') {
      return ApiError.badRequest(`不支持的操作类型: ${operation}`)
    }

    // 验证相册存在且未删除
    const albumsResult = await db
      .from('albums')
      .select('id, title')
      .in('id', albumIds)
      .is('deleted_at', null)

    if (albumsResult.error) {
      return handleError(albumsResult.error, '查询相册失败')
    }

    const validAlbums = albumsResult.data as { id: string; title: string }[] | null
    const validAlbumIds = validAlbums?.map((a) => a.id) || []

    if (validAlbumIds.length === 0) {
      return ApiError.notFound('未找到有效的相册')
    }

    // 执行软删除
    // 批量更新：为每个相册ID执行更新操作
    const deletePromises = validAlbumIds.map((id) => 
      db.update('albums', { deleted_at: new Date().toISOString() }, { id, deleted_at: null })
    )
    const deleteResults = await Promise.all(deletePromises)
    const deleteError = deleteResults.find((r) => r.error)?.error

    if (deleteError) {
      return handleError(deleteError, '批量删除相册失败')
    }

    return createSuccessResponse({
      success: true,
      deletedCount: validAlbumIds.length,
      message: `已删除 ${validAlbumIds.length} 个相册`,
    })
  } catch (error) {
    return handleError(error, '批量删除相册失败')
  }
}

// PATCH /api/admin/albums/batch - 批量更新相册
export async function PATCH(request: NextRequest) {
  try {
    const db = await createClient()

    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(batchUpdateSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { albumIds, updates } = validation.data

    // 构建更新数据（只允许更新特定字段）
    const updateData: Record<string, boolean | string> = {}
    
    if (updates.is_public !== undefined) updateData.is_public = updates.is_public
    if (updates.layout !== undefined) updateData.layout = updates.layout
    if (updates.sort_rule !== undefined) updateData.sort_rule = updates.sort_rule
    if (updates.allow_download !== undefined) updateData.allow_download = updates.allow_download
    if (updates.show_exif !== undefined) updateData.show_exif = updates.show_exif

    // 执行批量更新
    // 批量更新：为每个相册ID执行更新操作
    const updatePromises = albumIds.map((id) => 
      db.update('albums', updateData, { id, deleted_at: null })
    )
    const updateResults = await Promise.all(updatePromises)
    const updateError = updateResults.find((r) => r.error)?.error

    if (updateError) {
      return handleError(updateError, '批量更新相册失败')
    }

    return createSuccessResponse({
      success: true,
      updatedCount: albumIds.length,
      message: `已更新 ${albumIds.length} 个相册`,
    })
  } catch (error) {
    return handleError(error, '批量更新相册失败')
  }
}
