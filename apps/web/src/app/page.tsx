import { Camera } from 'lucide-react'
import { createClient } from '@/lib/database'
import { getTranslations } from 'next-intl/server'
import { HomeHeader } from '@/components/home/header'
import { HomeHero } from '@/components/home/home-hero'
import { AlbumGrid } from '@/components/home/album-grid'
import type { Database } from '@/types/database'
import { defaultLocale } from '@/i18n/config'

type Album = Database['public']['Tables']['albums']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

/**
 * 公开相册广场首页 - 专业摄影师作品集
 * 静态导出模式：完全静态化，不支持 ISR
 */
export default async function HomePage() {
  const t = await getTranslations({ locale: defaultLocale, namespace: 'home' })
  const db = await createClient()

  // 获取公开相册列表
  const albumsResult = await db
    .from('albums')
    .select('*')
    .eq('is_public', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // 如果查询失败，记录错误并返回空数组（优雅降级）
  if (albumsResult.error) {
    console.error('Failed to fetch albums:', albumsResult.error)
  }

  const albums = (albumsResult.data as Album[] | null) || []

  // 获取最新相册作为Hero特色展示
  let featuredAlbum: Album | null = null
  let coverPhoto: Photo | null = null

  if (albums && albums.length > 0) {
    featuredAlbum = albums[0]
    
    // 获取封面照片
    if (featuredAlbum.cover_photo_id) {
      const coverResult = await db
        .from('photos')
        .select('*')
        .eq('id', featuredAlbum.cover_photo_id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .limit(1)
        
      if (coverResult.error) {
        console.error('Failed to fetch cover photo:', coverResult.error)
      } else {
        coverPhoto = coverResult.data && coverResult.data.length > 0 ? coverResult.data[0] as Photo : null
      }
    }
    
    // 如果没有封面，获取第一张照片
    if (!coverPhoto && featuredAlbum.id) {
      const firstPhotoResult = await db
        .from('photos')
        .select('*')
        .eq('album_id', featuredAlbum.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .order('captured_at', { ascending: false })
        .limit(1)
      
      if (firstPhotoResult.error) {
        console.error('Failed to fetch first photo:', firstPhotoResult.error)
      } else {
        coverPhoto = firstPhotoResult.data && firstPhotoResult.data.length > 0 ? firstPhotoResult.data[0] as Photo : null
      }
    }
  }

  // 所有相册都在作品集区域展示（包括特色相册）
  // 特色相册在 Hero 区域展示，同时在网格中也显示
  const albumsForGrid = albums

  // 优化：批量获取所有相册的封面照片，减少N+1查询
  const albumsWithCoverKeys = await (async () => {
    if (!albumsForGrid || albumsForGrid.length === 0) return []
    
    // 收集所有需要查询的封面照片ID
    const coverPhotoIds = albumsForGrid
      .map(album => album.cover_photo_id)
      .filter((id): id is string => !!id)
    
    // 批量获取封面照片
    const coverPhotosResult = coverPhotoIds.length > 0
      ? await db
          .from('photos')
          .select('id, thumb_key, preview_key, status')
          .in('id', coverPhotoIds)
          .eq('status', 'completed')
          .is('deleted_at', null)
      : { data: [], error: null }
    
    if (coverPhotosResult.error) {
      console.error('Failed to fetch cover photos:', coverPhotosResult.error)
    }
    
    // 创建封面照片映射
    const coverMap = new Map(
      (coverPhotosResult.data || []).map((photo: any) => [
        photo.id,
        { thumb_key: photo.thumb_key, preview_key: photo.preview_key }
      ])
    )
    
    // 收集需要获取第一张照片的相册ID
    const albumsNeedingFirstPhoto = albumsForGrid.filter(
      album => !album.cover_photo_id || !coverMap.has(album.cover_photo_id)
    )
    
    // 批量获取第一张照片（只查询需要的相册）
    const albumIdsNeedingPhoto = albumsNeedingFirstPhoto.map(a => a.id)
    const firstPhotosResult = albumIdsNeedingPhoto.length > 0
      ? await db
          .from('photos')
          .select('album_id, thumb_key, preview_key')
          .in('album_id', albumIdsNeedingPhoto)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .not('thumb_key', 'is', null)
          .order('captured_at', { ascending: false })
      : { data: [], error: null }
    
    if (firstPhotosResult.error) {
      console.error('Failed to fetch first photos:', firstPhotosResult.error)
    }
    
    // 为每个相册创建第一张照片映射（每个相册只取第一张）
    const firstPhotoMap = new Map<string, { thumb_key: string | null; preview_key: string | null }>()
    if (firstPhotosResult.data) {
      const seenAlbums = new Set<string>()
      for (const photo of firstPhotosResult.data as any[]) {
        if (!seenAlbums.has(photo.album_id)) {
          firstPhotoMap.set(photo.album_id, {
            thumb_key: photo.thumb_key,
            preview_key: photo.preview_key
          })
          seenAlbums.add(photo.album_id)
        }
      }
    }
    
    // 组合结果
    // 注意：直接使用 albums.photo_count 字段，无需额外查询
    // photo_count 字段由 Worker 在处理照片后自动更新，保持最新状态
    return albumsForGrid.map(album => {
      let coverThumbKey: string | null = null
      let coverPreviewKey: string | null = null
      
      if (album.cover_photo_id) {
        const cover = coverMap.get(album.cover_photo_id)
        if (cover) {
          coverThumbKey = cover.thumb_key
          coverPreviewKey = cover.preview_key
        }
      }
      
      if (!coverThumbKey && !coverPreviewKey) {
        const firstPhoto = firstPhotoMap.get(album.id)
        if (firstPhoto) {
          coverThumbKey = firstPhoto.thumb_key
          coverPreviewKey = firstPhoto.preview_key
        }
      }
      
      return {
        ...album,
        // 直接使用数据库中的 photo_count 字段（由 Worker 自动维护）
        // 无需额外查询，避免 N+1 问题
        photo_count: album.photo_count ?? 0,
        cover_thumb_key: coverThumbKey,
        cover_preview_key: coverPreviewKey,
      }
    })
  })()

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      {/* 头部导航 */}
      <HomeHeader />

      {/* Hero区域 - 全屏视觉冲击 */}
      <HomeHero featuredAlbum={featuredAlbum || undefined} coverPhoto={coverPhoto || undefined} />

      {/* 作品展示区 - Instagram风格 */}
      {albumsForGrid && albumsForGrid.length > 0 ? (
        <section id="works" className="py-4 sm:py-6 md:py-8 px-3 sm:px-4 md:px-6">
          <div className="max-w-7xl mx-auto">
            {/* 极简标题 */}
            <div className="mb-4 sm:mb-6 text-center">
              <h2 className="text-sm sm:text-base md:text-lg font-medium text-text-secondary">
                {t('works')}
              </h2>
            </div>

            {/* 相册网格 - 全宽无缝布局 */}
            <AlbumGrid albums={albumsWithCoverKeys} />
          </div>
        </section>
      ) : featuredAlbum ? (
        // 如果只有特色相册，显示提示（特色相册已在 Hero 区域展示）
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-text-secondary text-lg">
              {t('moreComing')}
            </p>
          </div>
        </section>
      ) : (
        // 空状态：没有任何相册
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <Camera className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">{t('noAlbums')}</h2>
            <p className="text-text-secondary">
              {t('noAlbumsDesc')}
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
