'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Copy, Check, ChevronDown, ChevronUp, Download, Server } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { AlbumTemplate } from '@/types/database'
import { StylePresetSelector } from './style-preset-selector'
import { getFtpServerHost, getFtpServerPort } from '@/lib/utils'
import { showSuccess } from '@/lib/toast'

interface CreateAlbumDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAlbumDialog({ open, onOpenChange }: CreateAlbumDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [templateId, setTemplateId] = useState<string>('')
  const [templates, setTemplates] = useState<AlbumTemplate[]>([])
  const [stylePresetId, setStylePresetId] = useState<string | null>(null)
  const [showStyleSelector, setShowStyleSelector] = useState(false)
  const [presets, setPresets] = useState<Array<{ id: string; name: string }>>([])
  const [allowBatchDownload, setAllowBatchDownload] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{
    id: string
    slug: string
    shareUrl: string
    upload_token?: string
  } | null>(null)
  const [showFtpConfig, setShowFtpConfig] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      loadTemplates()
      loadPresets()
    }
  }, [open])

  const loadPresets = async () => {
    try {
      const res = await fetch('/api/admin/style-presets')
      const data = await res.json()
      if (res.ok) {
        setPresets(data.data?.presets || [])
      }
    } catch (error) {
      console.error('加载预设列表失败:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates')
      const data = await res.json()
      if (res.ok) {
        // API 返回格式是 { data: { templates: [...] } }
        setTemplates(data.data?.templates || data.templates || [])
      }
    } catch (error) {
      console.error('加载模板失败:', error)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('请输入相册标题')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 如果选择了模板，先获取模板配置
      let templateConfig = {}
      if (templateId) {
        const templateRes = await fetch(`/api/admin/templates/${templateId}`)
        if (templateRes.ok) {
          const templateData = await templateRes.json()
          // API 返回格式是 { data: {...} }
          const template = templateData.data || templateData
          templateConfig = {
            is_public: template.is_public,
            layout: template.layout,
            sort_rule: template.sort_rule,
            allow_download: template.allow_download,
            allow_batch_download: template.allow_batch_download,
            show_exif: template.show_exif,
            password: template.password,
            expires_at: template.expires_at,
            watermark_enabled: template.watermark_enabled,
            watermark_type: template.watermark_type,
            watermark_config: template.watermark_config,
            // 注意：模板目前不支持 color_grading，用户手动选择的风格优先
          }
        }
      }

      // 构建请求体
      const requestBody: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate || null,
        location: location.trim() || null,
        // 用户手动选择的风格优先于模板配置
        color_grading: stylePresetId ? { preset: stylePresetId } : null,
      }

      // 如果选择了模板，使用模板的配置；否则使用用户的选择
      if (templateId) {
        // 使用模板配置（模板配置已经包含了 allow_batch_download）
        Object.assign(requestBody, templateConfig)
      } else {
        // 使用用户手动选择的配置
        requestBody.allow_batch_download = allowBatchDownload
      }

      const res = await fetch('/api/admin/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || '创建失败')
        return
      }

      // API 返回格式是 { data: {...} }
      const createdData = data.data || data
      setCreated(createdData)
    } catch {
      setError('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (created?.shareUrl) {
      await navigator.clipboard.writeText(created.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    if (created) {
      router.push(`/admin/albums/${created.id}`)
      router.refresh()
    }
    setTitle('')
    setDescription('')
    setEventDate('')
    setLocation('')
    setTemplateId('')
    setStylePresetId(null)
    setShowStyleSelector(false)
    setAllowBatchDownload(false)
    setError('')
    setCreated(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="md:max-w-2xl lg:max-w-3xl">
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>新建相册</DialogTitle>
              <DialogDescription>
                创建一个新的相册来存放您的摄影作品
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  相册标题 <span className="text-red-400">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="例如：婚礼拍摄 - 张三李四"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  相册描述
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[80px] resize-none"
                  placeholder="可选的相册描述..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="eventDate"
                    className="block text-sm font-medium text-text-secondary mb-2"
                  >
                    活动时间
                  </label>
                  <input
                    id="eventDate"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="input"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    实际活动日期（可选）
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-text-secondary mb-2"
                  >
                    活动地点
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="input"
                    placeholder="例如：北京国际会议中心"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    活动举办地点（可选）
                  </p>
                </div>
              </div>


              {templates.length > 0 && (
                <div>
                  <label
                    htmlFor="template"
                    className="block text-sm font-medium text-text-secondary mb-2"
                  >
                    使用模板（可选）
                  </label>
                  <select
                    id="template"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="input"
                  >
                    <option value="">不使用模板</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-muted mt-1">
                    选择模板将自动应用模板的配置（布局、水印等）
                  </p>
                </div>
              )}

              {/* 批量下载设置（仅在未选择模板时显示） */}
              {!templateId && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface">
                  <div className="flex-1 pr-4">
                    <p className="font-medium flex items-center gap-2 text-sm">
                      <Download className="w-4 h-4" />
                      允许批量下载
                    </p>
                    <p className="text-xs text-text-secondary mt-1">访客可一键下载所有已选照片</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowBatchDownload(!allowBatchDownload)}
                    className={`relative rounded-full transition-colors shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center ${
                      allowBatchDownload ? 'bg-accent' : 'bg-surface-elevated'
                    } w-12 h-7 md:w-11 md:h-6`}
                  >
                    <div className={`absolute top-[2px] left-[2px] w-6 h-6 md:w-5 md:h-5 bg-white rounded-full transition-transform ${
                      allowBatchDownload ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              )}

              {/* 风格设置（可选） */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowStyleSelector(!showStyleSelector)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors min-h-[44px] active:scale-[0.98] touch-manipulation active:bg-surface-elevated"
                >
                  <div className="text-left">
                    <div className="text-sm font-medium text-text-primary">
                      风格设置（可选）
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {stylePresetId 
                        ? `已选择：${presets.find(p => p.id === stylePresetId)?.name || stylePresetId}`
                        : '为相册选择调色风格'}
                    </div>
                  </div>
                  {showStyleSelector ? (
                    <ChevronUp className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                </button>
                
                {showStyleSelector && (
                  <div className="mt-3 p-3 sm:p-4 bg-surface rounded-lg border border-border max-h-[60vh] sm:max-h-[500px] overflow-y-auto touch-pan-y">
                    <StylePresetSelector
                      value={stylePresetId}
                      onChange={setStylePresetId}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6 flex-col gap-3 sm:flex-row sm:gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="btn-secondary w-full sm:w-auto order-2 sm:order-1"
                  disabled={loading}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn-primary w-full sm:w-auto order-1 sm:order-2" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    '创建相册'
                  )}
                </button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>相册创建成功</DialogTitle>
              <DialogDescription>
                您可以复制下方链接分享给客户
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  分享链接
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={created.shareUrl}
                    readOnly
                    className="input flex-1 text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className="btn-secondary shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* FTP 配置（可折叠） */}
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFtpConfig(!showFtpConfig)}
                  className="w-full flex items-center justify-between p-4 hover:bg-surface-elevated transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-accent" />
                    <span className="font-medium">FTP 上传配置</span>
                  </div>
                  {showFtpConfig ? (
                    <ChevronUp className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                </button>

                {showFtpConfig && created.upload_token && (
                  <div className="p-4 space-y-3 bg-surface-elevated border-t border-border">
                    <p className="text-sm text-text-secondary">
                      配置相机 FTP 上传功能，支持相机直接上传照片
                    </p>
                    
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          FTP 服务器地址
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={getFtpServerHost()}
                            readOnly
                            className="input flex-1 text-xs font-mono bg-surface"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(getFtpServerHost())
                              showSuccess('服务器地址已复制')
                            }}
                            className="btn-secondary px-2"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          FTP 端口
                        </label>
                        <input
                          type="text"
                          value={getFtpServerPort()}
                          readOnly
                          className="input text-xs font-mono bg-surface"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          用户名（推荐使用短码）
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={created.slug}
                            readOnly
                            className="input flex-1 text-xs font-mono bg-surface"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(created.slug)
                              showSuccess('相册短码已复制')
                            }}
                            className="btn-secondary px-2"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          上传令牌（密码）
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={created.upload_token}
                            readOnly
                            className="input flex-1 text-xs font-mono bg-surface"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(created.upload_token!)
                              showSuccess('上传令牌已复制')
                            }}
                            className="btn-secondary px-2"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>提示：</strong>在相机 FTP 设置中填入上述信息，拍摄的照片将自动上传到此相册。
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <button type="button" onClick={handleClose} className="btn-primary w-full">
                  开始上传照片
                </button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
