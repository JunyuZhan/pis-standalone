'use client'

import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { showInfo } from '@/lib/toast'
import { WatermarkPreview } from './watermark-preview'

export interface WatermarkItem {
  id: string
  type: 'text' | 'logo'
  text?: string
  logoUrl?: string
  opacity: number
  position: string
  size?: number
  margin?: number // 边距（百分比，0-20，默认5）
  enabled?: boolean
}

interface MultiWatermarkManagerProps {
  watermarks: WatermarkItem[]
  onChange: (watermarks: WatermarkItem[]) => void
}

const POSITION_OPTIONS = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'center-left', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'center-right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '下中' },
  { value: 'bottom-right', label: '右下' },
]

export function MultiWatermarkManager({ watermarks, onChange }: MultiWatermarkManagerProps) {
  const addWatermark = () => {
    if (watermarks.length >= 6) {
      showInfo('最多支持6个水印')
      return
    }

    const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'
    const newWatermark: WatermarkItem = {
      id: `watermark-${Date.now()}`,
      type: 'text',
      text: `© ${photographerName}`,
      opacity: 0.5,
      position: 'center',
      size: 24, // 默认字体大小 24px
      margin: 5,
      enabled: true,
    }

    onChange([...watermarks, newWatermark])
  }

  const removeWatermark = (id: string) => {
    onChange(watermarks.filter(w => w.id !== id))
  }

  const updateWatermark = (id: string, updates: Partial<WatermarkItem>) => {
    onChange(
      watermarks.map(w => (w.id === id ? { ...w, ...updates } : w))
    )
  }

  const toggleWatermark = (id: string) => {
    updateWatermark(id, { enabled: !watermarks.find(w => w.id === id)?.enabled })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">多位置水印</p>
          <p className="text-sm text-text-muted">
            最多支持6个水印，可在不同位置同时显示
          </p>
        </div>
        <button
          type="button"
          onClick={addWatermark}
          disabled={watermarks.length >= 6}
          className="btn-secondary text-sm"
        >
          <Plus className="w-4 h-4" />
          添加水印
        </button>
      </div>

      {watermarks.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
          <p className="text-text-secondary mb-4">还没有添加水印</p>
          <button
            type="button"
            onClick={addWatermark}
            className="btn-secondary"
          >
            <Plus className="w-4 h-4" />
            添加第一个水印
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 左侧：水印预览 */}
          <div className="lg:w-80 shrink-0">
            <div className="card p-4 sticky top-4">
              <label className="block text-xs font-medium text-text-secondary mb-3">
                预览效果
              </label>
              <div className="flex justify-center">
                <div className="w-full max-w-[280px]">
                  <WatermarkPreview watermarks={watermarks} width={280} height={210} />
                </div>
              </div>
              <p className="text-xs text-text-muted mt-2 text-center">
                蓝色圆点标记水印位置，调整设置可实时查看效果
              </p>
            </div>
          </div>

          {/* 右侧：水印设置列表 */}
          <div className="flex-1 space-y-4">
            {watermarks.map((watermark, index) => (
            <div key={watermark.id} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-secondary">
                    水印 {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWatermark(watermark.id)}
                    className="p-1 hover:bg-surface-elevated rounded transition-colors"
                    title={watermark.enabled ? '禁用' : '启用'}
                  >
                    {watermark.enabled ? (
                      <Eye className="w-4 h-4 text-accent" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-text-muted" />
                    )}
                  </button>
                </div>
                {watermarks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWatermark(watermark.id)}
                    className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-end gap-3">
                {/* 类型 */}
                <div className="w-24 shrink-0">
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    类型
                  </label>
                  <select
                    value={watermark.type}
                    onChange={(e) => updateWatermark(watermark.id, { type: e.target.value as 'text' | 'logo' })}
                    className="input text-sm w-full h-9 px-2"
                  >
                    <option value="text">文字</option>
                    <option value="logo">Logo</option>
                  </select>
                </div>

                {/* 内容 (自适应宽度) */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {watermark.type === 'text' ? '内容' : 'Logo URL'}
                  </label>
                  <input
                    type={watermark.type === 'text' ? 'text' : 'url'}
                    value={watermark.type === 'text' ? watermark.text || '' : watermark.logoUrl || ''}
                    onChange={(e) => updateWatermark(watermark.id, watermark.type === 'text' ? { text: e.target.value } : { logoUrl: e.target.value })}
                    className="input text-sm w-full h-9 px-2"
                    placeholder={watermark.type === 'text' ? "© Name" : "https://..."}
                  />
                </div>

                {/* 位置 */}
                <div className="w-28 shrink-0">
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    位置
                  </label>
                  <select
                    value={watermark.position}
                    onChange={(e) => updateWatermark(watermark.id, { position: e.target.value })}
                    className="input text-sm w-full h-9 px-2"
                  >
                    {POSITION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 第二行：滑块控制 */}
              <div className="flex flex-col gap-3 pt-1">
                {/* 第一行：大小和边距 */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-text-secondary whitespace-nowrap w-16">
                      {watermark.type === 'text' ? '字体大小' : 'Logo大小'}
                    </span>
                    <input
                      type="range"
                      min={watermark.type === 'text' ? 12 : 20}
                      max={watermark.type === 'text' ? 72 : 200}
                      step={watermark.type === 'text' ? 2 : 5}
                      value={watermark.size || (watermark.type === 'text' ? 24 : 50)}
                      onChange={(e) =>
                        updateWatermark(watermark.id, { size: parseInt(e.target.value) })
                      }
                      className="w-full h-1.5 accent-accent"
                    />
                    <span className="text-xs text-text-secondary whitespace-nowrap w-10">
                      {watermark.size || (watermark.type === 'text' ? 24 : 50)}px
                    </span>
                  </div>
                  
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-text-secondary whitespace-nowrap w-12">
                      边距 {watermark.margin ?? 5}%
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={watermark.margin ?? 5}
                      onChange={(e) =>
                        updateWatermark(watermark.id, { margin: parseInt(e.target.value) })
                      }
                      className="w-full h-1.5 accent-accent"
                    />
                  </div>
                </div>
                
                {/* 第二行：透明度 */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-text-secondary whitespace-nowrap w-16">
                      透明度
                    </span>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={watermark.opacity || 0.5}
                      onChange={(e) =>
                        updateWatermark(watermark.id, { opacity: parseFloat(e.target.value) })
                      }
                      className="w-full h-1.5 accent-accent"
                    />
                    <span className="text-xs text-text-secondary whitespace-nowrap w-10">
                      {Math.round((watermark.opacity || 0.5) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
