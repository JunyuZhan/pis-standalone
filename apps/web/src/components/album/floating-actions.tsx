'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  ArrowUp, 
  ArrowUpDown, 
  ChevronUp,
  Share2,
  X,
  LayoutGrid,
  Grid,
  ScanFace
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SortRule } from './sort-toggle'
import type { LayoutMode } from './layout-toggle'
import { showInfo, showError } from '@/lib/toast'
import type { Album } from '@/types/database'
import { cn, getAlbumShareUrl } from '@/lib/utils'
import { FaceSearchModal } from './face-search-modal'

interface FloatingActionsProps {
  album: Album
  currentSort: SortRule
  currentLayout: LayoutMode
}

export function FloatingActions({ album, currentSort, currentLayout }: FloatingActionsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showFaceSearch, setShowFaceSearch] = useState(false)

  // 确保只在客户端渲染
  useEffect(() => {
    setMounted(true)
  }, [])

  // 监听滚动，显示/隐藏回到顶部按钮
  useEffect(() => {
    if (!mounted) return

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500)
    }

    // 初始化检查
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [mounted])

  // 回到顶部
  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsExpanded(false)
  }

  // 切换排序（循环切换：降序 -> 升序 -> 上传时间 -> 降序）
  const handleSortToggle = () => {
    const params = new URLSearchParams(searchParams.toString())
    const currentSortValue = searchParams.get('sort') || album.sort_rule || 'capture_desc'
    
    // 循环切换排序规则
    let newSort: SortRule = 'capture_desc'
    if (currentSortValue === 'capture_desc') {
      newSort = 'capture_asc'
    } else if (currentSortValue === 'capture_asc') {
      newSort = 'upload_desc'
    } else {
      newSort = 'capture_desc'
    }
    
    params.set('sort', newSort)
    router.push(`?${params.toString()}`, { scroll: false })
    setIsExpanded(false)
  }

  // 获取当前排序显示文本
  const getSortLabel = () => {
    switch (currentSort) {
      case 'capture_desc':
        return '时间降序'
      case 'capture_asc':
        return '时间升序'
      case 'upload_desc':
        return '上传时间'
      default:
        return '时间降序'
    }
  }

  // 切换布局
  const handleLayoutToggle = () => {
    const params = new URLSearchParams(searchParams.toString())
    const newLayout: LayoutMode = currentLayout === 'masonry' ? 'grid' : 'masonry'
    params.set('layout', newLayout)
    router.replace(`?${params.toString()}`, { scroll: false })
    setIsExpanded(false)
  }

  // 处理人脸搜索结果
  const handleFaceSearch = (photoIds: string[]) => {
    if (photoIds.length === 0) return
    
    // 将结果存入 sessionStorage
    const key = `face_search_${album.id}`
    sessionStorage.setItem(key, JSON.stringify(photoIds))
    
    // 更新 URL 触发搜索模式
    const params = new URLSearchParams(searchParams.toString())
    params.set('search', 'face')
    router.push(`?${params.toString()}`, { scroll: false })
    
    setIsExpanded(false)
  }

  if (!mounted) return null

  return (
    <>
      {/* 浮动操作按钮组 - 只在客户端挂载后显示 */}
      {mounted && (
        <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-3 p-4 md:p-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
        {/* 展开的按钮列表 - 只在展开时渲染 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-2 mb-2"
            >
              {/* 布局切换按钮 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLayoutToggle}
                className={cn(
                  'w-10 h-10 rounded-full shadow-lg flex items-center justify-center',
                  'bg-surface border border-border hover:bg-surface-elevated',
                  'text-text-primary transition-all backdrop-blur-sm',
                  currentLayout === 'grid' && 'bg-accent/20 border-accent/30'
                )}
                title={currentLayout === 'masonry' ? '切换到网格布局' : '切换到瀑布流布局'}
              >
                {currentLayout === 'masonry' ? (
                  <Grid className="w-4 h-4" />
                ) : (
                  <LayoutGrid className="w-4 h-4" />
                )}
              </motion.button>

              {/* 人脸搜索按钮 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowFaceSearch(true)
                  setIsExpanded(false)
                }}
                className={cn(
                  'w-10 h-10 rounded-full shadow-lg flex items-center justify-center',
                  'bg-surface border border-border hover:bg-surface-elevated',
                  'text-text-primary transition-all backdrop-blur-sm'
                )}
                title="找自己"
              >
                <ScanFace className="w-4 h-4" />
              </motion.button>

              {/* 排序按钮 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSortToggle}
                className={cn(
                  'w-10 h-10 rounded-full shadow-lg flex items-center justify-center',
                  'bg-surface border border-border hover:bg-surface-elevated',
                  'text-text-primary transition-all backdrop-blur-sm'
                )}
                title={getSortLabel()}
              >
                <ArrowUpDown className="w-4 h-4" />
              </motion.button>

              {/* 分享按钮 */}
              {mounted && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (typeof window === 'undefined') return
                    try {
                      const shareUrl = getAlbumShareUrl(album.slug)
                      if (navigator.share) {
                        navigator.share({
                          title: album.title,
                          text: album.description || `查看 ${album.title} 的精彩照片`,
                          url: shareUrl,
                        }).catch(() => {
                          // 用户取消分享，不做处理
                        })
                      } else {
                        // 复制链接到剪贴板
                        navigator.clipboard.writeText(shareUrl).then(() => {
                          showInfo('链接已复制到剪贴板')
                        }).catch(() => {
                          showError('复制失败，请手动复制链接')
                        })
                      }
                    } catch (error) {
                      console.error('Share error:', error)
                      showError('分享链接生成失败，请重试')
                    }
                    setIsExpanded(false)
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full shadow-lg flex items-center justify-center',
                    'bg-surface border border-border hover:bg-surface-elevated',
                    'text-text-primary transition-all backdrop-blur-sm'
                  )}
                  title="分享相册"
                >
                  <Share2 className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

          {/* 回到顶部按钮（显示在主按钮上方，仅当未展开且滚动足够时显示） */}
        <AnimatePresence>
          {showBackToTop && !isExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBackToTop}
              className={cn(
                'w-10 h-10 rounded-full shadow-lg flex items-center justify-center mb-2',
                'bg-surface border border-border hover:bg-surface-elevated',
                'text-text-primary transition-all backdrop-blur-sm'
              )}
              aria-label="回到顶部"
              title="回到顶部"
            >
              <ArrowUp className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

          {/* 主按钮 - 展开/收起 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-10 h-10 rounded-full shadow-lg flex items-center justify-center',
            'bg-accent hover:bg-accent/90 text-background',
            'transition-all backdrop-blur-sm'
          )}
          aria-label={isExpanded ? '收起菜单' : '展开菜单'}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isExpanded ? (
              <X className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </motion.div>
        </motion.button>
        </div>
      )}

      {/* 人脸搜索模态框 */}
      {mounted && (
        <FaceSearchModal 
          albumSlug={album.slug}
          isOpen={showFaceSearch}
          onClose={() => setShowFaceSearch(false)}
          onSearch={handleFaceSearch}
        />
      )}
    </>
  )
}
