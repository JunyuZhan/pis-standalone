'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { getStylePresetCSSFilter } from '@/lib/style-preset-utils'

export interface StylePreset {
  id: string
  name: string
  category: 'portrait' | 'landscape' | 'general'
  description: string
  cssFilter?: string
}

interface StylePresetSelectorProps {
  value: string | null  // 预设 ID 或 null（无风格）
  onChange: (presetId: string | null) => void
  previewImage?: string  // 用于预览的示例图片 URL
  className?: string
}

export function StylePresetSelector({
  value,
  onChange,
  previewImage,
  className = '',
}: StylePresetSelectorProps) {
  const [presets, setPresets] = useState<StylePreset[]>([])
  const [loading, setLoading] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false)

  // 加载预设列表
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const res = await fetch('/api/admin/style-presets', {
          cache: 'no-store', // 禁用缓存，确保获取最新数据
        })
        const data = await res.json()
        if (res.ok) {
          setPresets(data.data?.presets || [])
        }
      } catch (error) {
        console.error('加载预设列表失败:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPresets()
  }, [])

  // 按分类分组预设
  const presetsByCategory = useMemo(() => {
    const portrait = presets.filter(p => p.category === 'portrait')
    const landscape = presets.filter(p => p.category === 'landscape')
    const general = presets.filter(p => p.category === 'general')
    return { portrait, landscape, general }
  }, [presets])

  // 获取当前选择的预设 CSS 滤镜
  const currentFilter = useMemo(() => {
    const filter = getStylePresetCSSFilter(value ? { preset: value } : null)
    return filter
  }, [value])

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-sm text-text-muted">加载预设列表...</div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 无风格选项 */}
      <div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`w-full p-4 rounded-lg border-2 transition-all text-left min-h-[44px] active:scale-[0.98] touch-manipulation ${
            value === null
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 active:bg-surface-elevated'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">无风格</div>
              <div className="text-sm text-text-muted mt-1">保持原始色彩</div>
            </div>
            {value === null && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </div>
        </button>
      </div>

      {/* 人物风格 */}
      {presetsByCategory.portrait.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">人物风格</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {presetsByCategory.portrait.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={value === preset.id}
                onSelect={() => onChange(preset.id)}
                previewImage={previewImage}
              />
            ))}
          </div>
        </div>
      )}

      {/* 风景风格 */}
      {presetsByCategory.landscape.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">风景风格</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {presetsByCategory.landscape.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={value === preset.id}
                onSelect={() => onChange(preset.id)}
                previewImage={previewImage}
              />
            ))}
          </div>
        </div>
      )}

      {/* 通用风格 */}
      {presetsByCategory.general.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">通用风格</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {presetsByCategory.general.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={value === preset.id}
                onSelect={() => onChange(preset.id)}
                previewImage={previewImage}
              />
            ))}
          </div>
        </div>
      )}

      {/* 实时预览 */}
      {previewImage && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">实时预览</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="text-xs text-text-muted mb-2">原图</div>
              <div
                className="relative aspect-video bg-surface rounded-lg overflow-hidden border border-border touch-manipulation select-none"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
                role="button"
                tabIndex={0}
                aria-label="长按查看原图"
              >
                <Image
                  src={previewImage}
                  alt="原图"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                  unoptimized
                />
                {showOriginal && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    原图
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted mb-2">调色后</div>
              <div className="relative aspect-video bg-surface rounded-lg overflow-hidden border border-border">
                <Image
                  src={previewImage}
                  alt="调色后"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                  style={{
                    filter: currentFilter,
                    transition: 'filter 0.2s ease-out',
                  }}
                  unoptimized
                />
                {value && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    {presets.find(p => p.id === value)?.name || '已选择'}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2 text-center sm:text-left">
            💡 长按左侧原图可对比效果
          </p>
        </div>
      )}
    </div>
  )
}

function PresetCard({
  preset,
  selected,
  onSelect,
  previewImage,
}: {
  preset: StylePreset
  selected: boolean
  onSelect: () => void
  previewImage?: string
}) {
  const presetFilter = preset.cssFilter || 'none'
  
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border-2 transition-all text-left active:scale-[0.98] touch-manipulation overflow-hidden w-full ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/50 active:bg-surface-elevated'
      }`}
    >
      {/* 垂直布局：预览图在上，名称和描述在下 */}
      <div className="flex flex-col">
        {/* 预览图 */}
        {previewImage ? (
          <div className="relative w-full aspect-square rounded-t overflow-hidden border-b border-border bg-surface">
            <Image
              src={previewImage}
              alt={preset.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              style={{
                filter: presetFilter,
                transition: 'filter 0.2s ease-out',
              }}
              unoptimized
            />
            {/* 选中标记 */}
            {selected && (
              <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                <Check className="w-3 h-3" />
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full aspect-square rounded-t bg-surface border-b border-border flex items-center justify-center">
            <div className="text-xs text-text-muted text-center px-2">无预览</div>
            {selected && (
              <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                <Check className="w-3 h-3" />
              </div>
            )}
          </div>
        )}
        
        {/* 名称和描述 */}
        <div className="p-2 space-y-0.5">
          <div className="font-medium text-xs truncate">{preset.name}</div>
          <div className="text-[10px] text-text-muted line-clamp-2 leading-tight">
            {preset.description}
          </div>
        </div>
      </div>
    </button>
  )
}
