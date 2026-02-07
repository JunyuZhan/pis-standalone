'use client'

import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import { Download, Heart, RotateCw, RotateCcw, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn, getSafeMediaUrl } from '@/lib/utils'
import { handleApiError, showSuccess } from '@/lib/toast'
import { usePhotoViewTracker, trackDownload } from '@/hooks/use-analytics'
import type { Photo } from '@/types/database'

interface PhotoLightboxProps {
  photos: Photo[]
  index: number
  open: boolean
  onClose: () => void
  allowDownload?: boolean
  onSelectChange?: (photoId: string, isSelected: boolean) => void
  onIndexChange?: (index: number) => void
}

export function PhotoLightbox({
  photos,
  index,
  open,
  onClose,
  allowDownload = true,
  onSelectChange,
  onIndexChange,
}: PhotoLightboxProps) {
  const t = useTranslations('album.lightbox')
  
  // 使用安全的媒体 URL（自动修复 localhost HTTPS 问题）
  const safeMediaUrl = getSafeMediaUrl()
  
  // 开发环境警告
  if (typeof window !== 'undefined' && !safeMediaUrl) {
    console.error('⚠️ NEXT_PUBLIC_MEDIA_URL is not configured. Images may not load.')
  }
  // 初始化 currentIndex，确保有效
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (index >= 0 && index < photos.length) {
      return index
    }
    return 0
  })
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    photos.forEach((p) => {
      map[p.id] = p.is_selected
    })
    return map
  })
  // 跟踪每张照片的临时旋转角度（仅前端显示，不保存到数据库）
  const [viewRotationMap, setViewRotationMap] = useState<Record<string, number>>({})
  // 跟踪哪些照片已加载原图（用户点击"查看原图"后）
  // 移除此逻辑，现在默认只显示大预览图，下载时才获取原图
  // const [loadedOriginals, setLoadedOriginals] = useState<Set<string>>(new Set())
  const prevIndexRef = useRef(index)
  
  // 照片查看追踪
  const { trackPhotoView } = usePhotoViewTracker(photos[0]?.album_id)

  // 预加载相邻图片（只在 Lightbox 打开时预加载）
  const preloadImage = useCallback((imageSrc: string) => {
    if (!imageSrc || typeof window === 'undefined') return
    
    // 检查是否已存在预加载链接或图片已加载
    if (document.querySelector(`link[href="${imageSrc}"]`) || 
        document.querySelector(`img[src="${imageSrc}"]`)) return
    
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = imageSrc
    link.setAttribute('fetchpriority', 'high') // Lightbox 相邻图片是高优先级
    document.head.appendChild(link)
    
    // 设置超时清理：如果 3 秒后图片还没使用，移除预加载链接
    setTimeout(() => {
      const linkElement = document.querySelector(`link[href="${imageSrc}"]`)
      if (linkElement && !document.querySelector(`img[src="${imageSrc}"]`)) {
        linkElement.remove()
      }
    }, 3000)
  }, [])

  // 同步外部传入的 index 到内部 state，并预加载相邻图片
  useEffect(() => {
    if (!open) return
    
    // 如果 index 无效，重置为 0
    const validIndex = index >= 0 && index < photos.length ? index : 0
    
    if (validIndex !== prevIndexRef.current) {
      prevIndexRef.current = validIndex
      setCurrentIndex(validIndex)
      
      // 追踪照片查看
      const currentPhoto = photos[validIndex]
      if (currentPhoto) {
        trackPhotoView(currentPhoto.id)
      }
      
      // 预加载前一张和后一张图片
      if (photos.length > 0) {
        const prevIndex = validIndex > 0 ? validIndex - 1 : null
        const nextIndex = validIndex < photos.length - 1 ? validIndex + 1 : null
        
        if (prevIndex !== null) {
          const prevPhoto = photos[prevIndex]
          const prevImageKey = prevPhoto.preview_key || prevPhoto.thumb_key || prevPhoto.original_key
          if (prevImageKey && safeMediaUrl) {
            // 只使用 updated_at 作为时间戳，避免 Date.now() 导致的 hydration mismatch
            const prevImageSrc = prevPhoto.updated_at
              ? `${safeMediaUrl.replace(/\/$/, '')}/${prevImageKey.replace(/^\//, '')}?t=${new Date(prevPhoto.updated_at).getTime()}`
              : `${safeMediaUrl.replace(/\/$/, '')}/${prevImageKey.replace(/^\//, '')}`
            preloadImage(prevImageSrc)
          }
        }
        
        if (nextIndex !== null) {
          const nextPhoto = photos[nextIndex]
          const nextImageKey = nextPhoto.preview_key || nextPhoto.thumb_key || nextPhoto.original_key
          if (nextImageKey && safeMediaUrl) {
            // 只使用 updated_at 作为时间戳，避免 Date.now() 导致的 hydration mismatch
            const nextImageSrc = nextPhoto.updated_at
              ? `${safeMediaUrl.replace(/\/$/, '')}/${nextImageKey.replace(/^\//, '')}?t=${new Date(nextPhoto.updated_at).getTime()}`
              : `${safeMediaUrl.replace(/\/$/, '')}/${nextImageKey.replace(/^\//, '')}`
            preloadImage(nextImageSrc)
          }
        }
      }
    }
  }, [index, open, photos, safeMediaUrl, preloadImage])

  // 使用 useMemo 稳定 currentPhoto 的引用，避免无限循环
  const currentPhoto = useMemo(() => {
    if (!photos || photos.length === 0) return null
    if (currentIndex >= 0 && currentIndex < photos.length) {
      return photos[currentIndex]
    }
    return photos[0] || null
  }, [photos, currentIndex])
  
  // 使用 useMemo 稳定 currentPhotoId，避免依赖整个对象
  const currentPhotoId = useMemo(() => {
    return currentPhoto?.id || ''
  }, [currentPhoto])

  // 构建 slides，默认使用预览图，点击"查看原图"后才使用原图
  const slides = useMemo(() => {
    if (!photos || photos.length === 0) {
      return []
    }
    
    return photos.map((photo) => {
      const exif = photo.exif as Record<string, unknown> | null
      const make = (exif?.image as Record<string, unknown>)?.Make || (exif?.Make as string)
      const model = (exif?.image as Record<string, unknown>)?.Model || (exif?.Model as string)
      const exifData = exif?.exif as Record<string, unknown> | undefined
      const fNumber = exifData?.FNumber as number | undefined
      const exposureTime = exifData?.ExposureTime as number | undefined
      const iso = exifData?.ISO as number | undefined
      const focalLength = exifData?.FocalLength as number | undefined

      const exifString = [
        make && model ? `${make} ${model}` : null,
        fNumber ? `f/${fNumber}` : null,
        exposureTime
          ? exposureTime < 1
            ? `1/${Math.round(1 / exposureTime)}s`
            : `${exposureTime}s`
          : null,
        iso ? `ISO${iso}` : null,
        focalLength ? `${focalLength}mm` : null,
      ]
        .filter(Boolean)
        .join(' · ')

      // 默认使用预览图（preview_key），如果用户点击了"查看原图"才使用原图（original_key）
      // 优先级：已加载原图 -> 预览图 -> 缩略图 -> 原图（作为后备）
      // 修改：只使用预览图（如果有），下载时才使用原图
      const imageKey = photo.preview_key || photo.thumb_key || photo.original_key

      // 确保 safeMediaUrl 存在且 imageKey 存在
      if (!safeMediaUrl) {
        console.error('NEXT_PUBLIC_MEDIA_URL is not configured')
      }
      if (!imageKey) {
        console.warn('Missing imageKey for photo:', photo.id)
      }

      // 构建图片 URL，确保格式正确并使用 HTTPS
      // 添加时间戳作为缓存破坏参数（旋转已在 Worker 处理时应用）
      // 只使用 updated_at 作为时间戳，避免 Date.now() 导致的 hydration mismatch
      const imageSrc = imageKey && safeMediaUrl 
        ? (photo.updated_at
            ? `${safeMediaUrl.replace(/\/$/, '')}/${imageKey.replace(/^\//, '')}?t=${new Date(photo.updated_at).getTime()}`
            : `${safeMediaUrl.replace(/\/$/, '')}/${imageKey.replace(/^\//, '')}`)
        : ''

      // 构建描述文本：仅显示 EXIF 信息（不显示日期时间和提示文字）
      const description = exifString || ''

      return {
        src: imageSrc,
        width: photo.width || 0,
        height: photo.height || 0,
        title: photo.filename || '',
        description: description,
        photoId: photo.id,
        originalKey: photo.original_key || null,
        previewKey: photo.preview_key || null,
      }
      })
    }, [photos, safeMediaUrl])

  // 加载当前照片的原图 - 已移除
  // const handleLoadOriginal = useCallback(() => {
  //   if (!currentPhotoId || !currentPhoto?.original_key) return
  //   
  //   // 将照片ID添加到已加载原图集合，触发 slides 重新计算使用原图
  //   setLoadedOriginals((prev) => new Set(prev).add(currentPhotoId))
  // }, [currentPhotoId, currentPhoto])

  // 检查是否需要显示"查看原图"按钮 - 已移除
  // const showLoadOriginalButton = useMemo(() => {
  //   return currentPhoto && 
  //     currentPhoto.original_key &&
  //     !loadedOriginals.has(currentPhoto.id) &&
  //     // 如果当前显示的是预览图，且预览图与原图不同，才显示按钮
  //     (currentPhoto.preview_key 
  //       ? currentPhoto.preview_key !== currentPhoto.original_key
  //       : true) // 如果没有预览图但原图存在，也显示按钮
  // }, [currentPhoto, loadedOriginals])

  // 通过 API 下载原图
  const handleDownload = useCallback(async () => {
    if (!currentPhotoId) return

    try {
      // 获取下载链接
      const res = await fetch(`/api/public/download/${currentPhotoId}`)
      if (!res.ok) {
        const error = await res.json()
        handleApiError(new Error(error.error?.message || '下载失败'))
        return
      }

      const { downloadUrl, filename } = await res.json()

      // 如果 downloadUrl 是相对路径，转换为完整 URL
      let fullDownloadUrl = downloadUrl
      if (downloadUrl.startsWith('/')) {
        // 相对路径，需要转换为完整 URL
        if (safeMediaUrl) {
          // 如果 downloadUrl 是 /media/xxx，需要拼接 safeMediaUrl
          if (downloadUrl.startsWith('/media/')) {
            const key = downloadUrl.replace('/media/', '')
            fullDownloadUrl = `${safeMediaUrl.replace(/\/$/, '')}/${key}`
          } else {
            // 其他相对路径，使用当前域名
            fullDownloadUrl = `${window.location.origin}${downloadUrl}`
          }
        } else {
          // 如果没有 safeMediaUrl，使用当前域名
          fullDownloadUrl = `${window.location.origin}${downloadUrl}`
        }
      }

      // 使用 fetch 获取文件数据，然后用 Blob 创建下载
      // 这样可以确保强制下载而不是预览
      const fileRes = await fetch(fullDownloadUrl)
      if (!fileRes.ok) {
        throw new Error('文件下载失败')
      }
      
      const blob = await fileRes.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      // 释放 Blob URL
      URL.revokeObjectURL(blobUrl)
      
      // 追踪下载事件
      const currentPhoto = photos[currentIndex]
      trackDownload({
        photoId: currentPhotoId,
        albumId: currentPhoto?.album_id,
        downloadType: 'single',
        fileCount: 1,
        totalSize: blob.size,
      })
    } catch (error) {
      handleApiError(error, '下载失败，请重试')
    }
  }, [currentPhotoId, currentIndex, photos, safeMediaUrl])

  // 选片功能
  const handleSelect = useCallback(async () => {
    if (!currentPhoto || !currentPhoto.id) return

    const photoId = currentPhoto.id
    const newSelected = !selectedMap[photoId]
    setSelectedMap((prev) => ({ ...prev, [photoId]: newSelected }))

    try {
      const res = await fetch(`/api/public/photos/${photoId}/select`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSelected: newSelected }),
      })

      if (!res.ok) {
        // 回滚
        setSelectedMap((prev) => ({ ...prev, [photoId]: !newSelected }))
        
        // 显示错误信息
        const errorData = await res.json()
        handleApiError(new Error(errorData.error?.message || '操作失败'), '选片失败')
      } else {
        onSelectChange?.(photoId, newSelected)
      }
    } catch (error) {
      setSelectedMap((prev) => ({ ...prev, [photoId]: !newSelected }))
      handleApiError(error, '选片失败')
    }
  }, [currentPhoto, selectedMap, onSelectChange])

  // 处理视图变化，使用 useCallback 避免在渲染期间更新状态
  const handleView = useCallback(({ index: newIndex }: { index: number }) => {
    if (newIndex >= 0 && newIndex < photos.length && newIndex !== prevIndexRef.current) {
      prevIndexRef.current = newIndex
      setCurrentIndex(newIndex)
      onIndexChange?.(newIndex)
    }
  }, [photos.length, onIndexChange])

  // 旋转照片（仅前端显示）
  const handleRotate = useCallback((angle: number) => {
    if (!currentPhotoId) return
    
    setViewRotationMap((prev) => {
      const currentRotation = prev[currentPhotoId] || 0
      const newRotation = (currentRotation + angle) % 360
      return {
        ...prev,
        [currentPhotoId]: newRotation < 0 ? newRotation + 360 : newRotation,
      }
    })
  }, [currentPhotoId])

  // 分享照片
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('shareTitle'),
          url: shareUrl,
        })
      } catch {
        // 用户取消分享
      }
    } else {
      // 复制链接（使用兼容方案）
      const { copyToClipboard } = await import('@/lib/clipboard')
      const success = await copyToClipboard(shareUrl)
      if (success) {
        showSuccess(t('linkCopied'))
      } else {
        console.error('Failed to copy share link')
      }
    }
  }, [t])

  const toolbarButtons = useMemo(() => {
    if (!currentPhoto) {
      return ['close']
    }

    const currentPhotoId = currentPhoto.id
    const isSelected = selectedMap[currentPhotoId] || false

    const buttons: Array<React.ReactNode> = [
      <button
        key="select"
        type="button"
        onClick={handleSelect}
        className={cn(
          'yarl__button flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
          isSelected
            ? 'bg-red-500 text-white'
            : 'bg-white/10 text-white hover:bg-white/20'
        )}
        aria-label={isSelected ? t('deselect') : t('select')}
      >
        <Heart
          className={cn(
            'w-5 h-5',
            isSelected && 'fill-current'
          )}
        />
      </button>,
      <button
        key="rotate-left"
        type="button"
        onClick={() => handleRotate(-90)}
        className="yarl__button flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors min-h-[44px] active:scale-[0.98] touch-manipulation"
        aria-label={t('rotateLeft')}
        title={t('rotateLeftTitle')}
      >
        <RotateCcw className="w-5 h-5" />
        <span className="hidden sm:inline text-sm">{t('rotateLeft')}</span>
      </button>,
      <button
        key="rotate-right"
        type="button"
        onClick={() => handleRotate(90)}
        className="yarl__button flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors min-h-[44px] active:scale-[0.98] touch-manipulation"
        aria-label={t('rotateRight')}
        title={t('rotateRightTitle')}
      >
        <RotateCw className="w-5 h-5" />
        <span className="hidden sm:inline text-sm">{t('rotateRight')}</span>
      </button>,
    ]

    if (allowDownload) {
      buttons.push(
        <button
          key="download"
          type="button"
          onClick={handleDownload}
          className="yarl__button flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors min-h-[44px] active:scale-[0.98] touch-manipulation"
          aria-label={t('downloadOriginal')}
          title={t('downloadOriginalTitle')}
        >
          <Download className="w-5 h-5" />
          <span className="hidden sm:inline text-sm">{t('downloadOriginal')}</span>
        </button>
      )
    }

    buttons.push(
      <button
        key="share"
        type="button"
        onClick={handleShare}
        className="yarl__button flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors min-h-[44px] active:scale-[0.98] touch-manipulation"
        aria-label={t('share')}
        title={t('shareTitle')}
      >
        <Share2 className="w-5 h-5" />
        <span className="hidden sm:inline text-sm">{t('share')}</span>
      </button>
    )

    buttons.push('close')
    return buttons
  }, [currentPhoto, selectedMap, allowDownload, handleSelect, handleDownload, handleRotate, handleShare, t])

  // 如果未打开或没有照片，不渲染
  if (!open || photos.length === 0) {
    return null
  }

  // 确保 mediaUrl 配置存在
  if (!safeMediaUrl) {
    console.error('NEXT_PUBLIC_MEDIA_URL is not configured. Cannot display images.')
    return null
  }

  // 确保 currentIndex 有效
  const validIndex = currentIndex >= 0 && currentIndex < photos.length ? currentIndex : 0
  
  // 确保 slides 不为空
  if (slides.length === 0) {
    return null
  }

  // 确保 currentPhoto 存在
  if (!currentPhoto || !currentPhoto.id) {
    return null
  }

  // 确保当前 slide 存在
  const currentSlide = slides[validIndex]
  if (!currentSlide || !currentSlide.src) {
    console.warn('Current slide is missing or has no src:', validIndex, currentSlide)
    return null
  }

  // 构建工具栏按钮数组，确保稳定的引用以避免 hydration 问题
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={validIndex}
      slides={slides}
      plugins={[Zoom, Captions]}
      on={{
        view: handleView,
        click: onClose,
      }}
      controller={{
        // 移动端下滑关闭
        closeOnPullDown: true,
        // 点击背景关闭
        closeOnBackdropClick: true,
      }}
      captions={{ descriptionTextAlign: 'center', showToggle: true }}
      carousel={{
        finite: false,
        preload: 2,
      }}
      // 键盘导航：默认支持左右箭头键（← →）、Home/End 键
      // 触摸滑动：默认支持触摸屏和触摸板左右滑动
      // 鼠标点击：支持点击左右箭头按钮切换照片
      render={{
        // 隐藏左右导航按钮
        buttonPrev: () => null,
        buttonNext: () => null,
        // 自定义 slide 渲染，应用旋转（保留默认行为）
        slide: ({ slide }) => {
          interface SlideWithPhotoId {
            photoId?: string
            src: string
            title?: string
          }
          const slideWithId = slide as SlideWithPhotoId
          const photoId = slideWithId.photoId
          const rotation = photoId ? (viewRotationMap[photoId] || 0) : 0
          
          // 如果没有旋转，使用默认渲染
          if (rotation === 0) {
            return undefined
          }
          
          // 有旋转时，自定义渲染
          // eslint-disable-next-line @next/next/no-img-element
          return (
            <div
              className="yarl__slide"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease-out',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.src}
                alt={typeof slide.title === 'string' ? slide.title : ''}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
                draggable={false}
              />
            </div>
          )
        },
      }}
      toolbar={{
        buttons: toolbarButtons,
      }}
      styles={{
        container: { backgroundColor: 'rgba(0, 0, 0, .95)' },
        captionsDescriptionContainer: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '10px',
        },
      }}
    />
  )
}
