/**
 * @fileoverview PIS Web - 通用工具函数
 *
 * @description 提供项目常用的工具函数，包括类名合并、日期格式化等
 * @module lib/utils
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind CSS 类名
 *
 * @description 使用 clsx 和 tailwind-merge 合并类名，自动处理冲突
 * @param {...ClassValue[]} inputs 要合并的类名值
 * @returns {string} 合并后的类名字符串
 *
 * @example
 * ```typescript
 * cn('px-2 py-1', 'bg-blue-500', isSelected && 'bg-blue-700')
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化文件大小为人类可读字符串
 *
 * @param {number} bytes 文件大小（字节）
 * @returns {string} 格式化后的字符串（如 "1.5 MB"）
 *
 * @example
 * ```typescript
 * formatFileSize(1024) // "1 KB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 将日期字符串或对象格式化为 "YYYY年MM月DD日" 格式
 *
 * @description 使用固定格式以避免服务端和客户端的 hydration 不匹配
 * @param {string|Date} date 日期字符串或 Date 对象
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return `${year}年${monthNames[month - 1]}${day}日`
}

/**
 * 将日期格式化为相对时间字符串（如"5分钟前"）
 *
 * @description 服务端渲染时返回固定日期格式，避免 hydration 不匹配
 * @param {string|Date} date 日期字符串或 Date 对象
 * @returns {string} 相对时间字符串
 */
export function formatRelativeTime(date: string | Date): string {
  // 服务端渲染时，返回固定格式的日期以避免 hydration 不匹配
  if (typeof window === 'undefined') {
    return formatDate(date)
  }

  const now = new Date()
  const target = new Date(date)
  const diff = now.getTime() - target.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`

  return formatDate(date)
}

/**
 * 获取应用基础 URL（用于生成分享链接）
 *
 * @description 优先使用环境变量，否则回退到 window.location.origin (客户端) 或默认值 (服务端)
 * @returns {string} 基础 URL 字符串
 */
export function getAppBaseUrl(): string {
  // 服务端：使用环境变量
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }
  // 客户端：优先使用环境变量，否则使用当前域名
  return process.env.NEXT_PUBLIC_APP_URL || window.location.origin
}

/**
 * 获取内部 API URL（用于服务端内部调用）
 *
 * @description 
 * - 服务端内部调用需要使用绝对 URL（因为服务端 fetch 不支持相对路径）
 * - 在容器内部，应该使用 localhost（因为服务端和 API 路由在同一个容器中）
 * - 客户端可以使用相对路径
 * @param {string} path - API 路径（如 '/api/worker/process'）
 * @returns {string} 完整的 API URL
 */
export function getInternalApiUrl(path: string): string {
  // 确保路径以 / 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  
  // 服务端：必须使用绝对 URL（服务端 fetch 不支持相对路径）
  if (typeof window === 'undefined') {
    // 优先使用 INTERNAL_API_URL（容器内部 URL，如 http://localhost:3000）
    // 如果没有设置，使用 localhost（因为服务端和 API 路由在同一个容器中）
    const internalApiUrl = process.env.INTERNAL_API_URL
    if (internalApiUrl) {
      return `${internalApiUrl.replace(/\/$/, '')}${normalizedPath}`
    }
    
    // 默认使用 localhost（容器内部调用）
    // 注意：不要使用 NEXT_PUBLIC_APP_URL，因为那是公网 URL，服务端内部调用应该使用容器内部地址
    const port = process.env.PORT || '3000'
    const defaultUrl = `http://localhost:${port}`
    return `${defaultUrl}${normalizedPath}`
  }
  
  // 客户端：使用相对路径
  return normalizedPath
}

/**
 * 获取安全的媒体 URL（修复 localhost HTTPS 问题）
 *
 * @description 
 * - 如果媒体 URL 是 https://localhost，自动转换为相对路径或使用当前页面协议
 * - 如果媒体 URL 为空，使用相对路径 /media
 * @returns {string} 安全的媒体 URL
 */
export function getSafeMediaUrl(): string {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || ''
  
  // 如果媒体 URL 为空，使用相对路径
  if (!mediaUrl) {
    return '/media'
  }
  
  try {
    const url = new URL(mediaUrl)
    
    // 服务端和客户端都处理 localhost HTTPS 问题
    // 如果 hostname 是 localhost 或 127.0.0.1，且协议是 https，转换为相对路径
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && 
        url.protocol === 'https:') {
      // 对于 localhost HTTPS，使用相对路径更安全（避免连接被拒绝）
      return url.pathname || '/media'
    }
    
    // 客户端：如果 hostname 是 localhost 且协议是 https，但当前页面是 http
    // 则转换为相对路径或使用当前页面协议
    if (typeof window !== 'undefined' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && 
        url.protocol === 'https:' && 
        window.location.protocol === 'http:') {
      // 使用相对路径，让浏览器自动使用当前页面的协议和域名
      return url.pathname || '/media'
    }
    
    return mediaUrl
  } catch {
    // URL 解析失败，可能是相对路径，直接返回
    return mediaUrl || '/media'
  }
}

/**
 * 生成相册分享 URL
 *
 * @param {string} slug 相册 slug（会自动进行 URL 编码）
 * @returns {string} 完整的分享链接
 * @throws {Error} 如果 slug 无效则抛出错误
 */
export function getAlbumShareUrl(slug: string): string {
  // 验证 slug 有效性
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    throw new Error('Invalid album slug')
  }
  // 对 slug 进行 URL 编码，防止特殊字符导致 URL 无效
  const encodedSlug = encodeURIComponent(slug.trim())
  return `${getAppBaseUrl()}/album/${encodedSlug}`
}

/**
 * 生成唯一的相册 slug
 *
 * @description 使用时间戳和随机字符生成 12 位唯一标识符
 * @returns {string} 生成的 slug（格式：字母数字组合）
 *
 * @example
 * ```typescript
 * const slug = generateAlbumSlug()
 * // 返回类似 "a1b2c3d4e5f6" 的字符串
 * ```
 */
export function generateAlbumSlug(): string {
  // 使用 Base36 编码时间戳（更短）+ 随机后缀
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 8)
  return `${timestamp}${randomPart}`
}
