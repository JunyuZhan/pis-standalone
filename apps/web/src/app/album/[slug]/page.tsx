import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/database'
import { AlbumClient } from '@/components/album/album-client'
import { AlbumHero } from '@/components/album/album-hero'
import { AlbumInfoBar } from '@/components/album/album-info-bar'
import { AlbumStickyNav } from '@/components/album/album-sticky-nav'
import { AlbumSplashScreen } from '@/components/album/album-splash-screen'
import { PhotoGroupFilter } from '@/components/album/photo-group-filter'
import { FloatingActions } from '@/components/album/floating-actions'
import { SortToggle, type SortRule } from '@/components/album/sort-toggle'
import { LayoutToggle, type LayoutMode } from '@/components/album/layout-toggle'
import { getAlbumShareUrl } from '@/lib/utils'
import type { Database } from '@/types/database'

type Album = Database['public']['Tables']['albums']['Row']
type Photo = Database['public']['Tables']['photos']['Row']

interface AlbumPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; layout?: string; group?: string; from?: string; skip_splash?: string }>
}

/**
 * 生成动态 metadata（用于 Open Graph 和微信分享）
 */
export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { slug } = await params
  const db = await createClient()

  const albumResult = await db
    .from('albums')
    .select('title, description, share_title, share_description, share_image_url, poster_image_url, cover_photo_id, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (!albumResult.data) {
    return {
      title: '相册不存在',
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:9000/pis-photos'
  
  const album = albumResult.data

  // 使用自定义分享配置，如果没有则使用默认值
  const shareTitle = album.share_title || album.title
  const shareDescription = album.share_description || album.description || `查看 ${album.title} 的精彩照片`
  
  // 获取分享图片（优先级：海报图片 > 分享图片 > 封面图）
  let shareImage = album.poster_image_url && album.poster_image_url.trim()
    ? album.poster_image_url.trim()
    : (album.share_image_url && album.share_image_url.trim()
        ? album.share_image_url.trim()
        : null)
  
  // 如果还没有图片，使用封面图
  if (!shareImage && album.cover_photo_id) {
    const coverPhotoResult = await db
      .from('photos')
      .select('preview_key, thumb_key')
      .eq('id', album.cover_photo_id)
      .single()
    
    const coverPhoto = coverPhotoResult.data
    
    if (coverPhoto?.preview_key) {
      shareImage = `${mediaUrl}/${coverPhoto.preview_key}`
    } else if (coverPhoto?.thumb_key) {
      shareImage = `${mediaUrl}/${coverPhoto.thumb_key}`
    }
  }
  
  // 如果没有图片，使用默认图标作为OG图片
  if (!shareImage) {
    shareImage = `${appUrl}/icons/icon-512x512.png` // 使用应用图标作为默认OG图片
  }

  // 使用统一的URL生成函数（添加错误处理）
  let shareUrl: string
  try {
    shareUrl = getAlbumShareUrl(album.slug)
  } catch (error) {
    // 如果slug无效，使用默认URL
    console.error('Invalid album slug:', error)
    shareUrl = `${appUrl}/album/${encodeURIComponent(album.slug || '')}`
  }

  // 确保分享图片URL是绝对URL
  const absoluteShareImage = shareImage.startsWith('http') 
    ? shareImage 
    : `${appUrl}${shareImage.startsWith('/') ? '' : '/'}${shareImage}`

  return {
    title: shareTitle,
    description: shareDescription,
    openGraph: {
      type: 'website',
      title: shareTitle,
      description: shareDescription,
      url: shareUrl,
      siteName: 'PIS - 专业级摄影分享',
      images: [
        {
          url: absoluteShareImage,
          width: 1200,
          height: 630,
          alt: album.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      images: [absoluteShareImage],
    },
    // 微信分享 meta（通过其他 meta 标签实现）
    other: {
      'weixin:title': shareTitle,
      'weixin:description': shareDescription,
      'weixin:image': absoluteShareImage,
      // 额外的 Open Graph 标签（确保兼容性）
      'og:title': shareTitle,
      'og:description': shareDescription,
      'og:image': absoluteShareImage,
      'og:url': shareUrl,
      'og:type': 'website',
      'og:site_name': 'PIS - 专业级摄影分享',
    },
  }
}

/**
 * 访客相册浏览页 - 沉浸式活动主页
 * 静态导出模式：完全静态化，不支持 ISR
 */
export default async function AlbumPage({ params, searchParams }: AlbumPageProps) {
  const { slug } = await params
  const { sort, layout, group, from, skip_splash } = await searchParams
  const db = await createClient()

  // 获取相册信息（包含密码和过期时间检查）
  const albumResult = await db
    .from('albums')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (albumResult.error || !albumResult.data) {
    notFound()
  }

  const albumData = albumResult.data

  // 获取实际照片数量（确保计数准确，排除已删除的照片）
  const photoCountResult = await db
    .from('photos')
    .select('*')
    .eq('album_id', albumData.id)
    .eq('status', 'completed')
    .is('deleted_at', null)

  const actualPhotoCount = photoCountResult.count || photoCountResult.data?.length || 0

  const album = {
    ...albumData,
    photo_count: actualPhotoCount ?? albumData.photo_count,
  } as Album

  // 检查相册是否过期
  if (album.expires_at && new Date(album.expires_at) < new Date()) {
    notFound() // 过期相册返回 404，不暴露过期信息
  }

  // 检查相册是否允许分享
  if (album.allow_share === false) {
    notFound() // 不允许分享的相册返回 404，不暴露分享状态
  }

  // 注意：密码验证应该在客户端组件中处理
  // 如果相册设置了密码，需要在客户端验证后才能显示照片
  
  // 确定排序和布局规则
  const currentSort: SortRule = (sort as SortRule) || (album.sort_rule as SortRule) || 'capture_desc'
  const currentLayout = (layout as LayoutMode) || album.layout || 'masonry'
  
  let orderBy = 'captured_at'
  let ascending = false

  if (currentSort === 'capture_asc') {
    ascending = true
  } else if (currentSort === 'upload_desc') {
    orderBy = 'created_at'
  } else if (currentSort === 'manual') {
    orderBy = 'sort_order'
    ascending = true
  }

  // 获取分组列表（如果相册有分组）
  const groupsResult = await db
    .from('photo_groups')
    .select('*')
    .eq('album_id', album.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const groups = groupsResult.data || []

  // 获取照片列表（排除已删除的照片）
  const photosResult = await db
    .from('photos')
    .select('*')
    .eq('album_id', album.id)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order(orderBy, { ascending })
    .limit(20)

  const photos = (photosResult.data || []) as Photo[]

  // 获取照片分组关联（如果相册有分组）
  const photoGroupMap: Map<string, string[]> = new Map()
  if (groups.length > 0) {
    for (const group of groups) {
      const assignmentsResult = await db
        .from('photo_group_assignments')
        .select('photo_id')
        .eq('group_id', group.id)
      
      if (assignmentsResult.data) {
        photoGroupMap.set(group.id, assignmentsResult.data.map((a: any) => a.photo_id))
      }
    }
  }

  // 获取封面照片（优先使用设置的封面，否则用第一张）
  // 注意：封面照片必须未删除
  let coverPhoto: Photo | null = null
  if (album.cover_photo_id) {
    const coverResult = await db
      .from('photos')
      .select('*')
      .eq('id', album.cover_photo_id)
      .is('deleted_at', null)
      .single()
    coverPhoto = coverResult.data as Photo | null
  }
  if (!coverPhoto && photos.length > 0) {
    coverPhoto = photos[0]
  }

  // 获取背景图片URL（优先使用海报图片，否则使用封面照片）
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:9000/pis-photos'
  let backgroundImageUrl: string | null = null
  if (album.poster_image_url && album.poster_image_url.trim()) {
    backgroundImageUrl = album.poster_image_url.trim()
  } else if (coverPhoto?.preview_key) {
    backgroundImageUrl = `${mediaUrl}/${coverPhoto.preview_key}`
  } else if (coverPhoto?.thumb_key) {
    backgroundImageUrl = `${mediaUrl}/${coverPhoto.thumb_key}`
  }

  // 判断是否显示启动页
  // - 如果 from=home（从首页进入），不显示启动页
  // - 如果是分享链接（没有 from 参数），显示启动页
  // - 如果 skip_splash=1，不显示启动页
  const showSplash = from !== 'home' && skip_splash !== '1'

  return (
    <main className="min-h-screen bg-background">
      {/* 启动页（总是显示，除非已跳过） */}
      {showSplash && (
        <AlbumSplashScreen
          album={album}
          posterImageUrl={album.poster_image_url && album.poster_image_url.trim() ? album.poster_image_url.trim() : null}
        />
      )}

      {/* 沉浸式封面 Banner */}
      <AlbumHero album={album} coverPhoto={coverPhoto} from={from} />

      {/* 品牌信息栏 */}
      <AlbumInfoBar album={album} backgroundImageUrl={backgroundImageUrl} />

      {/* 吸顶导航栏（滚动后显示） */}
      <AlbumStickyNav 
        album={album} 
        currentSort={currentSort} 
        currentLayout={currentLayout}
        threshold={400}
        from={from}
      />

      {/* 照片网格 - 移动端优化 */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* 分组筛选器 */}
        {groups.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <PhotoGroupFilter
              albumId={album.id}
              albumSlug={album.slug}
              selectedGroupId={group || null}
            />
          </div>
        )}

        {/* 照片统计栏和布局切换 - 同一行 */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-border">
          <h2 className="text-base sm:text-lg font-medium">
            {group ? '分组照片' : '全部照片'} <span className="text-text-muted text-sm sm:text-base">({album.photo_count})</span>
          </h2>
          
          {/* 布局切换和排序切换 - 始终显示在右侧 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <LayoutToggle currentLayout={currentLayout} />
            <SortToggle currentSort={currentSort} />
          </div>
        </div>

        {/* 照片列表 */}
        <AlbumClient album={album} initialPhotos={photos || []} layout={currentLayout} />
      </div>

      {/* 浮动操作按钮组 */}
      <FloatingActions album={album} currentSort={currentSort} currentLayout={currentLayout} />
    </main>
  )
}
