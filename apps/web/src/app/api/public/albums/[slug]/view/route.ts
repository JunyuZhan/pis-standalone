import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { albumSlugSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * 增加相册浏览次数
 * POST /api/public/albums/[slug]/view
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const slugValidation = safeValidate(albumSlugSchema, paramsData)
    if (!slugValidation.success) {
      return handleError(slugValidation.error, '无效的相册slug')
    }
    
    const { slug } = slugValidation.data
    const db = await createClient()

    // 获取相册ID
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    const album = albumResult.data

    // 增加浏览次数（使用原子操作避免并发问题）
    // 先尝试使用RPC函数
    const rpcResult = await db.rpc('increment_album_view_count', {
      album_id: album.id,
    })

    let newViewCount: number

    // 如果RPC函数不存在，使用降级方案：先查询当前值，然后更新
    if (rpcResult.error) {
      const currentAlbumResult = await db
        .from('albums')
        .select('view_count')
        .eq('id', album.id)
        .single()

      if (currentAlbumResult.data) {
        newViewCount = (currentAlbumResult.data.view_count || 0) + 1
        await db.update('albums', { view_count: newViewCount }, { id: album.id })
      } else {
        newViewCount = 1
      }
    } else {
      // RPC成功，查询更新后的值
      const updatedAlbumResult = await db
        .from('albums')
        .select('view_count')
        .eq('id', album.id)
        .single()
      
      newViewCount = updatedAlbumResult.data?.view_count || 1
    }

    return NextResponse.json({ success: true, view_count: newViewCount })
  } catch (error) {
    // 即使出错，也尝试查询当前的 view_count 返回
    try {
      const paramsData = await params
      const slugValidation = safeValidate(albumSlugSchema, paramsData)
      if (slugValidation.success) {
        const db = await createClient()
        const albumResult = await db
          .from('albums')
          .select('view_count')
          .eq('slug', slugValidation.data.slug)
          .is('deleted_at', null)
          .single()
        
        return NextResponse.json({ 
          success: false, 
          view_count: albumResult.data?.view_count || 0,
          error: 'Failed to increment view count'
        })
      }
    } catch {
      // 忽略降级方案的错误
    }
    return handleError(error, '增加浏览次数失败')
  }
}
