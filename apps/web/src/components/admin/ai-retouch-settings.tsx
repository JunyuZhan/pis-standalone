'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { showSuccess, handleApiError } from '@/lib/toast'

interface AIRetouchSettingsProps {
  totalAlbums: number
  enabledAlbums: number
  allAlbumIds: string[]
}

export function AIRetouchSettings({ totalAlbums, enabledAlbums, allAlbumIds }: AIRetouchSettingsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isEnabled, setIsEnabled] = useState(enabledAlbums > 0)
  const [currentEnabledCount, setCurrentEnabledCount] = useState(enabledAlbums)

  // 当 props 更新时同步状态
  useEffect(() => {
    setIsEnabled(enabledAlbums > 0)
    setCurrentEnabledCount(enabledAlbums)
  }, [enabledAlbums])

  const handleToggle = async (enabled: boolean) => {
    if (allAlbumIds.length === 0) {
      showSuccess('没有可操作的相册')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/admin/albums/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumIds: allAlbumIds,
          updates: {
            enable_ai_retouch: enabled,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error?.message || data.error?.details || '操作失败'
        throw new Error(errorMessage)
      }

      setIsEnabled(enabled)
      setCurrentEnabledCount(enabled ? totalAlbums : 0)
      showSuccess(enabled ? `已为所有 ${totalAlbums} 个相册启用 AI 修图` : `已为所有 ${totalAlbums} 个相册关闭 AI 修图`)
      
      // 刷新 Server Component 数据，确保统计信息更新
      router.refresh()
    } catch (error) {
      handleApiError(error, '更新 AI 修图设置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-surface rounded-lg border border-border">
          <p className="text-sm text-text-muted mb-1">总相册数</p>
          <p className="text-2xl font-bold">{totalAlbums}</p>
        </div>
        <div className="p-4 bg-surface rounded-lg border border-border">
          <p className="text-sm text-text-muted mb-1">已启用 AI 修图</p>
          <p className="text-2xl font-bold">{currentEnabledCount}</p>
          <p className="text-xs text-text-muted mt-1">
            {totalAlbums > 0 ? `${Math.round((currentEnabledCount / totalAlbums) * 100)}%` : '0%'}
          </p>
        </div>
      </div>

      {/* 全局开关 */}
      <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
        <div className="flex-1 pr-4">
          <p className="font-medium flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-purple-500" />
            全局 AI 修图设置
          </p>
          <p className="text-sm text-text-secondary">
            {isEnabled
              ? `当前已为 ${currentEnabledCount} 个相册启用 AI 修图。点击开关可一键关闭所有相册的 AI 修图功能。`
              : `当前所有相册的 AI 修图功能已关闭。点击开关可一键为所有相册启用 AI 修图功能。`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleToggle(!isEnabled)}
          disabled={loading || allAlbumIds.length === 0}
          className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
            isEnabled ? 'bg-purple-500' : 'bg-surface-elevated'
          } ${loading || allAlbumIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} w-12 h-7 md:w-11 md:h-6`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
              isEnabled ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
            }`} />
          )}
        </button>
      </div>

      {/* 提示信息 */}
      {allAlbumIds.length === 0 && (
        <div className="p-3 bg-surface-elevated rounded-lg border border-border flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-sm text-text-secondary">
            当前没有可操作的相册。请先创建相册后再进行全局设置。
          </p>
        </div>
      )}
    </div>
  )
}
