'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Upload, Trash2, Check, Loader2, Heart, ImageIcon, Star, ArrowUp, ArrowDown, ChevronUp, ChevronDown, RotateCw, RotateCcw, RefreshCw, Archive, RotateCcw as RestoreIcon, AlertCircle } from 'lucide-react'
import { PhotoGroupManager } from './photo-group-manager'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showSuccess, handleApiError } from '@/lib/toast'
import type { Album, Photo } from '@/types/database'
import { cn, getSafeMediaUrl } from '@/lib/utils'

// 动态导入大型组件（按需加载，减少初始 bundle）
const PhotoUploader = dynamic(() => import('./photo-uploader').then(mod => ({ default: mod.PhotoUploader })), {
  ssr: false,
  loading: () => <div className="p-4 text-center text-text-muted">加载上传组件...</div>,
})

const PhotoLightbox = dynamic(() => import('@/components/album/lightbox').then(mod => ({ default: mod.PhotoLightbox })), {
  ssr: false,
  loading: () => null,
})

interface AlbumDetailClientProps {
  album: Album
  initialPhotos: Photo[]
  mediaUrl?: string // 从服务器端传递，避免 hydration mismatch
}

export function AlbumDetailClient({ album, initialPhotos, mediaUrl: serverMediaUrl }: AlbumDetailClientProps) {
  const router = useRouter()
  const [photos, setPhotos] = useState(initialPhotos)
  const [showUploader, setShowUploader] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [processingCount, setProcessingCount] = useState(0)
  const [filterSelected, setFilterSelected] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [photoGroupMap, setPhotoGroupMap] = useState<Map<string, string[]>>(new Map())
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(album.cover_photo_id)
  const [isReordering, setIsReordering] = useState(false)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false) // 是否显示回收站
  const [isRestoring, setIsRestoring] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'default' | 'danger'
  } | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 当 initialPhotos 更新时（例如 router.refresh() 后），同步更新本地 state
  // 但保留正在处理中的照片状态，避免闪烁
  useEffect(() => {
    setPhotos((prevPhotos) => {
      // 如果有正在处理中的照片，合并新旧照片列表
      const hasProcessing = prevPhotos.some(p => p.status === 'pending' || p.status === 'processing')
      
      if (hasProcessing && prevPhotos.length > 0) {
        // 合并逻辑：保留处理中的照片状态，更新其他照片
        const photoMap = new Map<string, Photo>()
        
        // 先添加新照片（来自服务器的最新数据）
        initialPhotos.forEach(photo => {
          photoMap.set(photo.id, photo)
        })
        
        // 保留旧照片中正在处理的状态（如果新照片中没有或状态不同）
        prevPhotos.forEach(photo => {
          if (photo.status === 'pending' || photo.status === 'processing') {
            const existingPhoto = photoMap.get(photo.id)
            // 如果新照片中没有，或者新照片状态不是处理中，保留旧状态
            if (!existingPhoto || (existingPhoto.status !== 'pending' && existingPhoto.status !== 'processing')) {
              photoMap.set(photo.id, photo)
            } else {
              // 如果新照片也有处理中状态，使用新照片（可能状态已更新）
              photoMap.set(photo.id, existingPhoto)
            }
          }
        })
        
        // 转换为数组并按 sort_order 排序
        const mergedPhotos = Array.from(photoMap.values())
        mergedPhotos.sort((a, b) => {
          const aOrder = a.sort_order ?? 0
          const bOrder = b.sort_order ?? 0
          if (aOrder !== bOrder) return aOrder - bOrder
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        
        return mergedPhotos
      }
      
      // 没有处理中的照片，直接使用新数据
      return initialPhotos
    })
  }, [initialPhotos])

  // 加载照片列表（支持切换回收站视图）
  const loadPhotos = async (showDeletedPhotos = false, preserveProcessingState = true) => {
    try {
      const url = new URL(`/api/admin/albums/${album.id}/photos`, window.location.origin)
      url.searchParams.set('showDeleted', showDeletedPhotos.toString())
      // 不设置 status 参数，获取所有状态的照片（包括 pending, processing, completed）
      // 这样上传后的照片能立即显示，即使还在处理中
      
      const response = await fetch(url.toString())
      if (!response.ok) throw new Error('加载失败')
      
      const data = await response.json()
      // API 返回格式可能是 { data: { photos: [...] } } 或 { photos: [...] }
      const newPhotos = data.data?.photos || data.photos || []
      
      // 如果不需要保留处理中状态，直接使用新数据
      if (!preserveProcessingState) {
        setPhotos(newPhotos)
        return
      }
      
      // 合并新加载的照片，保留正在处理中的照片状态，避免闪烁
      setPhotos((prevPhotos) => {
        const photoMap = new Map<string, Photo>()
        
        // 先添加新照片（来自服务器的最新数据）
        newPhotos.forEach((photo: Photo) => {
          photoMap.set(photo.id, photo)
        })
        
        // 如果旧照片中有正在处理的，且新照片中没有或状态已改变，保留旧状态
        prevPhotos.forEach(photo => {
          if (photo.status === 'pending' || photo.status === 'processing') {
            const existingPhoto = photoMap.get(photo.id)
            // 如果新照片中没有，保留旧照片
            if (!existingPhoto) {
              photoMap.set(photo.id, photo)
            } else if (existingPhoto.status === 'pending' || existingPhoto.status === 'processing') {
              // 如果新照片也是处理中状态，使用新照片（可能进度已更新）
              photoMap.set(photo.id, existingPhoto)
            }
            // 如果新照片状态已变为 completed/failed，使用新照片（处理完成）
          }
        })
        
        // 转换为数组并按 sort_order 排序
        const mergedPhotos = Array.from(photoMap.values())
        mergedPhotos.sort((a, b) => {
          const aOrder = a.sort_order ?? 0
          const bOrder = b.sort_order ?? 0
          if (aOrder !== bOrder) return aOrder - bOrder
          // 如果 sort_order 相同，按创建时间倒序
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        
        return mergedPhotos
      })
    } catch (error) {
      console.error('Failed to load photos:', error)
      handleApiError(error, '加载照片失败')
    }
  }

  // 切换回收站视图时重新加载照片
  useEffect(() => {
    loadPhotos(showDeleted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted, album.id])

  useEffect(() => {
    // 只统计 pending 和 processing 状态的照片
    // processing 状态的照片正在处理中，pending 状态的照片等待处理
    const pending = photos.filter(p => p.status === 'pending' || p.status === 'processing')
    setProcessingCount(pending.length)
  }, [photos])

  // 加载照片分组映射
  useEffect(() => {
    const loadPhotoGroups = async () => {
      try {
        const response = await fetch(`/api/admin/albums/${album.id}/groups`)
        if (response.ok) {
          const data = await response.json()
          const groups = data.groups || []
          
          // 获取所有分组的照片关联
          const groupMap = new Map<string, string[]>()
          await Promise.all(
            groups.map(async (group: { id: string }) => {
              try {
                const photosResponse = await fetch(
                  `/api/admin/albums/${album.id}/groups/${group.id}/photos`
                )
                if (photosResponse.ok) {
                  const photosData = await photosResponse.json()
                  groupMap.set(group.id, photosData.photo_ids || [])
                }
              } catch (error) {
                console.error(`Failed to load photos for group ${group.id}:`, error)
              }
            })
          )
          setPhotoGroupMap(groupMap)
        }
      } catch (error) {
        console.error('Failed to load photo groups:', error)
      }
    }
    loadPhotoGroups()
  }, [album.id]) // 只依赖 album.id，移除 photos.length 避免不必要的重新加载

  // 过滤照片 - 使用 useMemo 优化性能，避免每次渲染都重新计算
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      // 根据当前视图过滤已删除的照片
      // 如果不在回收站视图，过滤掉已删除的照片
      if (!showDeleted && p.deleted_at) {
        return false
      }
      // 如果在回收站视图，只显示已删除的照片
      if (showDeleted && !p.deleted_at) {
        return false
      }
      
      // 按选中状态过滤
      if (filterSelected && !p.is_selected) {
        return false
      }
      
      // 按分组过滤
      if (selectedGroupId) {
        const groupPhotoIds = photoGroupMap.get(selectedGroupId) || []
        return groupPhotoIds.includes(p.id)
      }
      
      return true
    })
  }, [photos, filterSelected, selectedGroupId, photoGroupMap, showDeleted])

  // 轮询检查处理中的照片
  useEffect(() => {
    if (processingCount > 0) {
      // 开始轮询：使用 loadPhotos 而不是 router.refresh，避免页面闪烁
      pollIntervalRef.current = setInterval(() => {
        loadPhotos(showDeleted, true) // 保留处理中状态，避免闪烁
      }, 3000) // 每 3 秒刷新一次
    } else {
      // 停止轮询
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingCount, showDeleted]) // loadPhotos 是稳定的函数，不需要添加到依赖

  // 在客户端直接使用 getSafeMediaUrl()，避免使用服务端可能传入的 https://localhost/media
  // 这样可以确保客户端始终使用安全的媒体 URL（自动修复 localhost HTTPS 问题）
  const [mediaUrl, setMediaUrl] = useState<string>(() => {
    // 客户端初始化时直接使用 getSafeMediaUrl()
    if (typeof window !== 'undefined') {
      return getSafeMediaUrl()
    }
    // 服务端渲染时使用传入的值或默认值
    return serverMediaUrl || '/media'
  })
  
  useEffect(() => {
    // 在客户端确保使用安全的媒体 URL（自动修复 localhost HTTPS 问题）
    if (typeof window !== 'undefined') {
      const safeClientMediaUrl = getSafeMediaUrl()
      if (safeClientMediaUrl !== mediaUrl) {
        setMediaUrl(safeClientMediaUrl)
      }
    }
  }, [mediaUrl])

  // toggleSelection removed as it's not used

  const clearSelection = () => {
    setSelectedPhotos(new Set())
    setSelectionMode(false)
  }

  const handleDeleteSelected = () => {
    if (selectedPhotos.size === 0) return
    
    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: showDeleted
        ? `确定要永久删除选中的 ${selectedPhotos.size} 张照片吗？此操作不可恢复，文件将在 30 天后自动清理。`
        : `确定要删除选中的 ${selectedPhotos.size} 张照片吗？照片将移至回收站，30 天后自动清理。`,
      variant: 'danger',
      onConfirm: async () => {
        await deletePhotos(Array.from(selectedPhotos))
      },
    })
  }

  const handleDeletePhoto = (photoId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: showDeleted 
        ? '确定要永久删除这张照片吗？此操作不可恢复，文件将在 30 天后自动清理。'
        : '确定要删除这张照片吗？照片将移至回收站，30 天后自动清理。',
      variant: 'danger',
      onConfirm: async () => {
        await deletePhotos([photoId])
      },
    })
  }

  // 恢复照片
  const handleRestorePhoto = async (photoId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    await restorePhotos([photoId])
  }

  // 批量恢复照片
  const handleRestoreSelected = () => {
    if (selectedPhotos.size === 0) return
    
    setConfirmDialog({
      open: true,
      title: '确认恢复',
      message: `确定要恢复选中的 ${selectedPhotos.size} 张照片吗？`,
      variant: 'default',
      onConfirm: async () => {
        await restorePhotos(Array.from(selectedPhotos))
      },
    })
  }

  const restorePhotos = async (photoIds: string[]) => {
    setIsRestoring(true)
    try {
      const response = await fetch('/api/admin/photos/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
        }),
      })

      if (!response.ok) {
        throw new Error('恢复失败')
      }

      const result = await response.json()
      showSuccess(result.message || '恢复成功')
      
      // 更新本地状态
      setPhotos((prev) => prev.filter((p) => !photoIds.includes(p.id)))
      if (photoIds.length === selectedPhotos.size) {
        clearSelection()
      }
      
      // 如果不在回收站视图，刷新照片列表
      if (!showDeleted) {
        router.refresh()
      } else {
        // 在回收站视图，重新加载已删除的照片
        loadPhotos(true)
      }
    } catch (error) {
      console.error(error)
      handleApiError(error, '恢复失败，请重试')
    } finally {
      setIsRestoring(false)
    }
  }

  const deletePhotos = async (photoIds: string[]) => {
    setIsDeleting(true)
    try {
      // 如果在回收站视图，执行永久删除；否则执行软删除（移至回收站）
      const apiUrl = showDeleted
        ? '/api/admin/photos/permanent-delete'
        : `/api/admin/albums/${album.id}/photos`
      
      const response = await fetch(apiUrl, {
        method: showDeleted ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
        }),
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      const result = await response.json()
      showSuccess(result.message || '删除成功')
      
      // 更新本地状态
      setPhotos((prev) => prev.filter((p) => !photoIds.includes(p.id)))
      if (coverPhotoId && photoIds.includes(coverPhotoId)) {
        setCoverPhotoId(null)
      }
      if (photoIds.length === selectedPhotos.size) {
        clearSelection()
      }
      router.refresh()
    } catch (error) {
      console.error(error)
      handleApiError(error, '删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUploadComplete = async () => {
    // 上传完成后，自动关闭上传组件，避免遮挡照片
    setShowUploader(false)
    
    // 立即重新加载照片列表，确保新上传的照片能立即显示
    // preserveProcessingState = false，因为这是上传完成后的首次加载，应该显示最新状态
    await loadPhotos(showDeleted, false)
    
    // 延迟再次加载，确保服务器已处理完上传
    // 这次保留处理中状态，避免闪烁
    setTimeout(async () => {
      await loadPhotos(showDeleted, true)
      // 最后刷新页面数据（用于更新相册统计等）
      router.refresh()
    }, 1000)
  }

  // 批量重新生成预览图
  const handleReprocessSelected = async () => {
    if (selectedPhotos.size === 0) return
    
    setConfirmDialog({
      open: true,
      title: '重新生成预览图',
      message: `确定要重新生成选中的 ${selectedPhotos.size} 张照片的预览图吗？这将使用最新的预览图标准重新处理这些照片。`,
      variant: 'default',
      onConfirm: async () => {
        await reprocessPhotos(Array.from(selectedPhotos))
      },
    })
  }

  // 重新生成整个相册的预览图
  const handleReprocessAlbum = async () => {
    setConfirmDialog({
      open: true,
      title: '重新生成预览图',
      message: `确定要重新生成整个相册的预览图吗？这将使用最新的预览图标准重新处理所有照片。此操作可能需要较长时间。`,
      variant: 'default',
      onConfirm: async () => {
        await reprocessPhotos(undefined, album.id)
      },
    })
  }

  // 单张照片重新生成
  const handleReprocessSingle = async (photoId: string) => {
    try {
      const response = await fetch('/api/admin/photos/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: [photoId],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || '重新生成失败')
      }

      const result = await response.json()
      showSuccess(result.message || '已加入处理队列')
      
      // 更新本地状态：将照片状态设置为 pending
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, status: 'pending' as const } : p
        )
      )
      
      router.refresh()
    } catch (error) {
      console.error('Reprocess single photo error:', error)
      handleApiError(error, '重新生成失败，请重试')
    }
  }

  const reprocessPhotos = async (photoIds?: string[], albumId?: string) => {
    setIsReprocessing(true)
    try {
      const response = await fetch('/api/admin/photos/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
          albumId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || '重新生成预览图失败')
      }

      const result = await response.json()
      showSuccess(result.message || `已排队 ${result.queued} 张照片重新处理`)
      
      // 更新本地状态：将相关照片状态设置为 pending
      if (photoIds) {
        setPhotos((prev) =>
          prev.map((p) =>
            photoIds.includes(p.id) ? { ...p, status: 'pending' as const } : p
          )
        )
      } else {
        // 如果是整个相册，更新所有照片状态
        setPhotos((prev) =>
          prev.map((p) => ({ ...p, status: 'pending' as const }))
        )
      }
      
      clearSelection()
      
      // processingCount 会自动更新，useEffect 会开始轮询检查处理状态
    } catch (error) {
      console.error(error)
      handleApiError(error, '重新生成预览图失败，请重试')
    } finally {
      setIsReprocessing(false)
    }
  }

  // 旋转照片（向左旋转，逆时针）
  const handleRotateLeft = async (photoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await rotatePhoto(photoId, -90)
  }

  // 旋转照片（向右旋转，顺时针）
  const handleRotateRight = async (photoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await rotatePhoto(photoId, 90)
  }

  // 旋转照片的核心函数
  const rotatePhoto = async (photoId: string, angle: number) => {
    const photo = photos.find(p => p.id === photoId)
    if (!photo) return
    
    // 验证照片未删除
    if (photo.deleted_at) {
      handleApiError(new Error('照片已删除，无法操作'), '操作失败')
      return
    }
    
    // 计算新的旋转角度
    const currentRotation = photo.rotation ?? 0
    let nextRotation = (currentRotation + angle) % 360
    
    // 确保角度在 0-360 范围内
    if (nextRotation < 0) {
      nextRotation += 360
    }
    
    // 标准化为 0, 90, 180, 270
    nextRotation = Math.round(nextRotation / 90) * 90
    if (nextRotation === 360) {
      nextRotation = 0
    }
    
    try {
      const response = await fetch(`/api/admin/photos/${photoId}/rotate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotation: nextRotation === 0 ? null : nextRotation }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || '旋转失败')
      }

      const result = await response.json()
      const finalRotation = nextRotation === 0 ? null : nextRotation
      
      // 更新旋转角度（无论是否需要重新处理）
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId 
            ? { ...p, rotation: finalRotation } 
            : p
        )
      )
      
      // 只有在需要重新处理时才更新状态为 pending 并开始轮询
      if (result.needsReprocessing) {
        // 更新状态为处理中（显示加载动画）
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId 
              ? { ...p, status: 'pending' as const } 
              : p
          )
        )
        
        // 等待图片处理完成后再更新
        let attempts = 0
        const maxAttempts = 30 // 最多等待30秒
        const checkStatus = async () => {
          try {
            const statusRes = await fetch(`/api/admin/albums/${album.id}/photos`)
            if (statusRes.ok) {
              const { photos: updatedPhotos } = await statusRes.json()
              const updatedPhoto = updatedPhotos.find((p: Photo) => p.id === photoId)
              
              if (updatedPhoto && updatedPhoto.status === 'completed') {
                // 图片处理完成，用服务器返回的数据更新本地状态
                setPhotos((prev) =>
                  prev.map((p) =>
                    p.id === photoId ? { ...updatedPhoto } : p
                  )
                )
                showSuccess(finalRotation === null ? '已重置为自动旋转' : `已旋转 ${finalRotation}°`)
                return
              }
            }
            
            attempts++
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 1000) // 每秒检查一次
            } else {
              // 超时后刷新页面
              router.refresh()
            }
          } catch (error) {
            console.error('Failed to check photo status:', error)
            setTimeout(() => router.refresh(), 2000)
          }
        }
        
        // 延迟1秒后开始检查，给处理任务一些启动时间
        setTimeout(checkStatus, 1000)
      } else {
        // 不需要重新处理（可能是 pending/processing/failed 状态，或者照片还未处理）
        // 直接显示成功消息
        showSuccess(finalRotation === null ? '已重置为自动旋转' : `已旋转 ${finalRotation}°`)
      }
    } catch (error) {
      console.error(error)
      handleApiError(error, '旋转失败，请重试')
    }
  }

  // 设置封面
  const handleSetCover = async (photoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    // 验证照片未删除
    const photo = photos.find(p => p.id === photoId)
    if (!photo) return
    if (photo.deleted_at) {
      handleApiError(new Error('照片已删除，无法操作'), '操作失败')
      return
    }
    
    try {
      const response = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_photo_id: photoId }),
      })

      if (!response.ok) {
        throw new Error('设置封面失败')
      }

      setCoverPhotoId(photoId)
      showSuccess('封面已设置')
      router.refresh()
    } catch (error) {
      console.error(error)
      handleApiError(error, '设置封面失败，请重试')
    }
  }

  // 保存照片排序
  const savePhotoOrder = async (newOrder: Photo[]) => {
    setIsSavingOrder(true)
    try {
      const orders = newOrder.map((p, i) => ({
        photoId: p.id,
        sortOrder: i + 1,
      }))
      
      const response = await fetch('/api/admin/photos/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId: album.id,
          orders,
        }),
      })
      
      if (!response.ok) {
        throw new Error('保存排序失败')
      }
      
      setPhotos(newOrder)
      showSuccess('排序已保存')
      router.refresh()
    } catch (error) {
      console.error('Failed to save photo order:', error)
      handleApiError(error, '保存排序失败，请重试')
    } finally {
      setIsSavingOrder(false)
    }
  }

  // 上移照片
  const handleMoveUp = (photoId: string) => {
    const currentIndex = filteredPhotos.findIndex(p => p.id === photoId)
    if (currentIndex <= 0) return
    
    const newPhotos = [...filteredPhotos]
    const [photo] = newPhotos.splice(currentIndex, 1)
    newPhotos.splice(currentIndex - 1, 0, photo)
    
    // 更新所有照片的顺序（保持未过滤的照片）
    const allPhotoIds = new Set(newPhotos.map(p => p.id))
    const otherPhotos = photos.filter(p => !allPhotoIds.has(p.id))
    const updatedPhotos = [...otherPhotos, ...newPhotos]
    
    savePhotoOrder(updatedPhotos)
  }

  // 下移照片
  const handleMoveDown = (photoId: string) => {
    const currentIndex = filteredPhotos.findIndex(p => p.id === photoId)
    if (currentIndex < 0 || currentIndex >= filteredPhotos.length - 1) return
    
    const newPhotos = [...filteredPhotos]
    const [photo] = newPhotos.splice(currentIndex, 1)
    newPhotos.splice(currentIndex + 1, 0, photo)
    
    // 更新所有照片的顺序（保持未过滤的照片）
    const allPhotoIds = new Set(newPhotos.map(p => p.id))
    const otherPhotos = photos.filter(p => !allPhotoIds.has(p.id))
    const updatedPhotos = [...otherPhotos, ...newPhotos]
    
    savePhotoOrder(updatedPhotos)
  }

  // 置顶照片
  const handleMoveToTop = (photoId: string) => {
    const currentIndex = filteredPhotos.findIndex(p => p.id === photoId)
    if (currentIndex <= 0) return
    
    const newPhotos = [...filteredPhotos]
    const [photo] = newPhotos.splice(currentIndex, 1)
    newPhotos.unshift(photo)
    
    // 更新所有照片的顺序（保持未过滤的照片）
    const allPhotoIds = new Set(newPhotos.map(p => p.id))
    const otherPhotos = photos.filter(p => !allPhotoIds.has(p.id))
    const updatedPhotos = [...otherPhotos, ...newPhotos]
    
    savePhotoOrder(updatedPhotos)
  }

  // 置底照片
  const handleMoveToBottom = (photoId: string) => {
    const currentIndex = filteredPhotos.findIndex(p => p.id === photoId)
    if (currentIndex < 0 || currentIndex >= filteredPhotos.length - 1) return
    
    const newPhotos = [...filteredPhotos]
    const [photo] = newPhotos.splice(currentIndex, 1)
    newPhotos.push(photo)
    
    // 更新所有照片的顺序（保持未过滤的照片）
    const allPhotoIds = new Set(newPhotos.map(p => p.id))
    const otherPhotos = photos.filter(p => !allPhotoIds.has(p.id))
    const updatedPhotos = [...otherPhotos, ...newPhotos]
    
    savePhotoOrder(updatedPhotos)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 分组管理器 - 移动端优化 */}
      <div className="card p-3 sm:p-4">
        <PhotoGroupManager
          albumId={album.id}
          selectedGroupId={selectedGroupId}
          onGroupSelect={setSelectedGroupId}
        />
      </div>

      {/* 操作栏 - 移动端优化 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* 筛选按钮 */}
          <button
            onClick={() => setFilterSelected(!filterSelected)}
            className={cn(
              "btn-ghost text-sm flex items-center gap-2 px-3 py-2.5 transition-colors min-h-[44px]",
              filterSelected ? "text-red-500 bg-red-500/10" : "text-text-secondary hover:text-text-primary active:scale-95"
            )}
            title="只看客户已选"
          >
            <Heart className={cn("w-4 h-4 flex-shrink-0", filterSelected && "fill-current")} />
            <span className="hidden sm:inline">只看已选 ({photos.filter(p => p.is_selected).length})</span>
            <span className="sm:hidden">已选 ({photos.filter(p => p.is_selected).length})</span>
          </button>
          
          <div className="w-px h-4 bg-border hidden sm:block" />

          {selectionMode ? (
            <>
              <span className="text-sm text-text-secondary hidden sm:inline">
                已选择 {selectedPhotos.size} 张
              </span>
              <button type="button" onClick={clearSelection} className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95">
                取消
              </button>
                  {selectedPhotos.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedPhotos.size === 1 && (
                    <button
                      onClick={() => {
                        const photoId = Array.from(selectedPhotos)[0]
                        handleSetCover(photoId)
                        clearSelection()
                      }}
                      className="btn-ghost text-xs min-h-[44px] px-3 py-2.5 active:scale-95"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">设为封面</span>
                      <span className="sm:hidden">封面</span>
                    </button>
                  )}
                  {selectedGroupId && (
                    <button
                      onClick={async () => {
                        const photoIds = Array.from(selectedPhotos)
                        try {
                          const response = await fetch(
                            `/api/admin/albums/${album.id}/groups/${selectedGroupId}/photos`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ photo_ids: photoIds }),
                            }
                          )
                          if (response.ok) {
                            // 刷新分组映射
                            const groupMap = new Map(photoGroupMap)
                            const currentPhotoIds = groupMap.get(selectedGroupId) || []
                            groupMap.set(selectedGroupId, [...currentPhotoIds, ...photoIds])
                            setPhotoGroupMap(groupMap)
                            clearSelection()
                            showSuccess('已添加到分组')
                          } else {
                            handleApiError(new Error('添加到分组失败'))
                          }
                        } catch (error) {
                          console.error('Failed to assign photos to group:', error)
                          handleApiError(error, '添加到分组失败')
                        }
                      }}
                      className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95"
                    >
                      <Star className="w-4 h-4" />
                      <span className="hidden sm:inline">添加到分组</span>
                      <span className="sm:hidden">分组</span>
                    </button>
                  )}
                  <button
                    onClick={handleReprocessSelected}
                    disabled={isReprocessing}
                    className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95 disabled:opacity-50"
                    title="使用最新的预览图标准重新生成预览图"
                  >
                    {isReprocessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">重新生成预览图</span>
                    <span className="sm:hidden">重新生成</span>
                  </button>
                  {showDeleted ? (
                    <>
                      <button
                        onClick={handleRestoreSelected}
                        disabled={isRestoring}
                        className="btn-ghost text-sm text-green-400 hover:text-green-300 disabled:opacity-50 min-h-[44px] px-3 py-2.5 active:scale-95"
                      >
                        {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RestoreIcon className="w-4 h-4" />}
                        <span className="hidden sm:inline">恢复</span>
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        disabled={isDeleting}
                        className="btn-ghost text-sm text-red-400 hover:text-red-300 disabled:opacity-50 min-h-[44px] px-3 py-2.5 active:scale-95"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        <span className="hidden sm:inline">永久删除</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                      className="btn-ghost text-sm text-red-400 hover:text-red-300 disabled:opacity-50 min-h-[44px] px-3 py-2.5 active:scale-95"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      <span className="hidden sm:inline">删除</span>
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95"
              >
                选择
              </button>
              <button
                type="button"
                onClick={handleReprocessAlbum}
                disabled={isReprocessing}
                className="btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95 disabled:opacity-50"
                title="使用最新的预览图标准重新生成整个相册的预览图"
                data-action="reprocess-album"
              >
                {isReprocessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">处理中...</span>
                    <span className="sm:hidden">处理中</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">重新生成预览图</span>
                    <span className="sm:hidden">重新生成</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsReordering(!isReordering)}
                className={cn(
                  "btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95 disabled:opacity-50",
                  isReordering ? "bg-accent/10 text-accent" : ""
                )}
                disabled={isSavingOrder}
                data-action="reorder-photos"
              >
                {isSavingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">保存中...</span>
                    <span className="sm:hidden">保存中</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span className="hidden sm:inline">{isReordering ? '完成排序' : '排序'}</span>
                    <span className="sm:hidden">{isReordering ? '完成' : '排序'}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={cn(
              "btn-ghost text-sm min-h-[44px] px-3 py-2.5 active:scale-95",
              showDeleted ? "bg-accent/10 text-accent" : ""
            )}
            aria-label={showDeleted ? '返回相册' : '回收站'}
          >
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">{showDeleted ? '返回相册' : '回收站'}</span>
            <span className="sm:hidden">{showDeleted ? '返回' : '回收站'}</span>
          </button>
          {!showDeleted && (
            <button
              onClick={() => setShowUploader(!showUploader)}
              className="btn-primary w-full sm:w-auto min-h-[44px] justify-center"
            >
              <Upload className="w-4 h-4" />
              {showUploader ? '收起' : '上传照片'}
            </button>
          )}
        </div>
      </div>

      {/* 上传区域 */}
      {showUploader && !showDeleted && (
        <div className="card mb-4">
          <PhotoUploader
            albumId={album.id}
            onComplete={handleUploadComplete}
          />
        </div>
      )}

      {/* 回收站提示 */}
      {showDeleted && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
          <Archive className="w-4 h-4 text-yellow-500" />
          <span className="text-text-secondary">
            回收站中的照片将在 30 天后自动清理。您可以恢复这些照片。
          </span>
        </div>
      )}

      {/* 处理状态提示 - 增加 mt-4 确保不被上方元素遮挡 */}
      {processingCount > 0 && (
        <div className="flex items-center justify-between gap-2 p-3 bg-accent/10 rounded-lg text-sm mt-4 relative z-0">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
            <span className="text-text-secondary">
              {processingCount} 张照片正在处理中，将自动刷新...
            </span>
          </div>
          <button
            onClick={async () => {
              // 调用 check-pending API，自动检测和修复不一致情况
              // 1. 数据库有记录但文件不存在 → 清理数据库记录
              // 2. 文件存在但数据库没有记录 → 创建数据库记录并加入队列
              // 3. 文件存在但状态是 pending → 重新加入处理队列
              if (!confirm('确定要检查并修复卡住的照片吗？\n\n这将：\n- 清理文件不存在的 pending/failed 照片\n- 恢复 MinIO 中存在但数据库没有记录的照片\n- 重新加入处理队列（如果文件存在）\n\n注意：processing 状态的照片正在处理中，不会被清理。')) {
                return
              }
              
              try {
                const res = await fetch(`/api/admin/albums/${album.id}/check-pending`, {
                  method: 'POST',
                })
                
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}))
                  throw new Error(errorData?.error?.message || '检查失败')
                }
                
                const result = await res.json()
                const { processed = 0, requeued = 0, cleaned = 0, orphaned = 0 } = result
                
                let message = ''
                if (processed === 0 && orphaned === 0) {
                  message = '没有发现需要处理的问题'
                } else {
                  const parts: string[] = []
                  if (requeued > 0) parts.push(`${requeued} 张重新加入队列`)
                  if (cleaned > 0) parts.push(`${cleaned} 张已清理`)
                  if (orphaned > 0) parts.push(`${orphaned} 张孤立文件已恢复`)
                  message = `处理完成：${parts.join('，')}`
                }
                
                showSuccess(message)
                router.refresh()
              } catch (err) {
                console.error('Failed to check pending photos:', err)
                handleApiError(err, '检查失败，请重试')
              }
            }}
            className="text-xs text-text-secondary hover:text-text-primary underline"
          >
            清理卡住的照片
          </button>
        </div>
      )}

      {/* 照片网格 - 移动端优化 */}
      {filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {filteredPhotos.map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => {
                if (isReordering) return
                if (selectionMode) {
                  // 选择模式下，点击切换选择状态
                  if (selectedPhotos.has(photo.id)) {
                    setSelectedPhotos(prev => {
                      const next = new Set(prev)
                      next.delete(photo.id)
                      return next
                    })
                  } else {
                    setSelectedPhotos(prev => new Set(prev).add(photo.id))
                  }
                  return
                }
                // 失败状态的照片：如果有原图，打开灯箱；如果没有原图，重新生成
                if (photo.status === 'failed') {
                  if (photo.original_key) {
                    // 有原图，打开灯箱查看
                    const idx = filteredPhotos.findIndex(p => p.id === photo.id)
                    setLightboxIndex(idx)
                  } else {
                    // 没有原图，重新生成
                    handleReprocessSingle(photo.id)
                  }
                  return
                }
                // 普通模式下，打开灯箱
                const idx = filteredPhotos.findIndex(p => p.id === photo.id)
                setLightboxIndex(idx)
              }}
              className={cn(
                'aspect-square bg-surface rounded-lg overflow-hidden relative group transition-all',
                selectedPhotos.has(photo.id) && 'ring-2 ring-accent',
                isReordering && 'cursor-default',
                selectionMode && 'cursor-pointer'
              )}
            >
              {/* 优先显示缩略图，如果没有缩略图但有原图，显示原图 */}
              {photo.thumb_key ? (
                <Image
                  src={mediaUrl ? `${mediaUrl}/${photo.thumb_key}${photo.updated_at ? `?t=${new Date(photo.updated_at).getTime()}` : ''}` : ''}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                  priority={index < 6}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  key={`${photo.id}-${photo.rotation ?? 'auto'}-${photo.updated_at || ''}-${mediaUrl}`}
                  unoptimized // 跳过 Next.js Image Optimization，直接使用原始图片（避免 Vercel 无法访问 HTTP 媒体服务器）
                />
              ) : photo.original_key && photo.status === 'failed' ? (
                // 如果缩略图生成失败但原图存在，显示原图（降级显示）
                <Image
                  src={mediaUrl ? `${mediaUrl}/${photo.original_key}${photo.updated_at ? `?t=${new Date(photo.updated_at).getTime()}` : ''}` : ''}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                  priority={index < 6}
                  className="object-cover transition-transform duration-300 group-hover:scale-105 opacity-80"
                  key={`${photo.id}-original-${photo.updated_at || ''}-${mediaUrl}`}
                  unoptimized
                />
              ) : photo.status === 'failed' ? (
                <div className="w-full h-full bg-gradient-to-br from-red-500/10 to-red-600/10 flex flex-col items-center justify-center gap-2 border-2 border-red-500/20 relative">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <span className="text-red-400 text-xs">处理失败</span>
                  <span className="text-text-muted text-xs">点击重新生成</span>
                  {/* 失败照片操作按钮 */}
                  <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReprocessSingle(photo.id)
                      }}
                      className="bg-green-500/90 hover:bg-green-500 text-white rounded-full p-1.5 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="重新生成"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePhoto(photo.id, e)
                      }}
                      className="bg-red-500/90 hover:bg-red-500 text-white rounded-full p-1.5 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-surface to-surface-elevated flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <span className="text-text-muted text-xs">处理中...</span>
                </div>
              )}

              {/* 封面标识 */}
              {coverPhotoId === photo.id && (
                <div className="absolute top-2 left-2 z-10">
                  <div className="bg-accent/90 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm flex items-center gap-1">
                    <Star className="w-3 h-3 text-background fill-current" />
                    <span className="text-xs font-medium text-background">封面</span>
                  </div>
                </div>
              )}

              {/* 客户选片标识 (红心) */}
              {photo.is_selected && coverPhotoId !== photo.id && (
                <div className="absolute top-2 left-2 z-10">
                  <div className="bg-red-500/90 p-1.5 rounded-full shadow-sm backdrop-blur-sm">
                    <Heart className="w-3 h-3 text-white fill-current" />
                  </div>
                </div>
              )}

              {/* 排序按钮组 */}
              {isReordering && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveToTop(photo.id)
                      }}
                      disabled={index === 0 || isSavingOrder}
                      className={cn(
                        "bg-white/90 hover:bg-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        "p-2 md:p-1.5 flex items-center justify-center",
                        "min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px]"
                      )}
                      title="置顶"
                    >
                      <ChevronUp className="w-5 h-5 md:w-4 md:h-4 text-gray-800" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveUp(photo.id)
                      }}
                      disabled={index === 0 || isSavingOrder}
                      className={cn(
                        "bg-white/90 hover:bg-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        "p-2 md:p-1.5 flex items-center justify-center",
                        "min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px]"
                      )}
                      title="上移"
                    >
                      <ArrowUp className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-800" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveDown(photo.id)
                      }}
                      disabled={index === filteredPhotos.length - 1 || isSavingOrder}
                      className={cn(
                        "bg-white/90 hover:bg-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        "p-2 md:p-1.5 flex items-center justify-center",
                        "min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px]"
                      )}
                      title="下移"
                    >
                      <ArrowDown className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-800" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveToBottom(photo.id)
                      }}
                      disabled={index === filteredPhotos.length - 1 || isSavingOrder}
                      className={cn(
                        "bg-white/90 hover:bg-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        "p-2 md:p-1.5 flex items-center justify-center",
                        "min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px]"
                      )}
                      title="置底"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-800" />
                    </button>
                  </div>
                </div>
              )}

              {/* 旋转按钮（图片上方左右各一个） */}
              {photo.thumb_key && !isReordering && (
                <div className="absolute top-2 left-0 right-0 z-20 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <button
                    onClick={(e) => handleRotateLeft(photo.id, e)}
                    className="bg-black/70 hover:bg-black/90 rounded-full text-white transition-colors shadow-lg backdrop-blur-sm pointer-events-auto p-2.5 md:p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
                    title="向左旋转（逆时针）"
                  >
                    <RotateCcw className="w-5 h-5 md:w-4 md:h-4" />
                  </button>
                  <button
                    onClick={(e) => handleRotateRight(photo.id, e)}
                    className="bg-black/70 hover:bg-black/90 rounded-full text-white transition-colors shadow-lg backdrop-blur-sm pointer-events-auto p-2.5 md:p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
                    title="向右旋转（顺时针）"
                  >
                    <RotateCw className="w-5 h-5 md:w-4 md:h-4" />
                  </button>
                </div>
              )}

              {/* 操作按钮 (悬停显示) */}
              {!selectionMode && !isReordering && photo.thumb_key && (
                <div className="absolute bottom-2 left-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 flex-wrap max-w-full">
                  {coverPhotoId !== photo.id && (
                    <button
                      onClick={(e) => handleSetCover(photo.id, e)}
                      className="bg-black/70 hover:bg-black/90 px-2 py-1.5 rounded-full text-[10px] sm:text-xs text-white flex items-center justify-center gap-1 flex-shrink-0 whitespace-nowrap min-h-[32px] backdrop-blur-sm"
                      title="设为封面"
                    >
                      <ImageIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">设为封面</span>
                    </button>
                  )}
                  {/* 重新处理按钮（仅已完成状态的照片） */}
                  {photo.status === 'completed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReprocessSingle(photo.id)
                      }}
                      className="bg-blue-500/80 hover:bg-blue-600 px-2 py-1.5 rounded-full text-[10px] sm:text-xs text-white flex items-center justify-center gap-1 flex-shrink-0 whitespace-nowrap min-h-[32px] backdrop-blur-sm"
                      title="重新处理照片（应用当前相册风格设置）"
                    >
                      <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">重新处理</span>
                      <span className="sm:hidden">处理</span>
                    </button>
                  )}
                  {showDeleted ? (
                    <>
                      <button
                        onClick={(e) => handleRestorePhoto(photo.id, e)}
                        className="bg-green-500/80 hover:bg-green-600 px-2 py-1.5 rounded-full text-[10px] sm:text-xs text-white flex items-center justify-center gap-1 flex-shrink-0 whitespace-nowrap min-h-[32px] backdrop-blur-sm"
                        disabled={isRestoring}
                        title="恢复"
                      >
                        <RestoreIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline">恢复</span>
                      </button>
                      <button
                        onClick={(e) => handleDeletePhoto(photo.id, e)}
                        className="bg-red-500/80 hover:bg-red-600 p-1.5 sm:p-2 rounded-full text-white flex items-center justify-center flex-shrink-0 min-h-[32px] min-w-[32px] backdrop-blur-sm"
                        disabled={isDeleting}
                        title="永久删除"
                      >
                        <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => handleDeletePhoto(photo.id, e)}
                      className="bg-red-500/80 hover:bg-red-600 p-1.5 sm:p-2 rounded-full text-white flex items-center justify-center flex-shrink-0 min-h-[32px] min-w-[32px] backdrop-blur-sm"
                      disabled={isDeleting}
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                    </button>
                  )}
                </div>
              )}

              {/* 选择指示器 (管理员批量操作) */}
              {selectionMode && (
                <div
                  className={cn(
                    'absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10 cursor-pointer',
                    selectedPhotos.has(photo.id)
                      ? 'bg-accent border-accent'
                      : 'border-white/50 bg-black/30'
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selectedPhotos.has(photo.id)) {
                      setSelectedPhotos(prev => {
                        const next = new Set(prev)
                        next.delete(photo.id)
                        return next
                      })
                    } else {
                      setSelectedPhotos(prev => new Set(prev).add(photo.id))
                    }
                  }}
                >
                  {selectedPhotos.has(photo.id) && (
                    <Check className="w-4 h-4 text-background" />
                  )}
                </div>
              )}

              {/* 悬停遮罩 */}
              {!selectionMode && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
          {filterSelected ? (
             <div className="space-y-4">
               <Heart className="w-16 h-16 text-text-muted mx-auto mb-4" />
               <h2 className="text-xl font-medium mb-2">暂无已选照片</h2>
               <p className="text-text-secondary">
                 访客还没有挑选任何照片，或者您可以通过筛选查看所有照片。
               </p>
               <button
                  onClick={() => setFilterSelected(false)}
                  className="btn-secondary mt-4"
                >
                  查看全部照片
                </button>
             </div>
          ) : !showUploader ? (
            /* 空状态 - 只在没有照片且上传组件未显示时显示 */
            <div className="space-y-4">
              <Upload className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h2 className="text-xl font-medium mb-2">上传您的第一张照片</h2>
              <p className="text-text-secondary mb-6">
                支持 JPG、PNG、HEIC 格式，单文件最大 100MB
              </p>
              <button
                onClick={() => setShowUploader(true)}
                className="btn-primary"
              >
                <Upload className="w-4 h-4" />
                选择照片
              </button>
            </div>
          ) : (
            /* 上传组件显示时，显示提示信息而不是空状态 */
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 text-text-muted mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-medium mb-2">照片正在上传和处理中</h2>
              <p className="text-text-secondary">
                上传完成后，照片将自动显示在这里
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lightbox 预览 - 只在有照片且索引有效时渲染 */}
      {filteredPhotos.length > 0 && 
       lightboxIndex !== null && 
       lightboxIndex >= 0 && 
       lightboxIndex < filteredPhotos.length && (
        <PhotoLightbox
          photos={filteredPhotos}
          index={lightboxIndex}
          open={true}
          onClose={() => setLightboxIndex(null)}
          allowDownload={true}
        />
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
    </div>
  )
}
