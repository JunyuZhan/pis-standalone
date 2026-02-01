import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Settings } from 'lucide-react'
import { createClient } from '@/lib/database'
import { getAlbumShareUrl } from '@/lib/utils'
import { AlbumDetailClient } from '@/components/admin/album-detail-client'
import { ShareLinkButton } from '@/components/admin/share-link-button'
import { PackageDownloadButton } from '@/components/admin/package-download-button'
import { ScanSyncButtonWrapper } from '@/components/admin/scan-sync-button-wrapper'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

interface AlbumDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * 相册详情页 - 照片管理
 */
export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params
  const db = await createClient()

  // 获取相册信息
  const albumResult = await db
    .from<Album>('albums')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (albumResult.error || !albumResult.data) {
    notFound()
  }

  const albumData = albumResult.data as Album

  // 获取照片列表，同时统计数量（包含 rotation 字段）
  // 管理后台显示所有状态的照片（包括处理中的），以便管理员查看处理进度
  // 注意：只查询未删除的照片，已删除的照片通过 API 的 showDeleted 参数获取
  const photosResult = await db
    .from('photos')
    .select('*, rotation')
    .eq('album_id', id)
    .in('status', ['pending', 'processing', 'completed'])
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .execute()

  const photos = (photosResult.data || []) as Photo[]

  // 统计已完成的照片数量（用于显示，排除已删除的照片）
  const photoCountResult = await db
    .from('photos')
    .select('*')
    .eq('album_id', id)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .execute()

  const photoCount = photoCountResult.count || photoCountResult.data?.length || 0

  // 如果实际照片数量与存储的不一致，更新数据库
  if (photoCount !== albumData.photo_count) {
    await db.update('albums', { photo_count: photoCount }, { id })
  }

  const album = {
    ...albumData,
    photo_count: photoCount,
  } as Album

  // 生成分享URL（添加错误处理）
  let shareUrl: string
  try {
    shareUrl = getAlbumShareUrl(album.slug)
  } catch (error) {
    console.error('Failed to generate share URL:', error)
    // 如果slug无效，使用降级方案
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    shareUrl = `${appUrl}/album/${encodeURIComponent(album.slug || '')}`
  }

  // 获取背景图片URL（优先使用海报图片，否则使用封面照片）
  let backgroundImageUrl: string | null = null
  if (album.poster_image_url && album.poster_image_url.trim()) {
    backgroundImageUrl = album.poster_image_url.trim()
  } else if (album.cover_photo_id) {
    const coverPhotoResult = await db
      .from('photos')
      .select('preview_key, thumb_key')
      .eq('id', album.cover_photo_id)
      .single()
    
    const coverPhoto = coverPhotoResult.data as { preview_key: string | null; thumb_key: string | null } | null
    
    if (coverPhoto?.preview_key) {
      const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:9000/pis-photos'
      backgroundImageUrl = `${mediaUrl}/${coverPhoto.preview_key}`
    } else if (coverPhoto?.thumb_key) {
      const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:9000/pis-photos'
      backgroundImageUrl = `${mediaUrl}/${coverPhoto.thumb_key}`
    }
  }

  return (
    <div>
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 text-text-secondary mb-6">
        <Link
          href="/admin"
          className="flex items-center gap-1 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回相册列表
        </Link>
      </div>

      {/* 页面标题 - 移动端优化 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">{album.title}</h1>
          <p className="text-text-secondary mt-1 text-sm sm:text-base">
            {album.photo_count} 张照片 · {album.is_public ? '公开' : '私有'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* 扫描同步 */}
          <ScanSyncButtonWrapper albumId={id} />
          {/* 打包下载 */}
          <PackageDownloadButton
            albumId={id}
            photoCount={album.photo_count}
            selectedCount={album.selected_count || 0}
          />
          {/* 分享链接 */}
          <ShareLinkButton 
            url={shareUrl} 
            albumTitle={album.title}
            albumDescription={album.description}
            backgroundImageUrl={backgroundImageUrl}
          />
          <Link
            href={`/admin/albums/${id}/settings`}
            className="btn-secondary min-h-[44px] px-3 sm:px-4"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">设置</span>
          </Link>
        </div>
      </div>

      {/* 客户端组件：上传和照片网格 */}
        <AlbumDetailClient 
          album={album} 
          initialPhotos={photos}
          mediaUrl={process.env.NEXT_PUBLIC_MEDIA_URL}
        />
    </div>
  )
}
