'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Heart, Download, Share2, Expand, Loader2, ImageIcon } from 'lucide-react'
import type { Photo, Album } from '@/types/database'
import { cn } from '@/lib/utils'
import { getBlurDataURL } from '@/lib/blurhash'
import { handleApiError } from '@/lib/toast'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { LayoutMode } from './layout-toggle'

// 动态导入 Lightbox 组件（按需加载，减少初始 bundle）
const PhotoLightbox = dynamic(() => import('./lightbox').then(mod => ({ default: mod.PhotoLightbox })), {
  ssr: false,
  loading: () => null, // Lightbox 打开时才显示，不需要加载状态
})

interface MasonryGridProps {
  photos: Photo[]
  album: Album
  layout?: LayoutMode
  hasMore?: boolean
  isLoading?: boolean
  onLoadMore?: () => void
  onSelectChange?: (photoId: string, isSelected: boolean) => void
}

/**
 * 瀑布流照片网格
 * 支持：懒加载、Lightbox、选片功能、无限滚动、布局切换
 */
export function MasonryGrid({
  photos,
  album,
  layout = 'masonry',
  hasMore = false,
  isLoading = false,
  onLoadMore,
  onSelectChange,
}: MasonryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    photos.forEach((p) => {
      map[p.id] = p.is_selected
    })
    return map
  })

  // 无限滚动观察器
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const photoRefs = useRef<Array<HTMLDivElement | null>>([])
  const lastViewedIndexRef = useRef<number | null>(null)
  
  // 图片预加载：预加载即将可见的图片（优化性能）
  // 只在图片即将进入视口时预加载，减少预加载警告
  const preloadImages = useCallback((startIndex: number, count: number = 2) => {
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''
    if (!mediaUrl || typeof window === 'undefined') return
    
    // 延迟预加载，确保图片确实会被使用
    setTimeout(() => {
      for (let i = 0; i < count && startIndex + i < photos.length; i++) {
        const photo = photos[startIndex + i]
        if (!photo?.thumb_key) continue
        
        // 只使用 updated_at 作为时间戳，避免 Date.now() 导致的 hydration mismatch
        const imageSrc = photo.updated_at 
          ? `${mediaUrl.replace(/\/$/, '')}/${photo.thumb_key.replace(/^\//, '')}?t=${new Date(photo.updated_at).getTime()}`
          : `${mediaUrl.replace(/\/$/, '')}/${photo.thumb_key.replace(/^\//, '')}`
        
        // 检查是否已存在预加载链接或图片已加载
        if (document.querySelector(`link[href="${imageSrc}"]`) || 
            document.querySelector(`img[src="${imageSrc}"]`)) continue
        
        // 使用 link preload 预加载图片，添加 fetchpriority 提示
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = imageSrc
        // fetchpriority 提示浏览器这是高优先级资源（即将可见）
        link.setAttribute('fetchpriority', i === 0 ? 'high' : 'low')
        document.head.appendChild(link)
        
        // 设置超时清理：如果 5 秒后图片还没使用，移除预加载链接
        setTimeout(() => {
          const linkElement = document.querySelector(`link[href="${imageSrc}"]`)
          if (linkElement && !document.querySelector(`img[src="${imageSrc}"]`)) {
            linkElement.remove()
          }
        }, 5000)
      }
    }, 100) // 延迟 100ms，确保页面已渲染
  }, [photos])

  useEffect(() => {
    if (!hasMore || isLoading || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])
  
  // 预加载即将可见的图片（当照片列表更新时）
  // 使用 Intersection Observer 智能预加载，避免不必要的预加载警告
  useEffect(() => {
    if (photos.length === 0) return
    
    // 只预加载前 2 张图片（首屏可见区域），减少预加载警告
    // 其他图片通过 Intersection Observer 在进入视口时自然加载
    if (photos.length > 0) {
      preloadImages(0, 2)
    }
    
    // 如果用户已经滚动到某个位置，预加载该位置附近的图片
    if (lastViewedIndexRef.current !== null && lastViewedIndexRef.current < photos.length) {
      preloadImages(lastViewedIndexRef.current, 1)
    }
  }, [photos, preloadImages])

  // 同步新照片的选中状态
  useEffect(() => {
    setSelectedMap((prev) => {
      const newMap = { ...prev }
      let hasChanges = false
      photos.forEach((p) => {
        if (!(p.id in newMap)) {
          newMap[p.id] = p.is_selected
          hasChanges = true
        }
      })
      return hasChanges ? newMap : prev
    })
  }, [photos])

  const handlePhotoClick = useCallback((index: number) => {
    lastViewedIndexRef.current = index
    setLightboxIndex(index)
    
    // 预加载 Lightbox 中相邻的图片（优化 Lightbox 切换速度）
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''
    if (mediaUrl && photos.length > 0) {
      // 预加载前一张和后一张的预览图
      const indices: number[] = []
      if (index > 0) indices.push(index - 1)
      if (index < photos.length - 1) indices.push(index + 1)
      
      indices.forEach((idx) => {
        const photo = photos[idx]
        const imageKey = photo.preview_key || photo.thumb_key
        if (!imageKey) return
        
        // 只使用 updated_at 作为时间戳，避免 Date.now() 导致的 hydration mismatch
        const imageSrc = photo.updated_at
          ? `${mediaUrl.replace(/\/$/, '')}/${imageKey.replace(/^\//, '')}?t=${new Date(photo.updated_at).getTime()}`
          : `${mediaUrl.replace(/\/$/, '')}/${imageKey.replace(/^\//, '')}`
        
        // 检查是否已存在预加载链接
        if (document.querySelector(`link[href="${imageSrc}"]`)) return
        
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = imageSrc
        // fetchpriority 提示浏览器这是高优先级资源（Lightbox 相邻图片）
        link.setAttribute('fetchpriority', 'high')
        document.head.appendChild(link)
      })
    }
  }, [photos])

  const handleCardSelect = useCallback(
    async (photoId: string, currentSelected: boolean) => {
      const newSelected = !currentSelected
      setSelectedMap((prev) => ({ ...prev, [photoId]: newSelected }))
      onSelectChange?.(photoId, newSelected)

      try {
        const res = await fetch(`/api/public/photos/${photoId}/select`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isSelected: newSelected }),
        })

        if (!res.ok) {
          // 回滚
          setSelectedMap((prev) => ({ ...prev, [photoId]: currentSelected }))
          onSelectChange?.(photoId, currentSelected)
        }
      } catch {
        // 回滚
        setSelectedMap((prev) => ({ ...prev, [photoId]: currentSelected }))
        onSelectChange?.(photoId, currentSelected)
      }
    },
    [onSelectChange]
  )

  // Lightbox 内选片变化时同步到本地状态
  const handleLightboxSelectChange = useCallback(
    (photoId: string, isSelected: boolean) => {
      setSelectedMap((prev) => ({ ...prev, [photoId]: isSelected }))
      onSelectChange?.(photoId, isSelected)
    },
    [onSelectChange]
  )

  const handleLightboxIndexChange = useCallback((newIndex: number) => {
    lastViewedIndexRef.current = newIndex
  }, [])

  const scrollToPhotoIndex = useCallback((targetIndex: number | null) => {
    if (targetIndex === null) return
    const target = photoRefs.current[targetIndex]
    if (!target) return
    const rect = target.getBoundingClientRect()
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
    if (!inView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  const handleLightboxClose = useCallback(() => {
    const targetIndex = lastViewedIndexRef.current ?? lightboxIndex
    setLightboxIndex(null)
    if (targetIndex !== null && targetIndex !== undefined) {
      requestAnimationFrame(() => scrollToPhotoIndex(targetIndex))
    }
  }, [lightboxIndex, scrollToPhotoIndex])

  return (
    <>
      <div
        className={cn(
          layout === 'masonry'
            ? 'columns-2 sm:columns-3 md:columns-3 lg:columns-4' // 响应式列数
            : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1' // 响应式网格，间距 4px
        )}
        style={layout === 'masonry' ? { columnGap: '0.25rem' } : undefined} // 列间距 4px，与垂直间距一致
      >
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            cardRef={(node) => {
              photoRefs.current[index] = node
            }}
            onClick={() => handlePhotoClick(index)}
            showSelect={true}
            isSelected={selectedMap[photo.id] || false}
            onSelect={(e) => {
              e.stopPropagation()
              handleCardSelect(photo.id, selectedMap[photo.id] || false)
            }}
            allowDownload={album.allow_download}
            layout={layout}
          />
        ))}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      )}

      {/* Infinite Scroll Trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {/* Lightbox - 只在有照片且索引有效时渲染 */}
      {lightboxIndex !== null && 
       lightboxIndex >= 0 && 
       lightboxIndex < photos.length && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          open={true}
          onClose={handleLightboxClose}
          allowDownload={album.allow_download}
          onSelectChange={handleLightboxSelectChange}
          onIndexChange={handleLightboxIndexChange}
        />
      )}
    </>
  )
}

