'use client'

import { useEffect, useCallback, useRef } from 'react'
import type { Photo } from '@/types/database'

interface UsePhotoRealtimeOptions {
  albumId: string
  enabled?: boolean
  onInsert?: (photo: Photo) => void
  onUpdate?: (photo: Photo) => void
  onDelete?: (photoId: string) => void
}

/**
 * 照片变更监听 Hook（使用轮询替代 Realtime）
 * 
 * 注意：PostgreSQL 没有内置 Realtime 功能，使用轮询方式检查照片更新
 * 轮询间隔：5秒（可在环境变量中配置 POLLING_INTERVAL）
 * 
 * 使用方法:
 * ```tsx
 * usePhotoRealtime({
 *   albumId: album.id,
 *   enabled: true,
 *   onInsert: (photo) => {
 *     // 新照片插入，添加到列表
 *     setPhotos(prev => [photo, ...prev])
 *   },
 *   onUpdate: (photo) => {
 *     // 照片更新 (如 status 变更)
 *     setPhotos(prev => prev.map(p => p.id === photo.id ? photo : p))
 *   },
 *   onDelete: (photoId) => {
 *     // 照片删除，从列表移除
 *     setPhotos(prev => prev.filter(p => p.id !== photoId))
 *   }
 * })
 * ```
 */
export function usePhotoRealtime({
  albumId,
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UsePhotoRealtimeOptions) {
  // 使用 ref 存储回调，避免重复订阅
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete })
  callbacksRef.current = { onInsert, onUpdate, onDelete }

  // 存储已知的照片ID，用于检测新照片
  const knownPhotoIdsRef = useRef<Set<string>>(new Set())

  const checkForUpdates = useCallback(async () => {
    if (!albumId) return

    try {
      // 获取最新的照片列表（只获取 completed 状态且未删除的照片）
      const response = await fetch(`/api/public/albums/${albumId}/photos?limit=100&sort=capture_desc`)
      if (!response.ok) return

      const data = await response.json()
      const currentPhotos = data.photos || []

      // 检测新照片
      const currentPhotoIds = new Set(currentPhotos.map((p: Photo) => p.id))
      const newPhotos = currentPhotos.filter((p: Photo) => !knownPhotoIdsRef.current.has(p.id))

      newPhotos.forEach((photo: Photo) => {
        if (photo.status === 'completed' && !photo.deleted_at) {
          callbacksRef.current.onInsert?.(photo)
          knownPhotoIdsRef.current.add(photo.id)
        }
      })

      // 更新已知照片ID集合
      currentPhotoIds.forEach((id: string) => knownPhotoIdsRef.current.add(id))

      // 清理已删除的照片ID
      knownPhotoIdsRef.current.forEach((id: string) => {
        if (!currentPhotoIds.has(id)) {
          callbacksRef.current.onDelete?.(id)
          knownPhotoIdsRef.current.delete(id)
        }
      })
    } catch (error) {
      console.error('Failed to check for photo updates:', error)
    }
  }, [albumId])

  useEffect(() => {
    if (!enabled || !albumId) return

    // 初始化已知照片ID
    checkForUpdates()

    // 设置轮询间隔（默认5秒）
    const pollingInterval = parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL || '5000', 10)
    const intervalId = setInterval(checkForUpdates, pollingInterval)

    return () => {
      clearInterval(intervalId)
      knownPhotoIdsRef.current.clear()
    }
  }, [albumId, enabled, checkForUpdates])
}

/**
 * 管理员端使用 - 监听所有状态变更（使用轮询）
 */
export function usePhotoRealtimeAdmin({
  albumId,
  enabled = true,
  onStatusChange,
}: {
  albumId: string
  enabled?: boolean
  onStatusChange?: (photoId: string, status: Photo['status']) => void
}) {
  const callbackRef = useRef(onStatusChange)
  callbackRef.current = onStatusChange

  // 存储照片状态映射
  const photoStatusMapRef = useRef<Map<string, Photo['status']>>(new Map())

  const checkForStatusChanges = useCallback(async () => {
    if (!albumId) return

    try {
      // 获取所有状态的照片（包括处理中的）
      const response = await fetch(`/api/admin/albums/${albumId}/photos`)
      if (!response.ok) return

      const data = await response.json()
      const currentPhotos = data.photos || []

      // 检测状态变更
      currentPhotos.forEach((photo: Photo) => {
        const oldStatus = photoStatusMapRef.current.get(photo.id)
        if (oldStatus && oldStatus !== photo.status) {
          callbackRef.current?.(photo.id, photo.status)
        }
        photoStatusMapRef.current.set(photo.id, photo.status)
      })

      // 清理已删除的照片
      const currentPhotoIds = new Set(currentPhotos.map((p: Photo) => p.id))
      photoStatusMapRef.current.forEach((_, id) => {
        if (!currentPhotoIds.has(id)) {
          photoStatusMapRef.current.delete(id)
        }
      })
    } catch (error) {
      console.error('Failed to check for photo status changes:', error)
    }
  }, [albumId])

  useEffect(() => {
    if (!enabled || !albumId) return

    // 初始化状态映射
    checkForStatusChanges()

    // 设置轮询间隔（管理员端更频繁，默认3秒）
    const pollingInterval = parseInt(process.env.NEXT_PUBLIC_ADMIN_POLLING_INTERVAL || '3000', 10)
    const intervalId = setInterval(checkForStatusChanges, pollingInterval)

    return () => {
      clearInterval(intervalId)
      photoStatusMapRef.current.clear()
    }
  }, [albumId, enabled, checkForStatusChanges])
}
