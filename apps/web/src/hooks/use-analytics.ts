'use client'

import { useEffect, useRef, useCallback } from 'react'

// 会话 ID 存储键
const SESSION_KEY = 'pis-analytics-session'

/**
 * 获取或创建会话 ID
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  
  let sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

/**
 * 发送追踪事件（静默失败，不影响用户体验）
 */
async function trackEvent(type: string, data: Record<string, unknown>) {
  try {
    const sessionId = getSessionId()
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        sessionId,
        ...data,
      }),
    })
  } catch {
    // 静默失败
  }
}

/**
 * 追踪相册访问的 Hook
 */
export function useTrackAlbumView(albumId: string | undefined) {
  const tracked = useRef(false)

  useEffect(() => {
    if (!albumId || tracked.current) return
    
    tracked.current = true
    trackEvent('album_view', { albumId })
  }, [albumId])
}

/**
 * 追踪照片查看的 Hook
 */
export function useTrackPhotoView(photoId: string | undefined, albumId?: string) {
  const trackedPhotos = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!photoId || trackedPhotos.current.has(photoId)) return
    
    trackedPhotos.current.add(photoId)
    trackEvent('photo_view', { photoId, albumId })
  }, [photoId, albumId])
}

/**
 * 追踪下载事件
 */
export function trackDownload(params: {
  photoId?: string
  albumId?: string
  downloadType: 'single' | 'batch' | 'all'
  fileCount?: number
  totalSize?: number
}) {
  trackEvent('download', params)
}

/**
 * 手动追踪照片查看（用于 lightbox 等场景）
 */
export function usePhotoViewTracker(albumId?: string) {
  const trackedPhotos = useRef<Set<string>>(new Set())

  const trackPhotoView = useCallback((photoId: string) => {
    if (!photoId || trackedPhotos.current.has(photoId)) return
    
    trackedPhotos.current.add(photoId)
    trackEvent('photo_view', { photoId, albumId })
  }, [albumId])

  return { trackPhotoView }
}
