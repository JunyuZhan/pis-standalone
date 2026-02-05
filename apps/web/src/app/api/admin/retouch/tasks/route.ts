import { NextRequest } from 'next/server'
import { createClient } from '@/lib/database'
import { requireRetoucherOrAdmin } from '@/lib/auth/role-helpers'
import { ApiError, handleError, createSuccessResponse } from '@/lib/validation/error-handler'

export async function GET(request: NextRequest) {
  try {
    // 检查用户角色：只允许管理员或修图师访问
    const user = await requireRetoucherOrAdmin(request)
    if (!user) {
      return ApiError.forbidden('需要管理员或修图师权限才能访问修图任务')
    }

    const db = await createClient()
    
    // 获取待修图的照片
    const { data: photos, error } = await db
      .from('photos')
      .select('id, filename, original_key, status, created_at, album_id')
      .in('status', ['pending_retouch', 'retouching'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Database error fetching retouch tasks:', error)
      return handleError(error, '查询待修图任务失败')
    }

    if (!photos || photos.length === 0) {
      return createSuccessResponse([])
    }

    // 获取相册信息
    const albumIds = [...new Set(photos.map((p) => (p as { album_id: string }).album_id))]
    const { data: albums, error: albumsError } = await db
      .from('albums')
      .select('id, title')
      .in('id', albumIds)

    if (albumsError) {
      console.error('Database error fetching albums:', albumsError)
      // 即使相册查询失败，也返回照片数据（不包含相册信息）
    }

    // 构建相册映射
    const albumsMap = new Map(
      (albums || []).map((album) => [(album as { id: string; title: string }).id, album as { id: string; title: string }])
    )

    // 合并照片和相册信息
    const tasks = photos.map((photo) => {
      const typedPhoto = photo as { id: string; filename: string; original_key: string; status: string; created_at: string; album_id: string }
      return {
        id: typedPhoto.id,
        filename: typedPhoto.filename,
        original_key: typedPhoto.original_key,
        status: typedPhoto.status,
        created_at: typedPhoto.created_at,
        albums: albumsMap.get(typedPhoto.album_id) || { id: typedPhoto.album_id, title: '未知相册' },
      }
    })

    return createSuccessResponse(tasks)
  } catch (error) {
    console.error('Error in GET /api/admin/retouch/tasks:', error)
    return handleError(error, '获取待修图任务失败')
  }
}
