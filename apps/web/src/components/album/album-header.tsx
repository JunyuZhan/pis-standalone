'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Download, Heart, Loader2 } from 'lucide-react'
import { SortToggle, type SortRule } from './sort-toggle'
import { LayoutToggle, type LayoutMode } from './layout-toggle'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { handleApiError } from '@/lib/toast'
import type { Album } from '@/types/database'

interface AlbumHeaderProps {
  album: Album
  currentSort: SortRule
  currentLayout: LayoutMode
}

export function AlbumHeader({ album, currentSort, currentLayout }: AlbumHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  
  const shouldTruncate = album.description && album.description.length > 60
  const selectedCount = album.selected_count || 0
  const allowBatchDownload = album.allow_batch_download !== false && album.allow_download

  // 批量下载已选照片
  const handleBatchDownload = async () => {
    if (!allowBatchDownload || selectedCount === 0) return
    
    setDownloading(true)
    try {
      const response = await fetch(`/api/public/albums/${album.slug}/download-selected`)
      if (!response.ok) {
        const error = await response.json()
        handleApiError(new Error(error.error?.message || '下载失败'))
        return
      }

      const data = await response.json()
      
      // 逐个下载照片
      for (const photo of data.photos) {
        const link = document.createElement('a')
        link.href = photo.url
        link.download = photo.filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        // 稍作延迟避免浏览器阻止
        await new Promise(r => setTimeout(r, 300))
      }
    } catch (error) {
      console.error('Download error:', error)
      handleApiError(error, '下载失败，请重试')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-serif font-bold break-words line-clamp-2 md:line-clamp-none" title={album.title}>
                {album.title}
              </h1>
              
              {/* 桌面端描述 */}
              {album.description && (
                <p className="hidden md:block text-text-secondary text-sm mt-1 max-w-2xl">
                  {album.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* 选片统计 */}
              {selectedCount > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 rounded-full">
                  <Heart className="w-3.5 h-3.5 text-accent fill-current" />
                  <span className="text-xs font-medium text-accent">{selectedCount}</span>
                </div>
              )}

              {/* 批量下载按钮 */}
              {allowBatchDownload && selectedCount > 0 && (
                <button
                  onClick={handleBatchDownload}
                  disabled={downloading}
                  className="btn-secondary text-sm hidden sm:flex"
                  title="下载已选照片的原图（当前浏览为预览图）"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden md:inline">下载已选</span>
                </button>
              )}

              <span className="text-text-secondary text-xs md:text-sm whitespace-nowrap hidden sm:inline">
                {album.photo_count} 张
              </span>
              <LanguageSwitcher />
              <LayoutToggle currentLayout={currentLayout} />
              <SortToggle currentSort={currentSort} />
            </div>
          </div>

          {/* 移动端：描述和操作 */}
          <div className="md:hidden space-y-2">
            {album.description && (
              <div>
                <p className={`text-text-secondary text-xs transition-all duration-300 ${
                  isExpanded ? '' : 'line-clamp-2'
                }`}>
                  {album.description}
                </p>
                {shouldTruncate && (
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1 text-xs text-accent mt-1"
                  >
                    {isExpanded ? (
                      <>收起 <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>展开更多 <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* 移动端操作栏 */}
            {(selectedCount > 0 || allowBatchDownload) && (
              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 rounded-full">
                    <Heart className="w-3.5 h-3.5 text-accent fill-current" />
                    <span className="text-xs font-medium text-accent">已选 {selectedCount} 张</span>
                  </div>
                )}
                {allowBatchDownload && selectedCount > 0 && (
                  <button
                    onClick={handleBatchDownload}
                    disabled={downloading}
                    className="btn-secondary text-xs py-1"
                    title="下载已选照片的原图（当前浏览为预览图）"
                  >
                    {downloading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    下载
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
