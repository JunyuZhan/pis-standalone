'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  quality?: number
  sizes?: string
  priority?: boolean
  blurDataURL?: string
  onError?: () => void
  aspectRatio?: number
  unoptimized?: boolean // 跳过 Next.js 优化，直接从 CDN 加载
}

/**
 * 优化的图片组件
 * - 优先图片（priority=true）立即加载
 * - 其他图片使用 Next.js 内置的 lazy loading（自动检测视口）
 * - 优化图片质量和尺寸
 * - 支持 BlurHash 占位符
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  quality = 75, // 默认降低质量以提高加载速度
  sizes,
  priority = false,
  blurDataURL,
  onError,
  aspectRatio,
  unoptimized = false, // 默认使用 Next.js 优化；CDN 已优化的图片可设为 true
}: OptimizedImageProps) {
  // 自动检测 localhost 环境，如果是 localhost 则跳过 Next.js 优化，避免 Docker 容器内部回环访问失败
  const isLocalhost = typeof src === 'string' && (src.includes('localhost') || src.includes('127.0.0.1'));
  const effectiveUnoptimized = unoptimized || isLocalhost;

  const [imageError, setImageError] = useState(false)
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [useNativeImg, setUseNativeImg] = useState(false) // 用于 HTTP/2 错误时回退到原生 img 标签
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null) // 用于尝试 HTTP/1.1 回退
  
  // 当 src 改变时，重置错误状态，以便尝试加载新的图片
  // 这确保了降级机制能正常工作：当切换到下一个后备图片时，会重新尝试加载
  useEffect(() => {
    setImageError(false)
    setDiagnosticInfo(null)
    setRetryCount(0)
    setUseNativeImg(false)
    setFallbackSrc(null)
  }, [src])
  
  // 当 onError 回调改变时，也重置错误状态（用于父组件更新错误处理逻辑）
  useEffect(() => {
    setImageError(false)
    setDiagnosticInfo(null)
    setRetryCount(0)
    setUseNativeImg(false)
    setFallbackSrc(null)
  }, [onError])
  
  // 可选的预检查：在开发环境或优先级图片时，尝试诊断 URL 可访问性
  useEffect(() => {
    if (priority && typeof src === 'string' && src.startsWith('http') && !imageError) {
      // 仅在开发环境或优先级图片时进行诊断
      const checkUrl = async () => {
        try {
          // 使用 fetch 检查 URL（注意：可能受 CORS 限制）
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
          
          const response = await fetch(src, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache',
          })
          
          clearTimeout(timeoutId)
          
          if (!response.ok) {
            setDiagnosticInfo(`HTTP ${response.status}: ${response.statusText}`)
            if (response.status === 404) {
              console.warn(`[OptimizedImage] Image not found (404): ${src}`)
            } else if (response.status === 403) {
              console.warn(`[OptimizedImage] Access forbidden (403): ${src} - Check CORS/referrer settings`)
            }
          }
        } catch (error: unknown) {
          // 忽略 CORS 错误（这是预期的，如果服务器不允许 CORS）
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (error instanceof Error && error.name !== 'AbortError' && !errorMessage.includes('CORS')) {
            setDiagnosticInfo(`Network error: ${errorMessage}`)
          }
        }
      }
      
      // 延迟检查，避免影响正常加载
      const timer = setTimeout(checkUrl, 100)
      return () => clearTimeout(timer)
    }
  }, [src, priority, imageError])
  
  // 简化逻辑：优先图片立即加载，其他图片使用 Next.js 的 lazy loading
  // Next.js Image 组件已经内置了 Intersection Observer，不需要重复实现

  const handleError = async (event?: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // 收集所有错误信息到一个字符串中，确保所有信息都能显示
    try {
      const srcValue = src ?? '(undefined)'
      const srcStr = typeof srcValue === 'string' && srcValue.length > 0
        ? `"${srcValue.substring(0, 150)}${srcValue.length > 150 ? '...' : ''}"`
        : '(empty or invalid)'
      const altValue = alt ?? '(undefined)'
      const altStr = typeof altValue === 'string' && altValue.length > 0 ? altValue : '(empty)'
      
      // 检测 HTTP/2 协议错误
      // ERR_HTTP2_PROTOCOL_ERROR 通常表现为：状态码 200 但图片无法加载（naturalWidth/Height 为 0）
      // 当使用 Next.js Image 组件且 unoptimized=true 时，如果出现这种情况，可能是 HTTP/2 协议问题
      let http2Error = false
      if (event?.target && effectiveUnoptimized) {
        const img = event.target as HTMLImageElement
        // 检查是否是 HTTP/2 协议错误：图片标记为完成但尺寸为 0，且有有效的 src
        if (img.naturalWidth === 0 && img.naturalHeight === 0 && img.complete && img.currentSrc) {
          http2Error = true
        }
      }
      
      // 如果是 HTTP/2 错误且未重试过，尝试使用原生 img 标签（绕过 Next.js Image 的 HTTP/2）
      if (http2Error && retryCount === 0 && typeof src === 'string') {
        console.warn('[OptimizedImage] HTTP/2 protocol error detected, retrying with native img tag')
        console.warn('[OptimizedImage] This may be caused by Cloudflare/frpc compatibility issues')
        console.warn('[OptimizedImage] Troubleshooting:')
        console.warn('  1. Check if Cloudflare SSL/TLS mode is compatible (try "Flexible" or disable HTTP/2)')
        console.warn('  2. Verify frpc configuration (check HTTP/2 support)')
        console.warn('  3. Check Nginx configuration (try disabling HTTP/2: listen 443 ssl instead of listen 443 ssl http2)')
        console.warn('  4. Verify image URL is accessible: ' + src)
        setRetryCount(1)
        setUseNativeImg(true)
        setImageError(false) // 重置错误状态以重试
        return // 不调用 onError，让重试机制处理
      }
      
      // 如果原生 img 标签也失败了（retryCount === 1），尝试添加缓存破坏参数或检查其他问题
      if (retryCount === 1 && useNativeImg && typeof src === 'string') {
        console.error('[OptimizedImage] Native img tag also failed - this suggests a deeper issue:')
        console.error('  - Image may not exist at URL')
        console.error('  - CORS/Referer restrictions may be blocking the request')
        console.error('  - Network connectivity issues')
        console.error('  - Server-side HTTP/2 configuration issue')
        
        // 如果 URL 中没有时间戳参数，尝试添加一个（绕过可能的缓存问题）
        if (!src.includes('?') && !src.includes('&')) {
          const timestampedSrc = `${src}?t=${Date.now()}&_retry=1`
          console.warn('[OptimizedImage] Attempting retry with timestamp parameter:', timestampedSrc)
          setFallbackSrc(timestampedSrc)
          setRetryCount(2)
          setImageError(false)
          return
        }
      }
      
      // 检测协议不匹配
      let protocolMismatch = ''
      if (typeof src === 'string' && src.startsWith('http://')) {
        const httpsUrl = src.replace('http://', 'https://')
        protocolMismatch = `\n  ⚠️ Protocol mismatch detected: URL uses HTTP but browser may be upgrading to HTTPS.\n  Try using HTTPS: ${httpsUrl}`
      }
      
      // 构建完整的错误信息字符串
      let errorDetails = `[OptimizedImage] Image load failed\n`
      if (http2Error) {
        errorDetails += `  ⚠️ HTTP/2 Protocol Error detected - This may be a Cloudflare/frpc compatibility issue\n`
      }
      errorDetails += `  src: ${srcStr}\n`
      errorDetails += `  alt: ${altStr}\n`
      errorDetails += `  src type: ${typeof src}, value: ${JSON.stringify(src)}\n`
      errorDetails += `  alt type: ${typeof alt}, value: ${JSON.stringify(alt)}\n`
      errorDetails += `  hasSrc: ${!!src}, srcLength: ${typeof src === 'string' ? src.length : 'N/A'}\n`
      errorDetails += `  props: width=${width ?? 'undefined'}, height=${height ?? 'undefined'}, fill=${fill}, unoptimized=${effectiveUnoptimized}`
      if (protocolMismatch) {
        errorDetails += protocolMismatch
      }
      
      if (event?.target) {
        const img = event.target as HTMLImageElement
        errorDetails += `\n  image element: currentSrc=${img.currentSrc || '(empty)'}, naturalWidth=${img.naturalWidth}, naturalHeight=${img.naturalHeight}`
        
        // 检测协议不匹配（比较原始 src 和 currentSrc）
        if (src && img.currentSrc && src !== img.currentSrc) {
          errorDetails += `\n  ⚠️ URL changed: original="${src.substring(0, 100)}" -> current="${img.currentSrc.substring(0, 100)}"`
        }
      }
      
      // 添加诊断信息（如果有）
      if (diagnosticInfo) {
        errorDetails += `\n  Diagnostic: ${diagnosticInfo}`
      }
      
      // 添加故障排除建议
      errorDetails += `\n  Troubleshooting:`
      if (typeof src === 'string') {
        if (src.startsWith('http://')) {
          errorDetails += `\n    1. Check if server supports HTTPS (try https:// instead)`
          errorDetails += `\n    2. Verify NEXT_PUBLIC_MEDIA_URL uses correct protocol`
        }
        errorDetails += `\n    3. Verify image exists at: ${src}`
        errorDetails += `\n    4. Check browser console Network tab for HTTP status code`
        errorDetails += `\n    5. Check server CORS/referrer settings (nginx/media.conf)`
      }
      
      // 使用单个 console.error 调用，包含所有信息
      console.error(errorDetails)
      
      // 诊断信息（仅在开发环境或需要时）
      if (protocolMismatch) {
        console.warn('Protocol mismatch:', protocolMismatch)
      }
      if (event?.target) {
        const img = event.target as HTMLImageElement
        if (src && img.currentSrc && src !== img.currentSrc) {
          console.warn('URL changed:', { original: src, current: img.currentSrc })
          console.warn('💡 This suggests a protocol redirect (HTTP -> HTTPS) or URL rewrite')
        }
      }
    } catch (logError) {
      // 如果日志记录本身出错，至少记录基本信息
      console.error('[OptimizedImage] Image load failed (logging error):', logError)
      console.error('[OptimizedImage] Raw values - src:', src, 'alt:', alt)
    }
    
    // 先调用父组件的错误处理（可能切换到下一个后备方案）
    onError?.()
    // 延迟设置错误状态，给父组件时间切换图片源
    setTimeout(() => {
      setImageError(true)
    }, 200)
  }

  // 如果 src 存在且没有错误，渲染图片
  // HTTP/2 错误时使用原生 img 标签绕过 Next.js Image 组件
  if (!imageError && (src || fallbackSrc)) {
    // HTTP/2 错误回退：使用原生 img 标签（绕过 Next.js Image 的 HTTP/2 处理）
    if (useNativeImg) {
      const imgSrc = fallbackSrc || src
      return (
        <div className={cn('relative', fill ? 'w-full h-full' : '')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={alt}
            width={width}
            height={height}
            className={cn(className, fill ? 'w-full h-full object-cover' : '')}
            loading={priority ? 'eager' : 'lazy'}
            onError={handleError}
            style={fill ? { objectFit: 'cover' } : undefined}
            crossOrigin="anonymous" // 尝试添加 CORS 支持
          />
        </div>
      )
    }
    
    // 正常情况：使用 Next.js Image 组件
    return (
      <div className={cn('relative', fill ? 'w-full h-full' : '')}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          fill={fill}
          className={className}
          quality={quality}
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          placeholder={blurDataURL ? 'blur' : 'empty'}
          blurDataURL={blurDataURL}
          onError={handleError}
          unoptimized={effectiveUnoptimized}
        />
      </div>
    )
  }

  // 错误状态或没有 src - 显示占位符
  return (
    <div
      className={cn(
        'relative flex items-center justify-center bg-surface-elevated',
        fill ? 'w-full h-full' : ''
      )}
      style={aspectRatio && !fill ? { paddingBottom: `${aspectRatio * 100}%` } : undefined}
    >
      {blurDataURL && !imageError ? (
        // 显示模糊占位符（如果有 BlurHash）
        <Image
          src={blurDataURL}
          alt=""
          fill
          className="object-cover blur-sm opacity-50"
          unoptimized
          aria-hidden="true"
        />
      ) : (
        <ImageIcon className="w-8 h-8 text-text-muted" />
      )}
    </div>
  )
}
