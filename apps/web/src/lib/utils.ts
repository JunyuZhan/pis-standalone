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
  if (month < 1 || month > 12) return ''
  
  // 中文月份名称
  const monthNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
  const monthName = monthNames[month - 1]
  
  return `${year}年${monthName}月${day}日`
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
 * @description 开发环境：如果配置的端口和当前端口不匹配，自动使用当前域名
 * @returns {string} 基础 URL 字符串
 */
export function getAppBaseUrl(): string {
  // 服务端：使用环境变量
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }
  
  // 客户端：智能处理域名/IP 不匹配的情况
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  const currentOrigin = window.location.origin
  const currentHost = window.location.hostname
  
  // 如果没有配置环境变量，使用当前域名
  if (!envUrl) {
    return currentOrigin
  }
  
  try {
    const url = new URL(envUrl)
    const configuredHost = url.hostname
    
    // 核心逻辑：如果配置的主机与当前主机不同，使用当前域名
    // 这样无论是 localhost、IP 地址还是域名，只要不匹配就自动使用当前页面的域名
    // 这支持以下场景：
    // - 配置 localhost，通过域名访问
    // - 配置内网 IP，通过域名访问
    // - 配置域名 A，通过域名 B 访问（反向代理）
    if (configuredHost !== currentHost) {
      return currentOrigin
    }
    
    return envUrl
  } catch {
    // URL 解析失败，使用当前域名
    return currentOrigin
  }
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
 * - 开发环境：如果配置了 localhost:8080 但实际运行在 3000 端口，自动转换为相对路径
 * @returns {string} 安全的媒体 URL
 */
export function getSafeMediaUrl(url?: string): string {
  const mediaUrl = url || process.env.NEXT_PUBLIC_MEDIA_URL || ''
  
  // 如果媒体 URL 为空，使用相对路径
  if (!mediaUrl) {
    return '/media'
  }
  
  // 如果已经是相对路径，直接返回
  if (mediaUrl.startsWith('/')) {
    return mediaUrl
  }
  
  try {
    const parsedUrl = new URL(mediaUrl)
    
    // 服务端：保持原样（服务端可能需要完整 URL）
    if (typeof window === 'undefined') {
      // 对于 localhost HTTPS，使用相对路径更安全
      if ((parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') && 
          parsedUrl.protocol === 'https:') {
        return parsedUrl.pathname || '/media'
      }
      return mediaUrl
    }
    
    // 客户端：智能处理域名/IP 不匹配
    const currentHost = window.location.hostname
    const configuredHost = parsedUrl.hostname
    
    // 核心逻辑：如果配置的主机与当前主机不同，使用相对路径
    // 这支持以下场景：
    // - 配置 localhost，通过域名访问
    // - 配置内网 IP，通过域名访问（frpc 反向代理）
    // - 配置域名 A，通过域名 B 访问
    if (configuredHost !== currentHost) {
      return parsedUrl.pathname || '/media'
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
 * @description 生成 8 位全英文的唯一标识符，用于 FTP 用户名
 * @returns {string} 生成的 slug（格式：8位小写字母）
 *
 * @example
 * ```typescript
 * const slug = generateAlbumSlug()
 * // 返回类似 "abcdefgh" 的 8 位字符串
 * ```
 */
export function generateAlbumSlug(): string {
  // 只使用小写字母（a-z），便于在相机上输入
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  let result = ''
  
  // 服务端：使用 Node.js crypto 模块
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    try {
      const crypto = require('crypto')
      const bytes = crypto.randomBytes(8)
      for (let i = 0; i < 8; i++) {
        result += letters[bytes[i] % 26]
      }
      return result
    } catch {
      // 如果 require 失败，回退到其他方法
    }
  }

  // 客户端或服务端回退方案：使用 Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(8)
    crypto.getRandomValues(array)
    for (let i = 0; i < 8; i++) {
      result += letters[array[i] % 26]
    }
    return result
  }

  // 最后的回退方案：使用 Math.random
  for (let i = 0; i < 8; i++) {
    result += letters[Math.floor(Math.random() * 26)]
  }
  return result
}

/**
 * 截断文本
 * 
 * @param {string} text 文本内容
 * @param {number} maxLength 最大长度
 * @returns {string} 截断后的文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 生成安全的随机令牌（用于 upload_token）
 *
 * @description 生成 8 位全数字的随机令牌，用于 FTP 密码
 * 为了便于在相机上输入，使用纯数字，避免字母和特殊字符
 * 
 * @param {number} [length=8] 令牌长度（默认 8 位数字）
 * @returns {string} 随机令牌字符串（8 位数字）
 *
 * @example
 * ```typescript
 * const token = generateUploadToken()
 * // 返回类似 "12345678" 的 8 位数字字符串
 * ```
 */
export function generateUploadToken(length: number = 8): string {
  // 只使用数字（0-9），便于在相机上输入
  const digits = '0123456789'
  let result = ''
  
  // 服务端：使用 Node.js crypto 模块
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    try {
      const crypto = require('crypto')
      const bytes = crypto.randomBytes(length)
      for (let i = 0; i < length; i++) {
        result += digits[bytes[i] % 10]
      }
      return result
    } catch {
      // 如果 require 失败，回退到其他方法
    }
  }

  // 客户端或服务端回退方案：使用 Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    for (let i = 0; i < length; i++) {
      result += digits[array[i] % 10]
    }
    return result
  }

  // 最后的回退方案：使用 Math.random
  for (let i = 0; i < length; i++) {
    result += digits[Math.floor(Math.random() * 10)]
  }
  return result
}

/**
 * 获取 FTP 服务器地址
 *
 * @description 从环境变量或配置中获取 FTP 服务器地址
 * @returns {string} FTP 服务器地址（IP 或域名）
 *
 * @example
 * ```typescript
 * const ftpHost = getFtpServerHost()
 * // 返回类似 "192.168.1.100" 或 "ftp.example.com"
 * ```
 */
export function getFtpServerHost(): string {
  // 优先使用环境变量
  if (process.env.FTP_HOST) {
    return process.env.FTP_HOST
  }

  // 客户端：尝试从 window.location 获取
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // 如果是 localhost，返回提示信息
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'localhost'
    }
    return hostname
  }

  // 服务端：使用默认值或从环境变量获取
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '').split(':')[0] || 'localhost'
}

/**
 * 获取 FTP 服务器端口
 *
 * @description 从环境变量获取 FTP 端口，默认 21
 * @returns {number} FTP 端口号
 */
export function getFtpServerPort(): number {
  const port = process.env.FTP_PORT || process.env.NEXT_PUBLIC_FTP_PORT || '21'
  return parseInt(port, 10) || 21
}
