'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, FolderOpen, Trash2, Check, Loader2, Copy, Settings, ImageIcon, Share2, Filter, Link2 } from 'lucide-react'
import { useSwipeable } from 'react-swipeable'
import { formatRelativeTime, formatDate, getAlbumShareUrl, getSafeMediaUrl, getAppBaseUrl } from '@/lib/utils'
import { CreateAlbumDialog } from './create-album-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PullToRefresh } from '@/components/ui/pull-to-refresh'
import { LongPressMenu } from '@/components/ui/long-press-menu'
import { showSuccess, handleApiError } from '@/lib/toast'
import type { Album } from '@/types/database'
import { cn } from '@/lib/utils'

export type AlbumWithCover = Album & {
  cover_thumb_key?: string | null
}

interface AlbumListProps {
  initialAlbums: AlbumWithCover[]
}

export function AlbumList({ initialAlbums }: AlbumListProps) {
  const router = useRouter()
  const [albums, setAlbums] = useState<AlbumWithCover[]>(initialAlbums)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedAlbums, setSelectedAlbums] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [shareFilter, setShareFilter] = useState<'all' | 'shared' | 'not_shared'>('all')
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'default' | 'danger'
  } | null>(null)

  useEffect(() => {
    setAlbums(initialAlbums)
  }, [initialAlbums])

  // 筛选相册
  const filteredAlbums = albums.filter((album) => {
    if (shareFilter === 'all') return true
    if (shareFilter === 'shared') return album.allow_share !== false
    if (shareFilter === 'not_shared') return album.allow_share === false
    return true
  })

  const toggleSelection = (albumId: string) => {
    const newSelected = new Set(selectedAlbums)
    if (newSelected.has(albumId)) {
      newSelected.delete(albumId)
    } else {
      newSelected.add(albumId)
    }
    setSelectedAlbums(newSelected)
  }

  const clearSelection = () => {
    setSelectedAlbums(new Set())
    setSelectionMode(false)
  }

  const handleBatchDelete = () => {
    if (selectedAlbums.size === 0) return

    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: `确定要删除选中的 ${selectedAlbums.size} 个相册吗？此操作不可恢复。`,
      variant: 'danger',
      onConfirm: async () => {
        setIsDeleting(true)
        try {
          const response = await fetch('/api/admin/albums/batch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              albumIds: Array.from(selectedAlbums),
            }),
          })

          if (!response.ok) {
            throw new Error('删除失败')
          }

          const result = await response.json()
          showSuccess(result.message || '删除成功')

          // 更新本地状态
          setAlbums((prev) => prev.filter((a) => !selectedAlbums.has(a.id)))
          clearSelection()
          router.refresh()
        } catch (error) {
          console.error(error)
          handleApiError(error, '删除失败，请重试')
        } finally {
          setIsDeleting(false)
        }
      },
    })
  }

  const handleDuplicate = (albumId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setConfirmDialog({
      open: true,
      title: '确认复制',
      message: '确定要复制这个相册吗？将复制所有配置，但不包含照片。',
      onConfirm: async () => {
        setDuplicatingId(albumId)
        try {
          const response = await fetch(`/api/admin/albums/${albumId}/duplicate`, {
            method: 'POST',
          })

          if (!response.ok) {
            throw new Error('复制失败')
          }

          const result = await response.json()
          // API 返回格式是 { data: {...} }
          const data = result.data || result
          showSuccess('相册已复制')
          router.refresh()
          router.push(`/admin/albums/${data.id}`)
        } catch (error) {
          console.error(error)
          handleApiError(error, '复制失败，请重试')
        } finally {
          setDuplicatingId(null)
        }
      },
    })
  }

  const handleDeleteAlbum = (albumId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: '确定要删除这个相册吗？此操作不可恢复。',
      variant: 'danger',
      onConfirm: async () => {
        setIsDeleting(true)
        try {
          const response = await fetch(`/api/admin/albums/${albumId}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            throw new Error('删除失败')
          }

          const result = await response.json()
          showSuccess(result.message || '删除成功')

          // 更新本地状态（立即从列表中移除，因为相册已移至回收站）
          setAlbums((prev) => prev.filter((a) => a.id !== albumId))
          
          // 强制刷新服务器组件数据（清除缓存并重新获取）
          router.refresh()
          
          // 同时通过 API 重新获取数据，确保数据同步（双重保障）
          // 注意：删除的相册会移至回收站（deleted_at 不为 null），不会在列表中显示
          setTimeout(async () => {
            try {
              const refreshResponse = await fetch('/api/admin/albums?t=' + Date.now(), {
                cache: 'no-store', // 强制不使用缓存
              })
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json()
                if (refreshData.albums) {
                  // 确保只显示未删除的相册（deleted_at 为 null）
                  const validAlbums = refreshData.albums.filter((a: AlbumWithCover) => !a.deleted_at)
                  setAlbums(validAlbums)
                }
              }
            } catch (error) {
              console.error('Failed to refresh album list:', error)
            }
          }, 300)
        } catch (error) {
          console.error(error)
          handleApiError(error, '删除失败，请重试')
        } finally {
          setIsDeleting(false)
        }
      },
    })
  }

  const handleRefresh = async () => {
    router.refresh()
    // 等待一下让用户看到刷新动画
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="w-full">
      <div>
        {/* 页面标题 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold">我的相册</h1>
          <p className="text-text-secondary text-sm md:text-base mt-1">
            管理您的所有摄影作品集
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* 筛选器 */}
          {!selectionMode && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={shareFilter}
                onChange={(e) => setShareFilter(e.target.value as 'all' | 'shared' | 'not_shared')}
                className="px-3 py-2 md:py-1.5 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] md:min-h-0"
              >
                <option value="all">全部相册</option>
                <option value="shared">已分享</option>
                <option value="not_shared">未分享</option>
              </select>
            </div>
          )}
          
          <div className="flex items-center gap-3 ml-auto">
            {selectionMode ? (
              <>
                <span className="text-xs md:text-sm text-text-secondary hidden sm:inline">
                  已选择 {selectedAlbums.size} 个
                </span>
                <button onClick={clearSelection} className="btn-ghost text-xs md:text-sm min-h-[44px] px-3 py-2 md:px-4 md:py-2">
                  取消
                </button>
                {selectedAlbums.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    disabled={isDeleting}
                    className="btn-ghost text-xs md:text-sm text-red-400 hover:text-red-300 disabled:opacity-50 min-h-[44px] px-3 py-2 md:px-4 md:py-2"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    删除
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectionMode(true)}
                  className="btn-secondary w-full md:w-auto"
                >
                  <span className="hidden sm:inline">批量管理</span>
                  <span className="sm:hidden">批量</span>
                </button>
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="btn-primary w-full md:w-auto"
            >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">新建相册</span>
                  <span className="sm:hidden">新建</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 相册网格 */}
      {filteredAlbums.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAlbums.map((album, index) => (
            <AlbumCard
              key={album.id}
              album={album}
              index={index}
              selectionMode={selectionMode}
              isSelected={selectedAlbums.has(album.id)}
              onToggleSelection={() => toggleSelection(album.id)}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteAlbum}
              isDuplicating={duplicatingId === album.id}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      ) : albums.length > 0 ? (
        <div className="text-center py-20">
          <Filter className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">没有符合条件的相册</h3>
          <p className="text-text-secondary mb-6">请尝试调整筛选条件</p>
          <button onClick={() => setShareFilter('all')} className="btn-secondary">
            清除筛选
          </button>
        </div>
      ) : (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">还没有相册</h3>
          <p className="text-text-secondary mb-6">创建您的第一个相册开始使用吧</p>
          <button onClick={() => setCreateDialogOpen(true)} className="btn-primary">
            创建相册
          </button>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(open ? confirmDialog : null)}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
        />
      )}

      {/* 创建相册对话框 */}
      <CreateAlbumDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </div>
    </PullToRefresh>
  )
}

function AlbumCard({
  album,
  index = 0,
  selectionMode,
  isSelected,
  onToggleSelection,
  onDuplicate,
  onDelete,
  isDuplicating,
  isDeleting,
}: {
  album: AlbumWithCover
  index?: number
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelection?: () => void
  onDuplicate?: (albumId: string, e: React.MouseEvent) => void
  onDelete?: (albumId: string, e: React.MouseEvent) => void
  isDuplicating?: boolean
  isDeleting?: boolean
}) {
  const router = useRouter()
  const [imageError, setImageError] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [shareUrlCopied, setShareUrlCopied] = useState(false)
  
  // 生成分享链接
  let shareUrl: string = ''
  if (album.allow_share !== false) {
    try {
      shareUrl = getAlbumShareUrl(album.slug)
    } catch (error) {
      console.error('Failed to generate share URL:', error)
      const appUrl = getAppBaseUrl()
      shareUrl = `${appUrl}/album/${encodeURIComponent(album.slug || '')}`
    }
  }
  
  const handleCopyShareUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!shareUrl) return
    
    try {
      const { copyToClipboard } = await import('@/lib/clipboard')
      const success = await copyToClipboard(shareUrl)
      if (success) {
        setShareUrlCopied(true)
        showSuccess('分享链接已复制')
        setTimeout(() => setShareUrlCopied(false), 2000)
      } else {
        showSuccess('复制失败，请手动复制')
      }
    } catch (error) {
      console.error('Copy failed:', error)
      handleApiError(error, '复制失败，请重试')
    }
  }
  
  // 确保客户端 hydration 后显示相对时间
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // 使用安全的媒体 URL（自动修复 localhost HTTPS 问题）
  const safeMediaUrl = getSafeMediaUrl()
  
  // 构建封面图URL（优先级：海报图片 > 封面照片）
  const coverUrl = album.poster_image_url && album.poster_image_url.trim()
    ? album.poster_image_url.trim()
    : (album.cover_thumb_key
        ? `${safeMediaUrl.replace(/\/$/, '')}/${album.cover_thumb_key.replace(/^\//, '')}`
        : album.cover_photo_id
          ? `${safeMediaUrl.replace(/\/$/, '')}/processed/thumbs/${album.id}/${album.cover_photo_id}.jpg`
          : null)

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelection) {
      e.preventDefault()
      onToggleSelection()
      return
    }
    // 如果点击的不是按钮，则导航到相册详情页
    const target = e.target as HTMLElement
    if (!target.closest('button') && !target.closest('a')) {
      router.push(`/admin/albums/${album.id}`)
    }
  }

  // 手势支持：移动端滑动删除
  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (selectionMode) return
      // 只允许明显的水平滑动（水平位移大于垂直位移的2倍）
      const isHorizontalSwipe = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2
      if (e.dir === 'Left' && e.deltaX < 0 && isHorizontalSwipe) {
        setIsSwiping(true)
        setSwipeOffset(Math.max(e.deltaX, -80)) // 最大滑动80px
      }
    },
    onSwipedLeft: () => {
      if (selectionMode) return
      if (swipeOffset < -50) {
        // 滑动超过50px，触发删除
        onDelete?.(album.id, {} as React.MouseEvent)
      }
      setIsSwiping(false)
      setSwipeOffset(0)
    },
    onSwipedRight: () => {
      // 右滑恢复
      setIsSwiping(false)
      setSwipeOffset(0)
    },
    trackMouse: false, // 只在触摸设备上启用
    trackTouch: true,
    preventScrollOnSwipe: false, // 不阻止滚动，让垂直滚动正常工作
    delta: 30, // 增加触发阈值，避免误触
  })

  const CardContent = (
    <div
      className={cn(
        'card group transition-all relative overflow-hidden',
        !selectionMode && 'cursor-pointer hover:border-border-light',
        selectionMode && 'cursor-pointer',
        isSelected && 'ring-2 ring-accent',
        isSwiping && 'transition-none' // 滑动时禁用过渡
      )}
      onClick={handleClick}
      style={{
        transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
      }}
    >
      {/* 滑动删除提示 */}
      {swipeOffset < -30 && !selectionMode && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500 text-white px-4"
          style={{ width: `${Math.abs(swipeOffset)}px` }}
        >
          <Trash2 className="w-5 h-5" />
        </div>
      )}
      {/* 选择指示器 */}
      {selectionMode && (
        <div
          className={cn(
            'absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-accent border-accent'
              : 'border-white/50 bg-black/30'
          )}
        >
          {isSelected && <Check className="w-4 h-4 text-background" />}
        </div>
      )}

      {/* 封面图 */}
      <div className="aspect-[4/3] bg-surface rounded-lg mb-4 overflow-hidden relative">
        {coverUrl && !imageError ? (
          <Image
            src={coverUrl}
            alt={album.title}
            fill
            className={cn(
              'object-cover transition-transform duration-300',
              !selectionMode && 'group-hover:scale-105'
            )}
            quality={85}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={index < 4}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-text-muted" />
          </div>
        )}
      </div>

      {/* 操作按钮（移动端始终显示，桌面端悬停时更明显） */}
      {!selectionMode && (
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          {/* 移动端：始终显示，桌面端：悬停时更明显 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              router.push(`/admin/albums/${album.id}/settings`)
            }}
            className={cn(
              'p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-sm',
              'min-h-[44px] min-w-[44px] flex items-center justify-center', // 移动端触摸目标
              'opacity-100 sm:opacity-70 sm:group-hover:opacity-100' // 移动端始终显示，桌面端悬停时更明显
            )}
            title="编辑相册设置"
            aria-label="编辑相册设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate?.(album.id, e)
            }}
            disabled={isDuplicating}
            className={cn(
              'p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all disabled:opacity-50 backdrop-blur-sm',
              'min-h-[44px] min-w-[44px] flex items-center justify-center', // 移动端触摸目标
              'opacity-100 sm:opacity-70 sm:group-hover:opacity-100' // 移动端始终显示，桌面端悬停时更明显
            )}
            title="复制相册配置"
            aria-label="复制相册配置"
          >
            {isDuplicating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(album.id, e)
            }}
            disabled={isDeleting}
            className={cn(
              'p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white transition-all disabled:opacity-50 backdrop-blur-sm',
              'min-h-[44px] min-w-[44px] flex items-center justify-center', // 移动端触摸目标
              'opacity-100 sm:opacity-70 sm:group-hover:opacity-100' // 移动端始终显示，桌面端悬停时更明显
            )}
            title="删除相册"
            aria-label="删除相册"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {/* 相册信息 */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-lg mb-1 group-hover:text-accent transition-colors">
            {album.title}
          </h3>
          <div className="space-y-1">
            <p className="text-text-secondary text-sm">
              {album.photo_count} 张照片
            </p>
            {/* 分享链接 */}
            {album.allow_share !== false && shareUrl && (
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex-1 min-w-0 px-2 py-1 bg-surface-elevated rounded text-xs text-text-muted truncate">
                  {shareUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className={cn(
                    'p-1.5 rounded hover:bg-surface transition-colors shrink-0',
                    shareUrlCopied ? 'text-green-400' : 'text-text-muted hover:text-text-primary'
                  )}
                  title="复制分享链接"
                >
                  {shareUrlCopied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
            {album.event_date && (() => {
              try {
                const date = new Date(album.event_date)
                if (isNaN(date.getTime())) return null
                const year = date.getFullYear()
                const month = date.getMonth() + 1
                const day = date.getDate()
                const hours = String(date.getHours()).padStart(2, '0')
                const minutes = String(date.getMinutes()).padStart(2, '0')
                if (month < 1 || month > 12) return null
                return (
                  <p className="text-text-muted text-xs">
                    活动时间：{year}年{month}月{day}日 {hours}:{minutes}
                  </p>
                )
              } catch {
                return null
              }
            })()}
            {album.location && (
              <p className="text-text-muted text-xs">
                地点：{album.location}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block px-2 py-1 text-xs rounded-full ${
                  album.is_public
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-surface text-text-muted'
                }`}
              >
                {album.is_public ? '公开' : '私有'}
              </span>
              {album.allow_share !== false && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400"
                  title="已允许分享"
                >
                  <Share2 className="w-3 h-3" />
                  已分享
                </span>
              )}
            </div>
            <p className="text-text-muted text-xs">
              {isMounted ? formatRelativeTime(album.created_at) : formatDate(album.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  if (selectionMode) {
    return CardContent
  }

  // 长按菜单项
  const longPressMenuItems = [
    {
      label: '编辑设置',
      icon: <Settings className="w-4 h-4" />,
      onClick: () => {
        window.location.href = `/admin/albums/${album.id}/settings`
      },
    },
    {
      label: '复制相册',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => {
        onDuplicate?.(album.id, {} as React.MouseEvent)
      },
    },
    {
      label: '删除相册',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => {
        onDelete?.(album.id, {} as React.MouseEvent)
      },
      variant: 'danger' as const,
    },
  ]

  // 包装在 div 中以便手势处理正常工作
  return (
    <LongPressMenu menuItems={longPressMenuItems}>
      <div {...swipeHandlers} className="block">
        {CardContent}
      </div>
    </LongPressMenu>
  )
}
