import { Suspense } from 'react'
import { createClient } from '@/lib/database'
import { AlbumList } from '@/components/admin/album-list'
import { AlbumCardSkeleton } from '@/components/ui/skeleton'
import type { Album, Photo } from '@/types/database'

// 强制动态渲染，确保每次请求都获取最新数据
// 解决相册删除后列表不更新的问题
export const dynamic = 'force-dynamic'

/**
 * 相册列表页 (管理后台首页)
 * 
 * 注意：此页面只显示未删除的相册（deleted_at IS NULL）
 * 已删除的相册会移至回收站，不在此页面显示
 */
export default async function AdminPage() {
  const db = await createClient()

  // 获取相册列表（只获取未删除的相册，已删除的相册在回收站）
  const albumsResult = await db
    .from('albums')
    .select('*')
    .is('deleted_at', null) // 只查询未删除的相册
    .order('created_at', { ascending: false })

  const albumsData = (albumsResult.data || []) as Album[]

  // 获取封面图的 key（只获取已处理完成的照片）
  const coverPhotoIds = albumsData
    .map((a) => a.cover_photo_id)
    .filter((id): id is string => Boolean(id))
  let coverPhotosMap: Record<string, string> = {}

  if (coverPhotoIds.length > 0) {
    const photosResult = await db
      .from('photos')
      .select('id, thumb_key, status')
      .in('id', coverPhotoIds)
      .eq('status', 'completed')

    if (photosResult.data) {
      const photos = photosResult.data as Array<Pick<Photo, 'id' | 'thumb_key'>>
      coverPhotosMap = photos.reduce((acc: Record<string, string>, photo) => {
        if (photo.thumb_key) {
          acc[photo.id] = photo.thumb_key
        }
        return acc
      }, {} as Record<string, string>)
    }
  }

  // 统计每个相册的实际 completed 照片数量
  const albumIds = albumsData.map((a) => a.id) || []
  const photoCountMap: Record<string, number> = {}

  if (albumIds.length > 0) {
    // 使用分组查询统计每个相册的照片数量（排除已删除的照片）
    const photoCountsResult = await db
      .from('photos')
      .select('album_id')
      .in('album_id', albumIds)
      .eq('status', 'completed')
      .is('deleted_at', null)

    if (photoCountsResult.data) {
      // 统计每个相册的照片数量
      const photoCounts = photoCountsResult.data as Array<Pick<Photo, 'album_id'>>
      photoCounts.forEach((p) => {
        photoCountMap[p.album_id] = (photoCountMap[p.album_id] || 0) + 1
      })
    }
  }

  const albums = albumsData.map((album) => ({
    ...album,
    photo_count: photoCountMap[album.id] ?? album.photo_count ?? 0,
    cover_thumb_key: album.cover_photo_id ? coverPhotosMap[album.cover_photo_id] : null,
  }))

  return (
    <Suspense fallback={<AlbumListSkeleton />}>
      <AlbumList initialAlbums={albums || []} />
    </Suspense>
  )
}

function AlbumListSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题骨架 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <div className="h-8 w-32 bg-surface rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-48 bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-surface rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-surface rounded-lg animate-pulse" />
        </div>
      </div>

      {/* 相册网格骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <AlbumCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
