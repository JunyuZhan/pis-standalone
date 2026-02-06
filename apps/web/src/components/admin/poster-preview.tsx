'use client'

import { useRef, useEffect, useState } from 'react'
import type { PosterStyle } from '@/lib/poster-generator'
import { cn } from '@/lib/utils'

interface PosterPreviewProps {
  style: PosterStyle
  title?: string
  description?: string
  backgroundImage?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * 海报实时预览组件
 * 使用 Canvas 渲染真实的海报效果
 */
export function PosterPreview({
  style,
  title = '相册标题',
  description = '相册描述文字',
  backgroundImage,
  className,
  size = 'md',
}: PosterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)

  // 预览尺寸映射
  const sizeMap = {
    sm: { width: 160, height: 200 },
    md: { width: 240, height: 300 },
    lg: { width: 360, height: 450 },
  }

  const { width, height } = sizeMap[size]
  const scale = width / 1080 // 基于 1080px 宽度的缩放比例

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = async () => {
      setLoading(true)

      // 清除画布
      ctx.clearRect(0, 0, width, height)

      // 绘制背景
      if (backgroundImage) {
        try {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = backgroundImage
          })
          
          // 计算裁剪区域（居中裁剪）
          const imgRatio = img.width / img.height
          const canvasRatio = width / height
          
          let sx = 0, sy = 0, sw = img.width, sh = img.height
          
          if (imgRatio > canvasRatio) {
            sw = img.height * canvasRatio
            sx = (img.width - sw) / 2
          } else {
            sh = img.width / canvasRatio
            sy = (img.height - sh) / 2
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
        } catch {
          // 图片加载失败，使用渐变背景
          drawGradientBackground(ctx, width, height)
        }
      } else {
        // 没有背景图，使用渐变背景
        drawGradientBackground(ctx, width, height)
      }

      // 绘制遮罩层
      const overlayOpacity = style.overlayOpacity ?? 0.4
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`
      ctx.fillRect(0, 0, width, height)

      // 设置文字样式
      const titleFontSize = Math.round((style.titleFontSize ?? 48) * scale)
      const descFontSize = Math.round((style.descriptionFontSize ?? 28) * scale)
      
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // 计算文字位置
      let textY: number
      switch (style.layout) {
        case 'top':
          textY = height * 0.2
          break
        case 'bottom':
          textY = height * 0.55
          break
        default: // centered
          textY = height * 0.4
      }

      // 绘制标题
      ctx.font = `bold ${titleFontSize}px "Noto Serif SC", serif`
      ctx.fillStyle = style.titleColor ?? '#FFFFFF'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 4 * scale
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 2 * scale
      ctx.fillText(title, width / 2, textY)

      // 绘制描述
      ctx.font = `${descFontSize}px "Noto Serif SC", sans-serif`
      ctx.fillStyle = style.descriptionColor ?? '#FFFFFF'
      ctx.shadowBlur = 2 * scale
      ctx.fillText(description, width / 2, textY + titleFontSize + 8 * scale)

      // 重置阴影
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      // 绘制二维码占位符
      const qrSize = Math.round((style.qrSize ?? 280) * scale * 0.4)
      let qrX: number
      const qrY = height - qrSize - 16 * scale

      switch (style.qrPosition) {
        case 'bottom-left':
          qrX = 16 * scale
          break
        case 'bottom-right':
          qrX = width - qrSize - 16 * scale
          break
        default: // bottom-center
          qrX = (width - qrSize) / 2
      }

      // 绘制二维码背景
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(qrX, qrY, qrSize, qrSize)
      
      // 绘制简单的二维码图案（模拟）
      ctx.fillStyle = '#000000'
      const cellSize = qrSize / 7
      const pattern = [
        [1, 1, 1, 0, 1, 1, 1],
        [1, 0, 1, 0, 1, 0, 1],
        [1, 1, 1, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 1, 1, 1],
        [1, 0, 1, 0, 1, 0, 1],
        [1, 1, 1, 0, 1, 1, 1],
      ]
      
      pattern.forEach((row, i) => {
        row.forEach((cell, j) => {
          if (cell) {
            ctx.fillRect(qrX + j * cellSize, qrY + i * cellSize, cellSize, cellSize)
          }
        })
      })

      setLoading(false)
    }

    render()
  }, [style, title, description, backgroundImage, width, height, scale])

  return (
    <div className={cn('relative rounded-lg overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-auto"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

/**
 * 绘制渐变背景
 */
function drawGradientBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#1a1a2e')
  gradient.addColorStop(0.5, '#16213e')
  gradient.addColorStop(1, '#0f3460')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

interface PosterTemplatePreviewProps {
  presetName: string
  preset: PosterStyle
  selected?: boolean
  onClick?: () => void
}

/**
 * 海报模板预览卡片
 */
export function PosterTemplatePreview({
  presetName,
  preset,
  selected,
  onClick,
}: PosterTemplatePreviewProps) {
  // 预设名称翻译
  const nameMap: Record<string, { name: string; desc: string }> = {
    classic: { name: '经典', desc: '居中布局，白色文字' },
    minimal: { name: '简约', desc: '顶部布局，高对比度' },
    elegant: { name: '优雅', desc: '底部布局，柔和色调' },
    business: { name: '商务', desc: '居中布局，专业配色' },
  }

  const { name, desc } = nameMap[presetName] ?? { name: presetName, desc: '' }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg border-2 transition-colors text-left',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border hover:border-accent/50'
      )}
    >
      <PosterPreview
        style={preset}
        size="sm"
        className="mb-2"
      />
      <div className="font-medium text-sm">{name}</div>
      <div className="text-xs text-text-muted mt-0.5">{desc}</div>
    </button>
  )
}
