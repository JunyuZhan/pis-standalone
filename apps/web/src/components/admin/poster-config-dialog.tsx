'use client'

import { useState } from 'react'
import { X, Sparkles, Eye } from 'lucide-react'
import type { PosterStyle } from '@/lib/poster-generator'
import { POSTER_PRESETS, validateAndLimitStyle } from '@/lib/poster-generator'
import { cn } from '@/lib/utils'
import { PosterPreview, PosterTemplatePreview } from './poster-preview'

interface PosterConfigDialogProps {
  open: boolean
  onClose: () => void
  style: PosterStyle
  onStyleChange: (style: PosterStyle) => void
  onPreview: () => void
  onGenerate: () => void
  generating: boolean
  albumTitle?: string
  albumDescription?: string
  coverImage?: string
}

export function PosterConfigDialog({
  open,
  onClose,
  style,
  onStyleChange,
  onPreview,
  onGenerate,
  generating,
  albumTitle = '相册标题',
  albumDescription = '相册描述',
  coverImage,
}: PosterConfigDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showLivePreview, setShowLivePreview] = useState(false)

  if (!open) return null

  const updateStyle = (updates: Partial<PosterStyle>) => {
    const newStyle = { ...style, ...updates }
    // 应用验证和限制
    const validatedStyle = validateAndLimitStyle(newStyle)
    onStyleChange(validatedStyle)
  }

  const applyPreset = (presetName: string) => {
    const preset = POSTER_PRESETS[presetName]
    if (preset) {
      setSelectedPreset(presetName)
      onStyleChange(preset)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">海报样式设置</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLivePreview(!showLivePreview)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                showLivePreview
                  ? 'bg-accent text-white'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              )}
            >
              <Eye className="w-4 h-4" />
              实时预览
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface-elevated rounded transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex">
          {/* 左侧：设置面板 */}
          <div className={cn(
            "p-6 space-y-6 overflow-y-auto",
            showLivePreview ? "w-1/2 border-r border-border" : "w-full"
          )}>
            {/* 预设模板 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                <Sparkles className="w-4 h-4 inline mr-1" />
                快速选择模板
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(POSTER_PRESETS).map(([name, preset]) => (
                  <PosterTemplatePreview
                    key={name}
                    presetName={name}
                    preset={preset}
                    selected={selectedPreset === name}
                    onClick={() => applyPreset(name)}
                  />
                ))}
              </div>
              <p className="text-xs text-text-muted mt-2">
                选择模板后可以继续自定义调整
              </p>
            </div>

          {/* 布局选项 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              布局样式
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['centered', 'top', 'bottom'] as const).map((layout) => (
                <button
                  key={layout}
                  type="button"
                  onClick={() => updateStyle({ layout })}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-colors',
                    style.layout === layout
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-accent/50'
                  )}
                >
                  <div className="text-sm font-medium mb-1">
                    {layout === 'centered' ? '居中' : layout === 'top' ? '顶部' : '底部'}
                  </div>
                  <div className="text-xs text-text-muted">
                    {layout === 'centered' ? '标题居中显示' : layout === 'top' ? '标题靠上显示' : '标题靠下显示'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 颜色选项 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                标题颜色
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={style.titleColor || '#FFFFFF'}
                  onChange={(e) => updateStyle({ titleColor: e.target.value })}
                  className="w-12 h-10 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={style.titleColor || '#FFFFFF'}
                  onChange={(e) => updateStyle({ titleColor: e.target.value })}
                  className="flex-1 input text-sm"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                描述颜色
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={style.descriptionColor || '#FFFFFF'}
                  onChange={(e) => updateStyle({ descriptionColor: e.target.value })}
                  className="w-12 h-10 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={style.descriptionColor || '#FFFFFF'}
                  onChange={(e) => updateStyle({ descriptionColor: e.target.value })}
                  className="flex-1 input text-sm"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>

          {/* 字体大小 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                标题字体大小: {style.titleFontSize || 48}px
              </label>
              <input
                type="range"
                min="32"
                max="72"
                value={style.titleFontSize || 48}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  updateStyle({ titleFontSize: value })
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>较小</span>
                <span>推荐: 48-56px</span>
                <span>较大</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                描述字体大小: {style.descriptionFontSize || 28}px
              </label>
              <input
                type="range"
                min="18"
                max="40"
                value={style.descriptionFontSize || 28}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  updateStyle({ descriptionFontSize: value })
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>较小</span>
                <span>推荐: 24-30px</span>
                <span>较大</span>
              </div>
            </div>
          </div>

          {/* 遮罩透明度 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              背景遮罩透明度: {Math.round((style.overlayOpacity || 0.4) * 100)}%
            </label>
            <input
              type="range"
              min="20"
              max="80"
              value={(style.overlayOpacity || 0.4) * 100}
              onChange={(e) => {
                const value = Math.max(20, Math.min(80, parseInt(e.target.value))) / 100
                updateStyle({ overlayOpacity: value })
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>较亮</span>
              <span>推荐: 40-50%</span>
              <span>较暗</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              调整遮罩透明度以平衡背景图片和文字可读性
            </p>
          </div>

          {/* 二维码位置 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              二维码位置
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['bottom-center', 'bottom-left', 'bottom-right'] as const).map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => updateStyle({ qrPosition: position })}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-colors',
                    style.qrPosition === position
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-accent/50'
                  )}
                >
                  <div className="text-sm font-medium">
                    {position === 'bottom-center' ? '底部居中' : position === 'bottom-left' ? '底部左侧' : '底部右侧'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 二维码大小 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              二维码大小: {style.qrSize || 280}px
            </label>
            <input
              type="range"
              min="200"
              max="400"
              step="20"
              value={style.qrSize || 280}
              onChange={(e) => updateStyle({ qrSize: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          </div>

          {/* 右侧：实时预览面板 */}
          {showLivePreview && (
            <div className="w-1/2 p-6 flex flex-col items-center justify-center bg-surface">
              <h3 className="text-sm font-medium text-text-secondary mb-4">实时预览</h3>
              <PosterPreview
                style={style}
                title={albumTitle}
                description={albumDescription}
                backgroundImage={coverImage}
                size="lg"
                className="shadow-xl"
              />
              <p className="text-xs text-text-muted mt-4 text-center">
                预览效果仅供参考，实际海报会使用相册封面作为背景
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 p-4 border-t border-border">
          <button
            type="button"
            onClick={onPreview}
            className="flex-1 btn-secondary"
          >
            预览
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="flex-1 btn-primary"
          >
            {generating ? '生成中...' : '生成海报'}
          </button>
        </div>
      </div>
    </div>
  )
}
