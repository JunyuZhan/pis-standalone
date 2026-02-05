'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, Heart, Calendar, MapPin, Clock, ChevronDown, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { getSafeMediaUrl } from '@/lib/utils'
import type { Album, Photo } from '@/types/database'

interface AlbumHeroProps {
  album: Album
  coverPhoto?: Photo | null
  from?: string
}

export function AlbumHero({ album, coverPhoto, from }: AlbumHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)
  // 确保正确读取初始浏览次数
  const initialViewCount = album.view_count ?? 0
  const [viewCount, setViewCount] = useState(initialViewCount)
  // 使用安全的媒体 URL（自动修复 localhost HTTPS 问题）
  const mediaUrl = getSafeMediaUrl()

  // 确保只在客户端挂载后显示返回按钮，避免 hydration 错误
  useEffect(() => {
    setMounted(true)
  }, [])

  // 增加浏览次数（每次页面加载都计数）
  useEffect(() => {
    if (!mounted) return

    // 调用API增加浏览次数（每次访问都计数，不限制）
    fetch(`/api/public/albums/${album.slug}/view`, {
      method: 'POST',
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        // 使用API返回的实际值更新UI
        if (typeof data.view_count === 'number') {
          setViewCount(data.view_count)
        } else if (data.success) {
          // 如果成功但没有返回 view_count，乐观更新
          setViewCount((prev: number) => prev + 1)
        } else {
          console.warn('View count API failed:', data)
        }
      })
      .catch(() => {
        console.error('Failed to increment view count')
        // API 失败时乐观更新
        setViewCount((prev: number) => prev + 1)
      })
  }, [album.id, album.slug, mounted])

  // 获取封面图 URL（添加时间戳作为缓存破坏参数，旋转已在 Worker 处理时应用）
  // 只使用 updated_at 作为时间戳，避免 Date.now() 导致的 hydration mismatch
  // 优先使用海报图片，否则使用封面照片
  const coverUrl = album.poster_image_url && album.poster_image_url.trim()
    ? album.poster_image_url.trim()
    : (coverPhoto?.preview_key 
        ? (coverPhoto.updated_at
            ? `${mediaUrl}/${coverPhoto.preview_key}?t=${new Date(coverPhoto.updated_at).getTime()}`
            : `${mediaUrl}/${coverPhoto.preview_key}`)
        : coverPhoto?.thumb_key 
          ? (coverPhoto.updated_at
              ? `${mediaUrl}/${coverPhoto.thumb_key}?t=${new Date(coverPhoto.updated_at).getTime()}`
              : `${mediaUrl}/${coverPhoto.thumb_key}`)
          : null)

  // 格式化日期 - 使用固定格式避免 hydration 不匹配
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    if (month < 1 || month > 12) return ''
    return `${year}年${month}月${day}日`
  }

  // 格式化日期时间（用于活动时间）- 使用固定格式避免 hydration 不匹配
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    // const hours = String(date.getHours()).padStart(2, '0')
    // const minutes = String(date.getMinutes()).padStart(2, '0')
    if (month < 1 || month > 12) return ''
    // 简化为仅日期，避免时区导致的 hydration 问题
    return `${year}年${month}月${day}日` 
  }

  const event_date = album.event_date
  const location = album.location
  const selectedCount = album.selected_count || 0

  return (
    <div className="relative w-full h-[40vh] md:h-[55vh] lg:h-[65vh] min-h-[280px] md:min-h-[400px] overflow-hidden">
      {/* 背景图片 */}
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={album.title}
          fill
          sizes="100vw"
          priority
          className={`object-cover transition-all duration-1000 ${
            isLoaded ? 'scale-100 blur-0' : 'scale-110 blur-sm'
          }`}
          onLoad={() => setIsLoaded(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-elevated to-background" />
      )}

      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />

            {/* 返回首页按钮 */}
            {from === 'home' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-4 left-4 z-20"
              >
                <Link
                  href="/"
                  className="flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white/90 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">返回首页</span>
                </Link>
              </motion.div>
            )}

      {/* 内容区域 */}
      <div className="absolute inset-0 flex flex-col justify-end">
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pb-4 md:pb-10">
          {/* 实时状态标签 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-2 mb-2 md:mb-4"
          >
            {/* 直播状态指示器 */}
            {album.is_live ? (
              <div className="flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 bg-accent/90 backdrop-blur-sm rounded-full">
                <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-white"></span>
                </span>
                <span className="text-[10px] md:text-xs font-medium text-background">直播中</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
                <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-white/60"></span>
                </span>
                <span className="text-[10px] md:text-xs font-medium text-white/90">已结束</span>
              </div>
            )}

            {/* 浏览量 */}
            <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
              <Eye className="w-3 h-3 md:w-3.5 md:h-3.5 text-white/80" />
              <span className="text-[10px] md:text-xs font-medium text-white/90">{viewCount} 浏览</span>
            </div>

            {/* 选片数 */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 bg-red-500/80 backdrop-blur-sm rounded-full">
                <Heart className="w-3 h-3 md:w-3.5 md:h-3.5 text-white fill-current" />
                <span className="text-[10px] md:text-xs font-medium text-white">{selectedCount} 已选</span>
              </div>
            )}
          </motion.div>

          {/* 活动标题 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-2 md:mb-4"
          >
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-1 md:mb-2 leading-tight drop-shadow-lg">
              {album.title}
            </h1>
            {album.description && (
              <p className="text-xs md:text-base text-white/80 max-w-2xl line-clamp-2 drop-shadow-md">
                {album.description}
              </p>
            )}
          </motion.div>

          {/* 活动信息 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center gap-3 md:gap-5 text-white/80"
          >
            {/* 活动时间（优先显示，如果没有则显示创建时间） */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
              {/* 使用 suppressHydrationWarning 忽略服务端和客户端的时间格式差异 */}
              <span className="text-xs md:text-sm" suppressHydrationWarning>
                {mounted 
                  ? (event_date ? formatDateTime(event_date) : formatDate(album.created_at))
                  : (event_date ? formatDateTime(event_date) : formatDate(album.created_at)) // 保持初始渲染内容一致
                }
              </span>
            </div>

            {/* 活动地点 */}
            {location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm">{location}</span>
              </div>
            )}

            {/* 照片数量 */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">{album.photo_count} 张照片</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 向下滚动提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center text-white/60"
      >
        <span className="text-xs mb-1">向下滚动</span>
        <ChevronDown className="w-5 h-5 animate-bounce" />
      </motion.div>
    </div>
  )
}
