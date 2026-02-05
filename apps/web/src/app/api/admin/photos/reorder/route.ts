import { NextRequest } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { reorderPhotosSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 照片排序 API
 * 
 * @route PATCH /api/admin/photos/reorder
 * @description 批量更新照片的排序顺序
 * 
 * @auth 需要管理员登录
 * 
 * @body {Object} requestBody - 排序请求体
 * @body {string} requestBody.albumId - 相册ID（UUID格式，必填）
 * @body {Array<Object>} requestBody.orders - 照片排序数组（必填）
 * @body {string} requestBody.orders[].photoId - 照片ID（UUID格式）
 * @body {number} requestBody.orders[].sortOrder - 排序值（数字，越小越靠前）
 * 
 * @returns {Object} 200 - 排序更新成功
 * @returns {boolean} 200.data.success - 操作是否成功
 * @returns {number} 200.data.updatedCount - 更新的照片数量
 * 
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/photos/reorder', {
 *   method: 'PATCH',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     albumId: 'album-uuid',
 *     orders: [
 *       { photoId: 'photo-1', sortOrder: 1 },
 *       { photoId: 'photo-2', sortOrder: 2 }
 *     ]
 *   })
 * })
 * ```
 */
export async function PATCH(request: NextRequest) {
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
      return ApiError.badRequest('请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(reorderPhotosSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { albumId, orders } = validation.data

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 批量更新排序
    // 使用事务确保原子性
    const photoIds = orders.map((o) => o.photoId)

    // 先验证所有照片都属于该相册
    const photosResult = await db
      .from<{ id: string }>('photos')
      .select('id')
      .eq('album_id', albumId)
      .in('id', photoIds)

    if (photosResult.error) {
      return handleError(photosResult.error, '查询照片失败')
    }

    const validPhotoIds = new Set(photosResult.data?.map((p) => p.id) || [])
    const invalidIds = photoIds.filter((id) => !validPhotoIds.has(id))

    if (invalidIds.length > 0) {
      return ApiError.validation(`部分照片不属于该相册: ${invalidIds.slice(0, 5).join(', ')}...`)
    }

    // 执行批量更新
    // 构造批量更新数据
    const updateData = orders.map((item) => ({
      id: item.photoId,
      sort_order: item.sortOrder,
    }))

    // 使用 updateBatch 进行单次查询更新
    const { error: updateError } = await db.updateBatch('photos', updateData, 'id')

    if (updateError) {
      return handleError(updateError, '批量更新失败')
    }

    // 更新相册的 sort_rule 为 manual
    await db.update('albums', { sort_rule: 'manual' }, { id: albumId })

    return createSuccessResponse({
      success: true,
      updatedCount: orders.length,
      message: `已更新 ${orders.length} 张照片的排序`,
    })
  } catch (error) {
    return handleError(error, '更新照片排序失败')
  }
}
