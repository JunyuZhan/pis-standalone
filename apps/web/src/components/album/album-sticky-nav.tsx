'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Filter, Heart, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SortToggle, type SortRule } from './sort-toggle'
import { LayoutToggle, type LayoutMode } from './layout-toggle'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import type { Album } from '@/types/database'

interface AlbumStickyNavProps {
  album: Album
  currentSort: SortRule
  currentLayout: LayoutMode
  threshold?: number // 触发显示的滚动阈值
  from?: string
}

export function AlbumStickyNav({ 
  album, 
  currentSort, 
  currentLayout,
  threshold = 400,
  from
}: AlbumStickyNavProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const selectedCount = album.selected_count || 0

  // 确保只在客户端挂载后显示返回按钮，避免 hydration 错误
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-lg"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="flex items-center justify-between h-14 md:h-16">
              {/* 左侧：标题和统计 */}
              <div className="flex items-center gap-3 min-w-0">
                {mounted && from === 'home' && (
                  <Link href="/" className="shrink-0 p-2 -ml-2 hover:bg-accent/10 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-text-primary" />
                  </Link>
                )}
                <h2 className="font-serif font-bold text-lg truncate max-w-[50vw] sm:max-w-none" title={album.title}>
                  {album.title}
                </h2>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-text-muted text-sm">
                    {album.photo_count} 张
                  </span>
                  {selectedCount > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 rounded-full">
                      <Heart className="w-3 h-3 text-accent fill-current" />
                      <span className="text-xs font-medium text-accent">{selectedCount}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：操作按钮 */}
              <div className="flex items-center gap-2">
                {/* 移动端筛选按钮 */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden btn-ghost p-2"
                >
                  <Filter className="w-5 h-5" />
                </button>

                {/* 桌面端直接显示 */}
                <div className="hidden md:flex items-center gap-2">
                  <LanguageSwitcher />
                  <LayoutToggle currentLayout={currentLayout} />
                  <SortToggle currentSort={currentSort} />
                </div>
              </div>
            </div>

            {/* 移动端展开的筛选栏 */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="md:hidden overflow-hidden border-t border-border"
                >
                  <div className="flex items-center justify-center gap-4 py-3">
                    <LanguageSwitcher />
                    <LayoutToggle currentLayout={currentLayout} />
                    <SortToggle currentSort={currentSort} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  )
}
