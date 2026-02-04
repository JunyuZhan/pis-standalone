'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { MasonryGrid } from './masonry'
import { Loader2, ImageIcon, RefreshCw, X, ScanFace } from 'lucide-react'
import { usePhotoRealtime } from '@/hooks/use-photo-realtime'
import { useLocale } from '@/lib/i18n'
import type { Album, Photo } from '@/types/database'
import type { LayoutMode } from './layout-toggle'

interface AlbumClientProps {
  album: Album
  initialPhotos: Photo[]
  layout?: LayoutMode
}

interface PhotosResponse {
  photos: Photo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 国际化文本
const messages = {
  'zh-CN': {
    newPhotos: '{count} 张新照片',
    clickToRefresh: '点击刷新',
    refreshing: '刷新中...',
  },
  'en': {
    newPhotos: '{count} new photo(s)',
    clickToRefresh: 'Click to refresh',
    refreshing: 'Refreshing...',
  },
}

/**
 * 相册客户端组件
 * 负责：无限滚动加载更多照片 + 实时更新提醒
 * 排序由页面 header 的 SortToggle 通过 URL 参数控制
 */
export function AlbumClient({ album, initialPhotos, layout = 'masonry' }: AlbumClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sort = searchParams.get('sort') || album.sort_rule || 'capture_desc'
  const groupId = searchParams.get('group')
  const searchMode = searchParams.get('search')
  const queryClient = useQueryClient()
  const locale = useLocale()
  const t = messages[locale as keyof typeof messages] || messages['zh-CN']
  
  // 新照片计数
  const [newPhotoCount, setNewPhotoCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  
  // 记录已知的照片 ID，避免重复计数
  const knownPhotoIdsRef = useRef<Set<string>>(new Set())

  // 初始化已知照片 ID
  useEffect(() => {
    const ids = new Set(initialPhotos.map(p => p.id))
    knownPhotoIdsRef.current = ids
  }, [initialPhotos])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['album-photos', album.slug, sort, groupId, searchMode],
    queryFn: async ({ pageParam = 1 }) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const url = new URL(`/api/public/albums/${album.slug}/photos`, origin)
      url.searchParams.set('page', pageParam.toString())
      url.searchParams.set('limit', '20')
      url.searchParams.set('sort', sort)
      if (groupId) {
        url.searchParams.set('group', groupId)
      }
      
      // 处理搜索模式
      if (searchMode === 'face') {
        const key = `face_search_${album.id}`
        try {
          const idsStr = sessionStorage.getItem(key)
          if (idsStr) {
            const ids = JSON.parse(idsStr)
            if (Array.isArray(ids) && ids.length > 0) {
              url.searchParams.set('ids', ids.join(','))
            }
          }
        } catch (e) {
          console.error('Failed to read search results', e)
        }
      }
      
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Failed to fetch photos')
      return res.json() as Promise<PhotosResponse>
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination
      return page < totalPages ? page + 1 : undefined
    },
    initialData: {
      pages: [
        {
          photos: initialPhotos,
          pagination: {
            page: 1,
            limit: 20,
            total: album.photo_count,
            totalPages: Math.ceil(album.photo_count / 20),
          },
        },
      ],
      pageParams: [1],
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存，减少API请求
    gcTime: 10 * 60 * 1000, // 10分钟垃圾回收时间
  })

  // 实时监听照片更新
  usePhotoRealtime({
    albumId: album.id,
    enabled: true,
    onInsert: useCallback((photo: Photo) => {
      // 检查是否是新照片（避免重复计数）
      if (!knownPhotoIdsRef.current.has(photo.id)) {
        setNewPhotoCount(prev => prev + 1)
        setShowNotification(true)
      }
    }, []),
    onDelete: useCallback((photoId: string) => {
      // 照片被删除时，从已知 ID 中移除
      knownPhotoIdsRef.current.delete(photoId)
      
      // 从 React Query 缓存中移除已删除的照片
      queryClient.setQueryData<{ pages: PhotosResponse[]; pageParams: number[] }>(
        ['album-photos', album.slug, sort, groupId],
        (oldData) => {
          if (!oldData) return oldData
          
          // 从所有页面中移除已删除的照片
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              photos: page.photos.filter((photo) => photo.id !== photoId),
              pagination: {
                ...page.pagination,
                total: Math.max(0, page.pagination.total - 1),
              },
            })),
          }
        }
      )
    }, [queryClient, album.slug, sort, groupId]),
  })

  // 刷新照片列表
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // 重置查询缓存并重新获取
      await queryClient.invalidateQueries({ queryKey: ['album-photos', album.slug] })
      await refetch()
      
      // 更新已知照片 ID
      const allPhotos = data?.pages.flatMap(page => page.photos) || []
      allPhotos.forEach(photo => knownPhotoIdsRef.current.add(photo.id))
      
      // 重置计数
      setNewPhotoCount(0)
      setShowNotification(false)
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient, album.slug, refetch, data])

  // 关闭通知
  const handleDismiss = useCallback(() => {
    setShowNotification(false)
  }, [])

  // 展平所有页面的照片
  const allPhotos = data?.pages.flatMap((page) => page.photos) || initialPhotos

  return (
    <>
      {/* 搜索结果提示栏 */}
      {searchMode === 'face' && (
        <div className="container mx-auto px-4 py-3 mb-4">
          <div className="flex items-center justify-between bg-accent/10 border border-accent/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-accent">
              <ScanFace className="w-5 h-5" />
              <span className="font-medium">人脸搜索结果</span>
              <span className="text-sm opacity-70">
                (找到 {data?.pages[0]?.pagination.total || 0} 张照片)
              </span>
            </div>
            <button 
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('search')
                router.push(`?${params.toString()}`)
              }}
              className="p-1 hover:bg-accent/20 rounded-full text-accent transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 新照片更新通知 - 固定在顶部 */}
      {showNotification && newPhotoCount > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-lg">
            <span className="text-sm font-medium">
              {t.newPhotos.replace('{count}', String(newPhotoCount))}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.refreshing}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.clickToRefresh}</span>
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 照片网格 */}
      {isLoading && allPhotos.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-text-secondary" />
        </div>
      ) : allPhotos.length > 0 ? (
        <MasonryGrid
          photos={allPhotos}
          album={album}
          layout={layout}
          hasMore={hasNextPage}
          isLoading={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
        />
      ) : (
        <div className="text-center py-20">
          <ImageIcon className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-text-primary">
            {searchMode === 'face' ? '未找到匹配的照片' : '暂无照片'}
          </h3>
          <p className="text-text-secondary">
            {searchMode === 'face' 
              ? '尝试换一张自拍，或者浏览全部照片' 
              : '摄影师正在上传照片，请稍后再来查看'}
          </p>
          {searchMode === 'face' && (
            <button 
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('search')
                router.push(`?${params.toString()}`)
              }}
              className="mt-4 text-accent hover:underline font-medium"
            >
              浏览全部照片
            </button>
          )}
        </div>
      )}
    </>
  )
}
