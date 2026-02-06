'use client'

import { useState, useEffect, useRef } from 'react'
import { Share2, Copy, Check, ExternalLink, QrCode, Download, MessageCircle, Users, Image as ImageIcon } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { showError, showInfo } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { generatePoster, downloadPoster, type PosterStyle, POSTER_PRESETS, validateAndLimitStyle } from '@/lib/poster-generator'
import { PosterConfigDialog } from './poster-config-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface ShareLinkButtonProps {
  url: string
  albumTitle?: string
  albumDescription?: string | null
  backgroundImageUrl?: string | null
}

// 检测是否在微信环境中
const isWeChat = () => {
  if (typeof window === 'undefined') return false
  return /MicroMessenger/i.test(navigator.userAgent)
}

export function ShareLinkButton({ 
  url, 
  albumTitle = '相册',
  albumDescription,
  backgroundImageUrl,
}: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [isWeixin, setIsWeixin] = useState(false)
  const [generatingPoster, setGeneratingPoster] = useState(false)
  const [showPosterConfig, setShowPosterConfig] = useState(false)
  // 使用经典模板作为默认样式，确保海报质量
  const [posterStyle, setPosterStyle] = useState<PosterStyle>(POSTER_PRESETS.classic)
  const [posterPreview, setPosterPreview] = useState<string | null>(null)
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set())

  useEffect(() => {
    setIsWeixin(isWeChat())
  }, [])

  // 清理定时器，防止内存泄漏
  useEffect(() => {
    const refs = timeoutRefs.current
    return () => {
      // 组件卸载时清理所有定时器
      refs.forEach(timeoutId => clearTimeout(timeoutId))
      refs.clear()
    }
  }, [])

  // 安全的setTimeout包装函数
  const safeSetTimeout = (callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      timeoutRefs.current.delete(timeoutId)
      callback()
    }, delay)
    timeoutRefs.current.add(timeoutId)
    return timeoutId
  }

  const handleCopy = async () => {
    // 验证URL有效性
    if (!url || typeof url !== 'string') {
      showError('分享链接无效')
      return
    }

    // 优先使用 Clipboard API（需要 HTTPS 或 localhost）
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        safeSetTimeout(() => setCopied(false), 2000)
        // 关闭对话框，提供更好的反馈
        safeSetTimeout(() => setOpen(false), 1500)
        return
      } catch (error) {
        console.warn('Clipboard API failed, trying fallback:', error)
        // 继续使用降级方案
      }
    }
    
    // 降级方案：使用传统复制方法（兼容 HTTP 和非安全上下文）
    try {
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'
      textArea.setAttribute('readonly', '')
      textArea.setAttribute('aria-hidden', 'true')
      document.body.appendChild(textArea)
      
      // 兼容移动端和桌面端
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        // iOS 需要特殊处理
        const range = document.createRange()
        range.selectNodeContents(textArea)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        textArea.setSelectionRange(0, url.length)
      } else {
        textArea.select()
        textArea.setSelectionRange(0, url.length)
      }
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (successful) {
        setCopied(true)
        safeSetTimeout(() => setCopied(false), 2000)
        safeSetTimeout(() => setOpen(false), 1500)
      } else {
        // 如果 execCommand 失败，尝试选中文本让用户手动复制
        textArea.style.position = 'fixed'
        textArea.style.top = '50%'
        textArea.style.left = '50%'
        textArea.style.transform = 'translate(-50%, -50%)'
        textArea.style.opacity = '1'
        textArea.style.zIndex = '9999'
        textArea.style.pointerEvents = 'auto'
        document.body.appendChild(textArea)
        textArea.select()
        showInfo('请手动复制链接（已选中）')
        safeSetTimeout(() => {
          if (textArea.parentNode) {
            document.body.removeChild(textArea)
          }
        }, 3000)
      }
    } catch (error) {
      console.error('Fallback copy error:', error)
      // 最后的降级方案：显示 URL 让用户手动复制
      showError('复制失败，链接已显示在输入框中，请手动复制')
    }
  }

  const handleOpen = () => {
    try {
      // 验证URL有效性
      if (!url || typeof url !== 'string') {
        showError('分享链接无效')
        return
      }
      // 验证URL格式
      try {
        new URL(url)
      } catch {
        showError('分享链接格式无效')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('Open URL error:', error)
      showError('打开链接失败，请手动复制链接')
    }
  }

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-code-svg')
    if (!svg) {
      showError('二维码未找到，请重试')
      return
    }

    try {
      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        showError('浏览器不支持图片下载功能')
        return
      }
      
      const img = new Image()
      let isHandled = false // 防止重复处理
      
      img.onerror = () => {
        if (!isHandled) {
          isHandled = true
          showError('二维码图片加载失败，请重试')
        }
      }
      
      img.onload = () => {
        if (isHandled) return // 防止重复处理
        isHandled = true
        
        try {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          const pngFile = canvas.toDataURL('image/png')
          const downloadLink = document.createElement('a')
          // 清理文件名中的特殊字符
          const safeFileName = albumTitle.replace(/[<>:"/\\|?*]/g, '_').trim() || '相册'
          downloadLink.download = `${safeFileName}-二维码.png`
          downloadLink.href = pngFile
          document.body.appendChild(downloadLink)
          downloadLink.click()
          // 延迟移除，确保下载开始（添加安全检查）
          safeSetTimeout(() => {
            if (downloadLink.parentNode) {
              document.body.removeChild(downloadLink)
            }
          }, 100)
        } catch (error) {
          console.error('Download QR code error:', error)
          showError('下载二维码失败，请重试')
        }
      }
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
    } catch (error) {
      console.error('QR code download error:', error)
      showError('生成二维码失败，请重试')
    }
  }

  // 微信分享到朋友圈
  const handleWeChatTimeline = () => {
    if (isWeixin) {
      // 在微信中，引导用户使用右上角分享菜单
      showInfo('请点击右上角菜单，选择"分享到朋友圈"')
      setOpen(false)
    } else {
      // 非微信环境，尝试打开微信（需要用户安装微信）
      try {
        // 验证URL有效性
        if (!url || typeof url !== 'string') {
          showError('分享链接无效')
          return
        }
        const shareText = `${albumTitle} - ${url}`
        // 限制分享文本长度，避免URL过长
        const maxLength = 200
        const truncatedText = shareText.length > maxLength 
          ? shareText.substring(0, maxLength - 3) + '...'
          : shareText
        const weixinUrl = `weixin://dl/moments/?text=${encodeURIComponent(truncatedText)}`
        window.location.href = weixinUrl
        safeSetTimeout(() => {
          showInfo('如果未打开微信，请复制链接后在微信中分享')
        }, 1000)
      } catch (error) {
        console.error('WeChat share error:', error)
        showError('打开微信失败，请复制链接后在微信中分享')
      }
    }
  }

  // 微信分享给好友
  const handleWeChatFriend = () => {
    if (isWeixin) {
      // 在微信中，引导用户使用右上角分享菜单
      showInfo('请点击右上角菜单，选择"发送给朋友"')
      setOpen(false)
    } else {
      // 非微信环境，尝试打开微信（需要用户安装微信）
      try {
        // 验证URL有效性
        if (!url || typeof url !== 'string') {
          showError('分享链接无效')
          return
        }
        const shareText = `${albumTitle} - ${url}`
        // 限制分享文本长度，避免URL过长
        const maxLength = 200
        const truncatedText = shareText.length > maxLength 
          ? shareText.substring(0, maxLength - 3) + '...'
          : shareText
        const weixinUrl = `weixin://dl/chat?text=${encodeURIComponent(truncatedText)}`
        window.location.href = weixinUrl
        safeSetTimeout(() => {
          showInfo('如果未打开微信，请复制链接后在微信中分享')
        }, 1000)
      } catch (error) {
        console.error('WeChat share error:', error)
        showError('打开微信失败，请复制链接后在微信中分享')
      }
    }
  }

  // 原生分享（移动端）
  const handleNativeShare = async () => {
    if (typeof window !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: albumTitle,
          text: `查看 ${albumTitle} 的精彩照片`,
          url: url,
        })
        setOpen(false)
      } catch (err) {
        // 用户取消分享
        if (err instanceof Error && err.name !== 'AbortError') {
          showError('分享失败，请重试')
        }
      }
    } else {
      showInfo('您的设备不支持原生分享，请使用其他方式')
    }
  }

  // 生成海报（带样式配置）
  const handleGeneratePoster = async (useConfig = false) => {
    if (generatingPoster) return
    
    // 如果需要配置，先打开配置对话框
    if (!useConfig && !showPosterConfig) {
      setShowPosterConfig(true)
      return
    }
    
    setGeneratingPoster(true)
    try {
      // 确保二维码已渲染
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 应用验证和限制，确保海报质量
      const validatedStyle = validateAndLimitStyle(posterStyle)
      
      const poster = await generatePoster({
        backgroundImageUrl: backgroundImageUrl || null,
        title: albumTitle,
        description: albumDescription || null,
        qrCodeUrl: url,
        style: validatedStyle,
      })
      
      // 清理文件名中的特殊字符
      const safeFileName = albumTitle.replace(/[<>:"/\\|?*]/g, '_').trim() || '相册'
      downloadPoster(poster.blob, `${safeFileName}-海报.png`)
      
      showInfo('海报已生成并开始下载')
      setShowPosterConfig(false)
    } catch (error) {
      console.error('Generate poster error:', error)
      showError('生成海报失败，请重试')
    } finally {
      setGeneratingPoster(false)
    }
  }

  // 预览海报
  const handlePreviewPoster = async () => {
    try {
      // 确保二维码已渲染
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 应用验证和限制
      const validatedStyle = validateAndLimitStyle(posterStyle)
      
      const poster = await generatePoster({
        backgroundImageUrl: backgroundImageUrl || null,
        title: albumTitle,
        description: albumDescription || null,
        qrCodeUrl: url,
        style: validatedStyle,
      })
      
      setPosterPreview(poster.dataUrl)
    } catch (error) {
      console.error('Preview poster error:', error)
      showError('预览失败，请重试')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary text-sm min-h-[44px] px-3 py-2"
        aria-label="分享相册"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="分享相册"
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分享相册</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {showQR ? '扫描二维码即可访问相册' : '复制链接分享给客户'}
          </DialogDescription>

          {/* 标签切换 */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setShowQR(false)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                !showQR 
                  ? 'bg-accent text-background' 
                  : 'bg-surface text-text-secondary hover:text-text-primary'
              )}
            >
              链接分享
            </button>
            <button
              type="button"
              onClick={() => setShowQR(true)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 min-h-[44px]',
                showQR 
                  ? 'bg-accent text-background' 
                  : 'bg-surface text-text-secondary hover:text-text-primary'
              )}
            >
              <QrCode className="w-4 h-4" />
              二维码
            </button>
          </div>

          {!showQR ? (
            <>
              <p className="text-sm text-text-secondary mb-3">分享此相册给客户：</p>
              
              {/* 分享选项网格 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {/* 微信朋友圈 */}
                <button
                  type="button"
                  onClick={handleWeChatTimeline}
                  className="flex flex-col items-center justify-center gap-2 p-4 md:p-4 bg-surface hover:bg-surface-elevated rounded-lg transition-colors min-h-[120px] md:min-h-[100px]"
                  aria-label="分享到微信朋友圈"
                >
                  <div className="w-14 h-14 md:w-12 md:h-12 rounded-full bg-green-500 flex items-center justify-center" aria-hidden="true">
                    <Users className="w-7 h-7 md:w-6 md:h-6 text-white" />
                  </div>
                  <span className="text-sm md:text-xs text-text-secondary">朋友圈</span>
                </button>

                {/* 微信好友 */}
                <button
                  type="button"
                  onClick={handleWeChatFriend}
                  className="flex flex-col items-center justify-center gap-2 p-4 md:p-4 bg-surface hover:bg-surface-elevated rounded-lg transition-colors min-h-[120px] md:min-h-[100px]"
                  aria-label="分享给微信好友"
                >
                  <div className="w-14 h-14 md:w-12 md:h-12 rounded-full bg-green-500 flex items-center justify-center" aria-hidden="true">
                    <MessageCircle className="w-7 h-7 md:w-6 md:h-6 text-white" />
                  </div>
                  <span className="text-sm md:text-xs text-text-secondary">微信好友</span>
                </button>

                {/* 原生分享（移动端） */}
                {typeof window !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex flex-col items-center justify-center gap-2 p-4 md:p-4 bg-surface hover:bg-surface-elevated rounded-lg transition-colors min-h-[120px] md:min-h-[100px]"
                  >
                    <div className="w-14 h-14 md:w-12 md:h-12 rounded-full bg-accent flex items-center justify-center">
                      <Share2 className="w-7 h-7 md:w-6 md:h-6 text-background" />
                    </div>
                    <span className="text-sm md:text-xs text-text-secondary">更多</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg mb-3">
                <input
                  type="text"
                  value={url}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-text-primary outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 btn-primary text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      复制链接
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleOpen}
                  className="btn-secondary text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  预览
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-3 text-center">扫描二维码访问相册</p>
              
              {/* 二维码 - 响应式尺寸 */}
              <div className="flex justify-center p-4 bg-white rounded-lg mb-3">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={url}
                  size={typeof window !== 'undefined' && window.innerWidth < 640 ? 160 : 200}
                  level="H"
                  includeMargin
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="w-full btn-secondary text-sm"
                >
                  <Download className="w-4 h-4" />
                  下载二维码
                </button>
                
                <button
                  type="button"
                  onClick={() => handleGeneratePoster(false)}
                  disabled={generatingPoster}
                  className="w-full btn-primary text-sm"
                >
                  {generatingPoster ? (
                    <>
                      <QrCode className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      生成海报
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 海报配置对话框 */}
      <PosterConfigDialog
        open={showPosterConfig}
        onClose={() => setShowPosterConfig(false)}
        style={posterStyle}
        onStyleChange={setPosterStyle}
        onPreview={handlePreviewPoster}
        onGenerate={() => handleGeneratePoster(true)}
        generating={generatingPoster}
        albumTitle={albumTitle}
        albumDescription={albumDescription || undefined}
        coverImage={backgroundImageUrl || undefined}
      />

      {/* 海报预览对话框 */}
      {posterPreview && (
        <Dialog open={!!posterPreview} onOpenChange={() => setPosterPreview(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>海报预览</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center p-4 bg-surface rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterPreview}
                alt="海报预览"
                className="max-w-full h-auto rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = posterPreview
                  link.download = `${albumTitle.replace(/[<>:"/\\|?*]/g, '_').trim() || '相册'}-海报.png`
                  link.click()
                }}
                className="flex-1 btn-primary"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
              <button
                type="button"
                onClick={() => setPosterPreview(null)}
                className="flex-1 btn-secondary"
              >
                关闭
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
