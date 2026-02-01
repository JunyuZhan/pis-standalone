'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Eye, EyeOff, Lock, Calendar, Download, Radio, Share2 } from 'lucide-react'
import type { Database } from '@/types/database'
import { MultiWatermarkManager, type WatermarkItem } from './multi-watermark-manager'
import { StylePresetSelector } from './style-preset-selector'
import { StorageChecker } from './storage-checker'
import { showSuccess, handleApiError } from '@/lib/toast'

type Album = Database['public']['Tables']['albums']['Row']

interface AlbumSettingsFormProps {
  album: Album
  coverOriginalKey?: string | null  // 封面照片的原图 key（用于风格预设预览）
}

export function AlbumSettingsForm({ album, coverOriginalKey }: AlbumSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // 获取默认水印配置（用于初始化）
  const getDefaultWatermarkConfig = () => {
    const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'
    return {
      watermarks: [{
        id: 'watermark-1',
        type: 'text' as const,
        text: `© ${photographerName}`,
        logoUrl: undefined,
        opacity: 0.5,
        position: 'bottom-right',
        margin: 5,
        enabled: true,
      }],
    }
  }

  // 解析水印配置（兼容旧格式和新格式）
  const parseWatermarkConfig = (config: Database['public']['Tables']['albums']['Row']['watermark_config'], watermarkEnabled: boolean) => {
    if (!config) {
      // 如果已启用水印但没有配置，返回默认配置
      if (watermarkEnabled) {
        return getDefaultWatermarkConfig()
      }
      return { watermarks: [] }
    }

    // 新格式：包含 watermarks 数组
    if (config && typeof config === 'object' && 'watermarks' in config && Array.isArray(config.watermarks)) {
      // 如果已启用水印但水印数组为空，返回默认配置
      if (watermarkEnabled && config.watermarks.length === 0) {
        return getDefaultWatermarkConfig()
      }
      const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'
      return {
        watermarks: config.watermarks.map((w: unknown, index: number) => {
          const watermark = w as Record<string, unknown>
          // 如果文字水印的 text 为空，使用默认文字
          const watermarkType = (watermark.type as 'text' | 'logo') || 'text'
          const watermarkText = watermark.text as string
          const defaultText = `© ${photographerName}`
          
          return {
            id: (watermark.id as string) || `watermark-${index + 1}`,
            type: watermarkType,
            text: watermarkType === 'text' && (!watermarkText || watermarkText.trim() === '') ? defaultText : watermarkText,
            logoUrl: watermark.logoUrl as string | undefined,
            opacity: (watermark.opacity as number) ?? 0.5,
            position: (watermark.position as string) || 'bottom-right',
            size: watermark.size as number | undefined,
            margin: watermark.margin !== undefined ? (watermark.margin as number) : 5,
            enabled: (watermark.enabled as boolean) !== false,
          }
        }),
      }
    }

    // 旧格式：单个水印配置
    const oldConfig = config as Record<string, unknown>
    return {
      watermarks: [{
        id: 'watermark-1',
        type: (oldConfig.type as 'text' | 'logo') || 'text',
        text: oldConfig.text as string,
        logoUrl: oldConfig.logoUrl as string | undefined,
        opacity: (oldConfig.opacity as number) ?? 0.5,
        position: (oldConfig.position as string) || 'bottom-right',
        margin: oldConfig.margin !== undefined ? (oldConfig.margin as number) : 5,
        enabled: true,
      }],
    }
  }

  const initialWatermarkConfig = parseWatermarkConfig(album.watermark_config, album.watermark_enabled ?? false)
  
  // 解析调色配置
  const initialColorGrading = album.color_grading as { preset?: string } | null
  const initialStylePresetId = initialColorGrading?.preset || null

  const [formData, setFormData] = useState({
    title: album.title,
    description: album.description || '',
    event_date: album.event_date ? new Date(album.event_date).toISOString().slice(0, 16) : '',
    location: album.location || '',
    is_public: album.is_public ?? false,
    is_live: album.is_live ?? false,
    // 访问控制
    password: album.password || '',
    expires_at: album.expires_at ? new Date(album.expires_at).toISOString().slice(0, 16) : '',
    // 布局设置
    layout: album.layout || 'masonry',
    sort_rule: album.sort_rule || 'capture_desc',
    // 功能开关
    allow_download: album.allow_download ?? false,
    allow_batch_download: album.allow_batch_download ?? false,
    show_exif: album.show_exif ?? true,
    allow_share: album.allow_share ?? true,
    // 水印设置
    watermark_enabled: album.watermark_enabled ?? false,
    watermark_config: initialWatermarkConfig,
    // 分享配置
    share_title: album.share_title || '',
    share_description: album.share_description || '',
    share_image_url: album.share_image_url || '',
    // 海报配置
    poster_image_url: album.poster_image_url || '',
    // 调色配置
    color_grading: initialStylePresetId,
  })

  // 获取默认水印配置（单个水印对象）
  const getDefaultWatermark = (): WatermarkItem => {
    const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'
    // 使用 crypto.randomUUID() 生成稳定的 ID，避免 hydration mismatch
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
      }
      // 后备方案：使用时间戳 + 随机数（仅在客户端）
      return `watermark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    return {
      id: generateId(),
      type: 'text' as const,
      text: `© ${photographerName}`,
      logoUrl: undefined,
      opacity: 0.5,
      position: 'bottom-right',
      margin: 5,
      enabled: true,
    }
  }

  const handleChange = (field: string, value: string | boolean | number | Record<string, unknown> | null) => {
    setFormData((prev) => {
      // 如果启用水印开关，且当前没有水印配置或水印文字为空，自动添加/更新默认水印
      if (field === 'watermark_enabled' && value === true) {
        const currentWatermarks = prev.watermark_config?.watermarks || []
        const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'
        const defaultText = `© ${photographerName}`
        
        if (currentWatermarks.length === 0) {
          // 没有水印，添加默认水印
          return {
            ...prev,
            [field]: value,
            watermark_config: {
              watermarks: [getDefaultWatermark()],
            } as typeof prev.watermark_config,
          }
        } else {
          // 有水印但文字为空，填充默认文字
          const updatedWatermarks: WatermarkItem[] = currentWatermarks.map((wm) => {
            if (wm.type === 'text' && (!wm.text || wm.text.trim() === '')) {
              return { ...wm, text: defaultText }
            }
            return wm
          })
          
          // 如果更新了水印，返回更新后的配置
          if (JSON.stringify(updatedWatermarks) !== JSON.stringify(currentWatermarks)) {
            return {
              ...prev,
              [field]: value,
              watermark_config: {
                watermarks: updatedWatermarks,
              } as typeof prev.watermark_config,
            }
          }
        }
      }
      return { ...prev, [field]: value }
    })
  }

  // handleWatermarkConfigChange removed as it's not used

  const handleWatermarksChange = (watermarks: WatermarkItem[]) => {
    setFormData((prev) => ({
      ...prev,
      watermark_config: { watermarks } as typeof prev.watermark_config,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 准备提交数据，将 watermarks 数组转换为正确的格式
      // 如果启用了水印，但水印配置为空或无效，自动关闭水印
      let watermarkConfig = {}
      let watermarkEnabled = formData.watermark_enabled
      
      if (formData.watermark_enabled) {
        const watermarks = formData.watermark_config?.watermarks || []
        
        // 检查是否有有效的水印配置
        const validWatermarks = watermarks.filter((wm) => {
          if (wm.type === 'text') {
            return wm.text && typeof wm.text === 'string' && wm.text.trim() !== ''
          } else if (wm.type === 'logo') {
            return wm.logoUrl && typeof wm.logoUrl === 'string' && wm.logoUrl.trim() !== ''
          }
          return false
        })
        
        if (validWatermarks.length > 0) {
          watermarkConfig = { watermarks: validWatermarks }
        } else {
          // 如果没有有效的水印配置，自动关闭水印
          watermarkEnabled = false
          watermarkConfig = {}
        }
      }
      
      // 准备调色配置
      const colorGrading = formData.color_grading 
        ? { preset: formData.color_grading } 
        : null
      
      const submitData = {
        ...formData,
        watermark_enabled: watermarkEnabled,
        event_date: formData.event_date && formData.event_date.trim() ? formData.event_date : null,
        expires_at: formData.expires_at && formData.expires_at.trim() ? formData.expires_at : null,
        location: formData.location.trim() || null,
        // 分享配置：空字符串转换为 null
        share_title: formData.share_title.trim() || null,
        share_description: formData.share_description.trim() || null,
        share_image_url: formData.share_image_url.trim() || null,
        // 海报配置：空字符串转换为 null
        poster_image_url: formData.poster_image_url.trim() || null,
        watermark_config: watermarkConfig,
        color_grading: colorGrading,  // 新增：调色配置
      }

      const response = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error?.message || '保存失败'
        console.error('Save failed:', errorData)
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      // 如果相册已有照片，询问是否重新处理
      const colorGradingChanged = JSON.stringify(initialColorGrading) !== JSON.stringify(colorGrading)
      if (album.photo_count > 0 && colorGradingChanged) {
        const shouldReprocess = window.confirm(
          `相册中有 ${album.photo_count} 张照片，是否重新处理以应用新的调色配置？\n\n` +
          `选择"确定"：所有照片将应用新的调色配置（后台处理，约 1-3 分钟）\n` +
          `选择"取消"：仅对新上传的照片生效`
        )
        
        if (shouldReprocess) {
          // 触发重新处理任务
          try {
            const reprocessRes = await fetch(`/api/admin/albums/${album.id}/reprocess`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apply_color_grading: true })
            })
            
            if (reprocessRes.ok) {
              showSuccess('调色配置已保存，照片正在后台重新处理...')
            } else {
              showSuccess('调色配置已保存，但重新处理失败，请稍后手动重新处理')
            }
          } catch (error) {
            console.error('Reprocess error:', error)
            showSuccess('调色配置已保存，但重新处理失败，请稍后手动重新处理')
          }
        } else {
          showSuccess('调色配置已保存，将应用于新上传的照片')
        }
      } else {
        showSuccess(result.message || '设置已保存')
      }
      
      router.refresh()
    } catch (error) {
      console.error('Save error:', error)
      handleApiError(error, '保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 基本信息 */}
      <section className="card space-y-4">
        <h2 className="text-lg font-medium">基本信息</h2>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            相册标题
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            相册描述
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="input min-h-[100px] resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              活动时间
            </label>
            <input
              type="datetime-local"
              value={formData.event_date}
              onChange={(e) => handleChange('event_date', e.target.value)}
              className="input"
            />
            <p className="text-xs text-text-muted mt-1">实际活动日期（可选）</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              活动地点
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="input"
              placeholder="例如：北京国际会议中心"
            />
            <p className="text-xs text-text-muted mt-1">活动举办地点（可选）</p>
          </div>
        </div>
      </section>

      {/* 访问控制 */}
      <section className="card space-y-6">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Lock className="w-5 h-5 text-accent" />
          访问控制
        </h2>
        
        {/* 访问密码 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            访问密码（可选）
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="留空则无需密码"
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1">设置密码后，访客需要输入密码才能查看相册</p>
        </div>

        {/* 到期时间 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            到期时间（可选）
          </label>
          <input
            type="datetime-local"
            value={formData.expires_at}
            onChange={(e) => handleChange('expires_at', e.target.value)}
            className="input"
          />
          <p className="text-xs text-text-muted mt-1">到期后相册将无法访问，留空则永不过期</p>
        </div>
      </section>

      {/* 显示设置 */}
      <section className="card space-y-6">
        <h2 className="text-lg font-medium">显示设置</h2>
        
        {/* 公开状态 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium">公开相册</p>
            <p className="text-sm text-text-secondary">在首页广场展示此相册</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('is_public', !formData.is_public)}
            className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
              formData.is_public ? 'bg-accent' : 'bg-surface-elevated'
            } w-12 h-7 md:w-11 md:h-6`}
          >
            <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
              formData.is_public ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 直播模式 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500" />
              直播模式
            </p>
            <p className="text-sm text-text-secondary">开启后相册页面显示「直播中」标签</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('is_live', !formData.is_live)}
            className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
              formData.is_live ? 'bg-red-500' : 'bg-surface-elevated'
            } w-12 h-7 md:w-11 md:h-6`}
          >
            <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
              formData.is_live ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 允许下载 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium">允许下载原图</p>
            <p className="text-sm text-text-secondary">访客可下载原始高清图片</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('allow_download', !formData.allow_download)}
            className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
              formData.allow_download ? 'bg-accent' : 'bg-surface-elevated'
            } w-12 h-7 md:w-11 md:h-6`}
          >
            <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
              formData.allow_download ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 批量下载 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium flex items-center gap-2">
              <Download className="w-4 h-4" />
              允许批量下载
            </p>
            <p className="text-sm text-text-secondary">访客可一键下载所有已选照片</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('allow_batch_download', !formData.allow_batch_download)}
            className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
              formData.allow_batch_download ? 'bg-accent' : 'bg-surface-elevated'
            } w-12 h-7 md:w-11 md:h-6`}
          >
            <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
              formData.allow_batch_download ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 显示 EXIF */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium">显示 EXIF 信息</p>
            <p className="text-sm text-text-secondary">展示相机参数（光圈、快门等）</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('show_exif', !formData.show_exif)}
            className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
              formData.show_exif ? 'bg-accent' : 'bg-surface-elevated'
            } w-12 h-7 md:w-11 md:h-6`}
          >
            <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
              formData.show_exif ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 允许分享 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-medium flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              允许分享
            </p>
            <p className="text-sm text-text-secondary">关闭后，分享链接将无法访问此相册</p>
          </div>
          <button
            type="button"
            onClick={() => handleChange('allow_share', !formData.allow_share)}
            className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
              formData.allow_share ? 'bg-accent' : 'bg-surface-elevated'
            } w-12 h-7 md:w-11 md:h-6`}
          >
            <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
              formData.allow_share ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* 布局模式 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            默认布局
          </label>
          <select
            value={formData.layout}
            onChange={(e) => handleChange('layout', e.target.value)}
            className="input"
          >
            <option value="masonry">瀑布流 (Masonry)</option>
            <option value="grid">网格 (Grid)</option>
            <option value="carousel">轮播 (Carousel)</option>
          </select>
        </div>

        {/* 排序规则 */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            默认排序
          </label>
          <select
            value={formData.sort_rule}
            onChange={(e) => handleChange('sort_rule', e.target.value)}
            className="input"
          >
            <option value="capture_desc">拍摄时间倒序 (最新在前)</option>
            <option value="capture_asc">拍摄时间正序 (最旧在前)</option>
            <option value="manual">手动排序</option>
          </select>
        </div>
      </section>

      {/* 水印配置 */}
      <section className="card space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-medium">水印设置</h2>
            <p className="text-sm text-text-muted mt-1">
              为相册照片添加水印保护
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleWatermarksChange([getDefaultWatermark()])
                handleChange('watermark_enabled', true)
              }}
              className="btn-secondary text-xs md:text-xs px-4 py-2.5 md:px-3 md:py-1.5 min-h-[44px] md:min-h-0"
              title="重置为默认水印配置（右下角文字水印）"
            >
              重置默认水印
            </button>
            <button
              type="button"
              onClick={() => handleChange('watermark_enabled', !formData.watermark_enabled)}
              className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
                formData.watermark_enabled ? 'bg-accent' : 'bg-surface-elevated'
              } w-12 h-7 md:w-11 md:h-6`}
            >
              <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
                formData.watermark_enabled ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {formData.watermark_enabled && (
          <div className="pt-4 border-t border-border">
            <MultiWatermarkManager
              watermarks={formData.watermark_config.watermarks || []}
              onChange={handleWatermarksChange}
            />
          </div>
        )}
      </section>

      {/* 风格设置 */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-medium">风格设置</h2>
          <p className="text-sm text-text-muted mt-1">
            为相册选择调色风格，所有照片将应用统一的视觉风格
          </p>
        </div>
        
        <StylePresetSelector
          value={formData.color_grading as string | null}
          onChange={(presetId) => handleChange('color_grading', presetId)}
          previewImage={
            // 使用封面照片的原图作为预览图片（未应用风格预设，才能正确预览不同风格效果）
            coverOriginalKey && process.env.NEXT_PUBLIC_MEDIA_URL
              ? `${process.env.NEXT_PUBLIC_MEDIA_URL.replace(/\/$/, '')}/${coverOriginalKey.replace(/^\//, '')}`
              : undefined
          }
        />
        
        {album.photo_count > 0 && (
          <div className="p-3 bg-surface-elevated rounded-lg text-sm text-text-muted">
            <p>
              💡 相册中有 {album.photo_count} 张照片。切换风格后，系统会询问是否重新处理所有照片。
            </p>
          </div>
        )}
      </section>

      {/* 分享配置 */}
      <section className="card space-y-6">
        <h2 className="text-lg font-medium">分享设置</h2>
        <p className="text-sm text-text-muted">
          自定义分享到微信、朋友圈等社交平台时显示的卡片信息
        </p>

        <div className="space-y-4 pt-4 border-t border-border">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              分享标题
            </label>
            <input
              type="text"
              value={formData.share_title}
              onChange={(e) => handleChange('share_title', e.target.value)}
              className="input"
              placeholder={album.title}
            />
            <p className="text-xs text-text-muted mt-1">
              留空则使用相册标题
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              分享描述
            </label>
            <textarea
              value={formData.share_description}
              onChange={(e) => handleChange('share_description', e.target.value)}
              className="input min-h-[80px] resize-none"
              placeholder={album.description || '查看精彩照片'}
            />
            <p className="text-xs text-text-muted mt-1">
              留空则使用相册描述或默认文案
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              分享图片 URL
            </label>
            <input
              type="url"
              value={formData.share_image_url}
              onChange={(e) => handleChange('share_image_url', e.target.value)}
              className="input"
              placeholder="https://example.com/share-image.jpg"
            />
            <p className="text-xs text-text-muted mt-1">
              建议尺寸：1200x630px。留空则使用相册封面图
            </p>
          </div>
        </div>
      </section>

      {/* 海报配置 */}
      <section className="card space-y-4">
        <h2 className="text-lg font-medium">海报设置</h2>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            相册海报图片 URL
          </label>
          <input
            type="url"
            value={formData.poster_image_url}
            onChange={(e) => handleChange('poster_image_url', e.target.value)}
            className="input"
            placeholder="https://example.com/poster.jpg"
          />
          <p className="text-xs text-text-muted mt-1">
            <span className="font-medium text-text-primary">启动页功能：</span>设置后，用户通过分享链接打开相册时会首先看到全屏启动页（海报图片）。
            <br />
            同时用于相册列表和详情页展示，优先于封面照片。留空则使用封面照片，且不会显示启动页。
            <br />
            <span className="text-text-muted/80 mt-1 block">
              提示：也可以使用「分享」功能中的「生成海报」来创建包含二维码的动态海报。
            </span>
          </p>
        </div>
      </section>

      {/* 存储检查 */}
      <section className="card space-y-4">
        <StorageChecker albumId={album.id} />
      </section>

      {/* 提交按钮 */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex items-center gap-2 min-w-[120px] justify-center"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存设置
        </button>
      </div>
    </form>
  )
}