interface PhotoCardProps {
  photo: Photo
  index: number
  onClick: () => void
  cardRef?: React.Ref<HTMLDivElement>
  showSelect?: boolean
  isSelected?: boolean
  onSelect?: (e: React.MouseEvent) => void
  allowDownload?: boolean
  layout?: LayoutMode
}

function PhotoCard({
  photo,
  index,
  onClick,
  cardRef,
  showSelect,
  isSelected,
  onSelect,
  allowDownload = false,
  layout = 'masonry',
}: PhotoCardProps) {
  const [showCopied, setShowCopied] = useState(false)
  const [blurDataURL, setBlurDataURL] = useState<string | undefined>(undefined)
  const [isMobile, setIsMobile] = useState<boolean | null>(null) // 初始为 null，避免 hydration mismatch
  const [imageKeyIndex, setImageKeyIndex] = useState(0) // 当前使用的图片 key 索引
  
  // 客户端检测设备类型（仅在客户端执行，避免 hydration mismatch）
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // 计算图片高度比例 (Masonry 模式使用)
  const aspectRatio =
    photo.width && photo.height ? photo.height / photo.width : 1

  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''
  
  // 使用配置的 URL，不强制转换协议（开发环境可能使用 HTTP）
  const safeMediaUrl = mediaUrl
  
  // 图片 key 优先级：preview_key -> thumb_key -> original_key
  // 预览图大小修改后，如果 preview_key 文件不存在，会自动降级到 thumb_key 或 original_key
  // 这确保了向后兼容：即使预览图标准修改，旧图片仍能正常显示
  const imageKeys = [
    photo.preview_key,
    photo.thumb_key,
    photo.original_key,
  ].filter(Boolean) as string[]
  
  // 当前使用的图片 key
  const currentImageKey = imageKeys[imageKeyIndex] || null
  
  // 调试：记录图片 key 信息（仅在开发环境）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && imageKeys.length > 0) {
      console.log(`[PhotoCard] Photo ${photo.id} image keys:`, {
        preview_key: photo.preview_key,
        thumb_key: photo.thumb_key,
        original_key: photo.original_key,
        currentIndex: imageKeyIndex,
        currentKey: currentImageKey,
        availableKeys: imageKeys,
      })
    }
  }, [photo.id, imageKeyIndex, currentImageKey, imageKeys, photo.preview_key, photo.thumb_key, photo.original_key])
  
  // 图片加载失败时的处理：切换到下一个后备方案
  // 这确保了即使预览图标准修改后旧预览图文件不存在，也能正常显示
  const handleImageError = useCallback(() => {
    if (imageKeyIndex < imageKeys.length - 1) {
      const currentKey = imageKeys[imageKeyIndex]
      const nextKey = imageKeys[imageKeyIndex + 1]
      console.warn(`[PhotoCard] Image load failed (${currentKey}), trying fallback: ${nextKey}`, {
        photoId: photo.id,
        currentIndex: imageKeyIndex,
        totalKeys: imageKeys.length,
      })
      // 延迟切换，确保错误处理完成
      setTimeout(() => {
        setImageKeyIndex(imageKeyIndex + 1)
      }, 100)
    } else {
      console.error(`[PhotoCard] All image sources failed for photo: ${photo.id}`, {
        preview_key: photo.preview_key,
        thumb_key: photo.thumb_key,
        original_key: photo.original_key,
        triedKeys: imageKeys,
      })
    }
  }, [imageKeyIndex, imageKeys, photo.id, photo.original_key, photo.preview_key, photo.thumb_key])

  // 前 6 张图片优先加载（首屏可见区域）
  // 其他图片通过 Intersection Observer 在进入视口时加载
  const isPriority = index < 6

  // 在客户端生成 BlurHash data URL
  useEffect(() => {
    if (photo.blur_data && typeof window !== 'undefined') {
      getBlurDataURL(photo.blur_data).then((dataURL) => {
        if (dataURL) {
          setBlurDataURL(dataURL)
        }
      })
    }
  }, [photo.blur_data])

  // 下载照片
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!allowDownload) return
    
    try {
      const response = await fetch(`/api/public/download/${photo.id}`)
      if (!response.ok) {
        const error = await response.json()
        handleApiError(new Error(error.error?.message || '下载失败'))
        return
      }

      const { downloadUrl, filename } = await response.json()

      // 触发下载
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error('下载失败:', error)
      handleApiError(error, '下载失败，请重试')
    }
  }

  // 分享照片
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const shareUrl = window.location.href
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '分享照片',
          url: shareUrl,
        })
      } catch {
        // 用户取消分享
      }
    } else {
      // 复制链接
      await navigator.clipboard.writeText(shareUrl)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    }
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (index % 10) * 0.05 }}
      className={cn(
        'group relative',
        layout === 'masonry' ? 'break-inside-avoid mb-1' : '' // 添加底部间距 4px，与列间距保持一致
      )}
    >
      {/* 照片卡片 - 移除圆角和阴影，实现无缝效果 */}
      <div className="bg-surface-elevated overflow-hidden">
        {/* 图片区域 */}
        <div 
          className={cn(
            "relative w-full overflow-hidden cursor-pointer touch-manipulation",
            layout === 'grid' ? 'aspect-square' : ''
          )}
          onClick={onClick}
        >
          {currentImageKey ? (
            <OptimizedImage
              src={`${safeMediaUrl.replace(/\/$/, '')}/${currentImageKey.replace(/^\//, '')}${photo.updated_at ? `?t=${new Date(photo.updated_at).getTime()}` : ''}`}
              alt={photo.filename || 'Photo'}
              width={layout === 'grid' ? undefined : 400}
              height={layout === 'grid' ? undefined : Math.round(400 * aspectRatio)}
              fill={layout === 'grid'}
              className={cn(
                "w-full transition-transform duration-500 group-hover:scale-105",
                layout === 'grid' ? "h-full object-cover" : "h-auto"
              )}
              quality={isPriority ? 85 : 75} // 优先图片质量高，其他降低质量
              sizes={layout === 'grid' 
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              }
              priority={isPriority}
              blurDataURL={blurDataURL}
              aspectRatio={layout !== 'grid' ? aspectRatio : undefined}
              unoptimized // 缩略图已优化(400px)，跳过 Vercel 处理，直接从 Cloudflare CDN 加载
              onError={handleImageError}
            />
          ) : (
            <div
              className={cn(
                "w-full flex items-center justify-center bg-surface-elevated",
                layout === 'grid' ? 'aspect-square' : ''
              )}
              style={layout !== 'grid' ? { paddingBottom: `${aspectRatio * 100}%` } : undefined}
            >
              <ImageIcon className="w-8 h-8 text-text-muted" />
            </div>
          )}

          {/* 悬停遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* 放大图标 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
              <Expand className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* 底部操作栏 - 悬浮在图片上 */}
          {/* 移动端隐藏，桌面端 hover 显示 */}
          <div className={cn(
            'absolute bottom-0 left-0 right-0 items-center justify-between transition-opacity duration-300 z-10',
            'hidden md:flex p-3 opacity-0 group-hover:opacity-100'
          )}>
            {/* 左侧：选片按钮 */}
            {showSelect && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.(e)
                }}
                className={cn(
                  'flex items-center rounded-full font-medium transition-all duration-200 backdrop-blur-md',
                  'gap-1.5 px-3 py-1.5 text-sm',
                  isSelected
                    ? 'bg-red-500/90 text-white hover:bg-red-600/90'
                    : 'bg-black/40 text-white hover:bg-black/60'
                )}
              >
                <Heart className={cn(
                  'w-4 h-4',
                  isSelected && 'fill-current'
                )} />
                <span>{isSelected ? '已选' : '选片'}</span>
              </button>
            )}

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-2">
              {/* 下载按钮 */}
              {allowDownload && (
                <button
                  onClick={handleDownload}
                  className="rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors p-2"
                  title="下载原图（当前为预览图，下载获取高清原图）"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              
              {/* 分享按钮 */}
              <div className="relative">
                <button
                  onClick={handleShare}
                  className="rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors p-2"
                  title="分享"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {showCopied && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded shadow-lg whitespace-nowrap backdrop-blur-md">
                    已复制链接
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 始终显示的选中状态（右上角红心） */}
          {isSelected && (
            <div className={cn(
              'absolute z-10',
              (isMobile ?? true) ? 'top-1.5 right-1.5' : 'top-2 right-2'
            )}>
              <div className={cn(
                'bg-red-500/90 rounded-full shadow-lg backdrop-blur-sm',
                (isMobile ?? true) ? 'p-1.5' : 'p-2'
              )}>
                <Heart className={cn(
                  'text-white fill-current',
                  (isMobile ?? true) ? 'w-3 h-3' : 'w-4 h-4'
                )} />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
