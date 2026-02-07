'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle2, AlertCircle, Loader2, RefreshCw, Pause, Play, FolderOpen } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

// 上传配置
// 启用分片上传以绕过 Vercel 的大小限制
// 注意：使用 presigned URL 直接上传到 MinIO，绕过 Vercel 和 Cloudflare，不受 30 秒限制
// S3/MinIO 要求：除了最后一个分片，所有分片必须至少 5MB
// 因此文件 >= 5MB 时使用分片上传，确保第一个分片至少 5MB
const MULTIPART_THRESHOLD = 5 * 1024 * 1024 // >= 5MB 使用分片上传
const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB 分片大小（符合 S3/MinIO 最小分片要求）
const MAX_CONCURRENT_UPLOADS = 5 // 最大同时上传数量
const MAX_RETRIES = 3 // 最大重试次数

// 根据文件大小计算超时时间（毫秒）
// 基础超时：10分钟，每MB增加10秒（大文件需要更多时间），最大60分钟
function calculateTimeout(fileSize: number): number {
  const baseTimeout = 10 * 60 * 1000 // 10分钟
  const perMbTimeout = 10 * 1000 // 每MB 10秒（增加超时时间，提高大文件成功率）
  const maxTimeout = 60 * 60 * 1000 // 60分钟（增加最大超时时间）
  const fileSizeMb = fileSize / (1024 * 1024)
  const timeout = baseTimeout + fileSizeMb * perMbTimeout
  return Math.min(timeout, maxTimeout)
}

// 格式化网速
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  } else if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`
  }
  return `${bytesPerSecond.toFixed(0)} B/s`
}

// 计算文件哈希值（SHA-256）
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// 检查文件是否重复
async function checkDuplicate(
  albumId: string,
  filename: string,
  fileSize: number,
  fileHash?: string
): Promise<{ isDuplicate: boolean; duplicatePhoto?: { id: string; filename: string } }> {
  try {
    const response = await fetch(`/api/admin/albums/${albumId}/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        fileSize,
        fileHash,
      }),
    })

    if (!response.ok) {
      // 如果检查失败，允许继续上传（不阻止）
      console.warn('[Upload] Failed to check duplicate:', response.statusText)
      return { isDuplicate: false }
    }

    const data = await response.json()
    return {
      isDuplicate: data.isDuplicate || false,
      duplicatePhoto: data.duplicatePhoto || undefined,
    }
  } catch (error) {
    // 如果检查出错，允许继续上传（不阻止）
    console.warn('[Upload] Error checking duplicate:', error)
    return { isDuplicate: false }
  }
}

interface PhotoUploaderProps {
  albumId: string
  onComplete?: () => void
}

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  progress: number
  speed?: number // bytes per second
  error?: string
  originalKey?: string
  photoId?: string
  uploadUrl?: string
  respAlbumId?: string
  hash?: string
}

export function PhotoUploader({ albumId, onComplete }: PhotoUploaderProps) {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const completedTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map())
  const uploadQueueRef = useRef<string[]>([]) // 等待上传的文件 ID 队列
  const isProcessingQueueRef = useRef(false)
  const onCompleteCalledRef = useRef(false) // 跟踪 onComplete 是否已调用

  // 检测移动设备和iOS
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // 检测移动设备
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    setIsMobile(mobile)
    
    // 检测iOS
    interface WindowMSStream extends Window {
      MSStream?: unknown
    }
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as WindowMSStream).MSStream
    setIsIOS(iOS)
  }, [])

  // 自动移除已完成的上传项（延迟2秒后移除，让用户看到成功反馈）
  useEffect(() => {
    files.forEach((file) => {
      if (file.status === 'completed') {
        // 如果还没有设置定时器，则设置一个
        if (!completedTimersRef.current.has(file.id)) {
          const timer = setTimeout(() => {
            setFiles((prev) => prev.filter((f) => f.id !== file.id))
            completedTimersRef.current.delete(file.id)
          }, 2000) // 2秒后移除
          completedTimersRef.current.set(file.id, timer)
        }
      } else {
        // 如果文件状态不再是 completed，清理对应的定时器
        if (completedTimersRef.current.has(file.id)) {
          clearTimeout(completedTimersRef.current.get(file.id)!)
          completedTimersRef.current.delete(file.id)
        }
      }
    })
  }, [files])

  // 检查是否所有文件都已完成，如果是则调用 onComplete
  useEffect(() => {
    if (files.length === 0) {
      // 如果没有文件了，重置 onComplete 调用标志
      onCompleteCalledRef.current = false
      return
    }
    
    // 检查是否所有文件都已完成（包括成功和失败）
    const allCompleted = files.every(f => 
      f.status === 'completed' || f.status === 'failed'
    )
    
    // 只有当所有文件都已完成且尚未调用过 onComplete 时，才通知父组件
    if (allCompleted && !onCompleteCalledRef.current) {
      onCompleteCalledRef.current = true
      // 延迟调用，确保状态更新完成
      const timer = setTimeout(() => {
        onComplete?.()
      }, 500) // 延迟500ms，确保所有状态更新完成
      
      return () => clearTimeout(timer)
    }
  }, [files, onComplete])

  // 组件卸载时清理所有定时器
  useEffect(() => {
    const timers = completedTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // 处理上传队列
  const processQueue = useCallback(() => {
    if (isProcessingQueueRef.current) return
    isProcessingQueueRef.current = true

    // 使用 setTimeout 确保在下一个事件循环中处理，避免状态更新冲突
    setTimeout(() => {
      setFiles(currentFiles => {
        // 计算当前正在上传的文件数量（确保状态准确）
        const uploadingCount = currentFiles.filter(f => f.status === 'uploading').length
        
        // 确保不超过最大并发数
        if (uploadingCount >= MAX_CONCURRENT_UPLOADS) {
          isProcessingQueueRef.current = false
          return currentFiles
        }
        
        const availableSlots = MAX_CONCURRENT_UPLOADS - uploadingCount

        if (availableSlots > 0 && uploadQueueRef.current.length > 0) {
          // 过滤队列：移除已完成、失败或暂停的文件，只保留 pending 状态的文件
          uploadQueueRef.current = uploadQueueRef.current.filter(fileId => {
            const file = currentFiles.find(f => f.id === fileId)
            // 保留 pending 状态的文件，移除其他状态的文件
            return file && file.status === 'pending'
          })

          if (uploadQueueRef.current.length > 0 && availableSlots > 0) {
            // 确保不超过可用槽位
            const toStart = uploadQueueRef.current.splice(0, Math.min(availableSlots, uploadQueueRef.current.length))
            // 先重置标志，避免阻塞后续调用
            isProcessingQueueRef.current = false
            
            // 异步启动上传，避免阻塞状态更新
            toStart.forEach(fileId => {
              const file = currentFiles.find(f => f.id === fileId)
              if (file && file.status === 'pending') {
                // 使用 setTimeout 确保状态更新完成后再启动上传
                setTimeout(() => {
                  uploadSingleFile(file)
                }, 0)
              }
            })
            
            return currentFiles
          }
        }

        isProcessingQueueRef.current = false
        return currentFiles
      })
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'image/gif', 'image/tiff']
    const invalidFiles: string[] = []
    
    const validFiles = fileArray.filter((file) => {
      // 严格检查：必须是图片类型
      const isValidType = allowedImageTypes.includes(file.type)
      const isValidSize = file.size <= 100 * 1024 * 1024 // 100MB
      
      // 如果类型不匹配，记录文件名
      if (!isValidType) {
        invalidFiles.push(file.name)
      }
      
      return isValidType && isValidSize
    })

    // 如果有无效文件（如视频），显示错误提示
    if (invalidFiles.length > 0) {
      const invalidCount = invalidFiles.length
      const fileList = invalidFiles.slice(0, 3).join('、')
      const moreText = invalidCount > 3 ? `等 ${invalidCount} 个文件` : ''
      alert(`不支持的文件类型：${fileList}${moreText}\n\n仅支持图片格式：JPG、PNG、HEIC、WebP、GIF、TIFF`)
    }

    // 检查重复文件
    const duplicateFiles: string[] = []
    const nonDuplicateFiles: { file: File; hash?: string }[] = []

    // 批量检查重复（先快速检查文件名+大小）
    const duplicateChecks = await Promise.all(
      validFiles.map(async (file) => {
        try {
          // 先快速检查文件名+大小（不需要计算哈希）
          const quickCheck = await checkDuplicate(
            albumId,
            file.name,
            file.size
          )

          // 如果快速检查发现可能重复，再计算哈希进行二次确认（避免误判）
          if (quickCheck.isDuplicate && file.size <= 10 * 1024 * 1024) {
            // 只对小于10MB的文件计算哈希（大文件计算哈希太慢）
            try {
              const fileHash = await calculateFileHash(file)
              const hashCheck = await checkDuplicate(
                albumId,
                file.name,
                file.size,
                fileHash
              )
              return { file, isDuplicate: hashCheck.isDuplicate, hash: fileHash }
            } catch (hashError) {
              // 哈希计算失败，使用快速检查的结果
              console.warn('[Upload] Failed to calculate hash for', file.name, hashError)
              return { file, isDuplicate: quickCheck.isDuplicate }
            }
          }

          return { file, isDuplicate: quickCheck.isDuplicate }
        } catch (error) {
          // 如果检查出错，允许继续上传（不阻止）
          console.warn('[Upload] Error checking duplicate for', file.name, error)
          return { file, isDuplicate: false }
        }
      })
    )

    // 分离重复和非重复文件
    duplicateChecks.forEach((result) => {
      // result 类型推断为 { file: File, isDuplicate: boolean, hash?: string }
      // 需要手动指定类型或依赖推断，这里依赖推断即可
      const { file, isDuplicate, hash } = result as { file: File, isDuplicate: boolean, hash?: string }
      
      if (isDuplicate) {
        duplicateFiles.push(file.name)
      } else {
        nonDuplicateFiles.push({ file, hash })
      }
    })

    // 如果有重复文件，显示提示
    if (duplicateFiles.length > 0) {
      const duplicateCount = duplicateFiles.length
      const fileList = duplicateFiles.slice(0, 3).join('、')
      const moreText = duplicateCount > 3 ? `等 ${duplicateCount} 个文件` : ''
      alert(`检测到重复文件：${fileList}${moreText}\n\n这些文件已存在于相册中，已跳过上传`)
    }

    // 只将非重复的文件加入上传队列
    if (nonDuplicateFiles.length === 0) {
      return
    }

    // 检查是否已有相同文件在上传队列中（避免重复上传）
    const existingFileIds = new Set(files.map(f => {
      // 使用文件名+大小作为唯一标识，避免重复上传相同文件
      return `${f.file.name}-${f.file.size}`
    }))
    
    const uploadFiles: UploadFile[] = nonDuplicateFiles
      .filter((item) => {
        // 如果文件已在队列中，跳过
        const fileKey = `${item.file.name}-${item.file.size}`
        if (existingFileIds.has(fileKey)) {
          console.warn('[Upload] File already in queue, skipping:', item.file.name)
          return false
        }
        existingFileIds.add(fileKey)
        return true
      })
      .map((item) => ({
        id: Math.random().toString(36).substr(2, 9),
        file: item.file,
        hash: item.hash,
        status: 'pending' as const,
        progress: 0,
      }))

    // 如果没有新文件，直接返回
    if (uploadFiles.length === 0) {
      return
    }

    // 将新文件加入队列
    uploadQueueRef.current.push(...uploadFiles.map(f => f.id))
    setFiles((prev) => [...prev, ...uploadFiles])
    
    // 添加新文件时，重置 onComplete 调用标志
    // 这样当新文件上传完成后，可以再次触发 onComplete
    onCompleteCalledRef.current = false

    // 开始处理队列
    setTimeout(processQueue, 0)
  }, [processQueue, albumId, files])

  // getWorkerUrl removed as it's not used

  // 大文件直接上传到 Worker（Worker 没有大小限制）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const uploadToWorkerDirectly = async (
    uploadFile: UploadFile,
    photoId: string,
    originalKey: string,
    respAlbumId: string
  ) => {
    let lastLoaded = 0
    let lastTime = Date.now()
    let uploadStartTime = Date.now()

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrMapRef.current.set(uploadFile.id, xhr) // 保存 XHR 引用
      
      // 设置超时时间（根据文件大小动态计算）
      const timeout = calculateTimeout(uploadFile.file.size)
      xhr.timeout = timeout
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          const now = Date.now()
          const timeDiff = (now - lastTime) / 1000
          
          let speed = 0
          if (timeDiff >= 0.2) {
            const bytesDiff = event.loaded - lastLoaded
            speed = bytesDiff / timeDiff
            lastLoaded = event.loaded
            lastTime = now
          }
          
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id 
                ? { ...f, progress, ...(speed > 0 ? { speed } : {}) } 
                : f
            )
          )
        }
      }

      xhr.onload = () => {
        xhrMapRef.current.delete(uploadFile.id)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          const errorText = xhr.responseText || ''
          let errorMessage = `上传失败: HTTP ${xhr.status}`
          try {
            const errorData = JSON.parse(errorText)
            if (errorData.error) {
              errorMessage = errorData.error.message || errorData.error || errorMessage
            }
          } catch {
            // 忽略解析错误，使用默认消息
          }
          reject(new Error(errorMessage))
        }
      }

      xhr.onerror = () => {
        xhrMapRef.current.delete(uploadFile.id)
        const elapsed = (Date.now() - uploadStartTime) / 1000
        const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
        
        // 检查是否是 HTTP/2 协议错误（ERR_HTTP2_PROTOCOL_ERROR）
        const isHttp2Error = xhr.status === 0 && 
          (xhr.responseText === '' || xhr.responseText.includes('HTTP2') || xhr.responseText.includes('protocol'))
        
        const errorMessage = isHttp2Error
          ? `HTTP/2 协议错误（${fileSizeMb}MB），请重试（将自动降级到 HTTP/1.1）`
          : `网络错误：文件上传中断（${fileSizeMb}MB，已用时 ${Math.round(elapsed)}秒）。请检查网络连接或 Worker 服务状态`
        
        reject(new Error(errorMessage))
      }
      
      xhr.onabort = () => {
        xhrMapRef.current.delete(uploadFile.id)
        // 暂停时不 reject，让 promise 保持 pending
      }
      
      xhr.ontimeout = () => {
        xhrMapRef.current.delete(uploadFile.id)
        const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
        const timeoutMinutes = Math.round(timeout / 60000)
        reject(new Error(`上传超时：文件过大（${fileSizeMb}MB）或网络较慢，已等待 ${timeoutMinutes} 分钟。请检查网络连接后重试`))
      }

      // 使用相对路径，通过 Nginx 代理到 Worker API
      // 这样无论用户通过什么域名/IP 访问，都能正确路由
      xhr.open('PUT', `/worker-api/api/upload?key=${encodeURIComponent(originalKey)}`)
      xhr.setRequestHeader('Content-Type', uploadFile.file.type)
      uploadStartTime = Date.now()
      xhr.send(uploadFile.file)
    })

    // 触发处理（不阻塞，异步执行）
    fetch('/api/admin/photos/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
    }).catch((err) => {
      console.error('Failed to trigger photo processing:', err)
      // 处理 API 调用失败，延迟 3 秒后检查 pending 照片（事件驱动补偿）
      setTimeout(() => {
        fetch(`/api/admin/albums/${respAlbumId}/check-pending`, {
          method: 'POST',
        }).catch((checkErr) => {
          console.error('Failed to check pending photos:', checkErr)
        })
      }, 3000)
    })
  }

  // 分片上传（大文件）
  const uploadMultipart = async (
    uploadFile: UploadFile,
    photoId: string,
    originalKey: string,
    respAlbumId: string,
    retryCount = 0
  ) => {
    try {
      // 1. 初始化分片上传
      const initRes = await fetch('/api/worker/multipart/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: originalKey }),
      })

      if (!initRes.ok) {
        throw new Error('初始化分片上传失败')
      }

      const { uploadId } = await initRes.json()

      // 2. 计算分片数量
      const totalChunks = Math.ceil(uploadFile.file.size / CHUNK_SIZE)
      const parts: Array<{ partNumber: number; etag: string }> = []

      // 更新状态为上传中
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
        )
      )

      // 3. 并行上传分片（每批 2 个）
      const batchSize = 2
      let lastUpdateTime = Date.now()
      let lastUploadedBytes = 0
      
      for (let i = 0; i < totalChunks; i += batchSize) {
        const batch = []
        for (let j = i; j < Math.min(i + batchSize, totalChunks); j++) {
          const start = j * CHUNK_SIZE
          // 最后一个分片可以是任意大小（小于 5MB），其他分片必须是 5MB
          const isLastChunk = j === totalChunks - 1
          const end = Math.min(start + CHUNK_SIZE, uploadFile.file.size)
          const chunk = uploadFile.file.slice(start, end)
          
          // 验证分片大小（除了最后一个分片，必须至少 5MB）
          if (!isLastChunk && chunk.size < CHUNK_SIZE) {
            throw new Error(`分片 ${j + 1} 大小不足：期望至少 ${CHUNK_SIZE} 字节，实际 ${chunk.size} 字节`)
          }

          batch.push(
            (async () => {
              // 检查是否被暂停
              const currentFile = files.find(f => f.id === uploadFile.id)
              if (currentFile?.status === 'paused') {
                throw new Error('上传已暂停')
              }

              let partRetryCount = 0
              const maxPartRetries = 3
              
              while (partRetryCount < maxPartRetries) {
                try {
                  // 1. 获取分片的 presigned URL（通过 Next.js API 路由）
                  const presignRes = await fetch('/api/worker/multipart/presign-part', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      key: originalKey,
                      uploadId,
                      partNumber: j + 1,
                      expirySeconds: 3600, // 1小时有效期
                    }),
                  })

                  // 如果 presign-part 端点不存在（404），回退到通过 Worker API 上传
                  if (presignRes.status === 404) {
                    console.warn(`[Upload] presign-part endpoint not available (404), falling back to Worker API upload`)
                    // 回退到旧方式：通过 Worker API 上传分片
                    const partRes = await fetch(
                      `/api/worker/multipart/upload?key=${encodeURIComponent(originalKey)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${j + 1}`,
                      {
                        method: 'PUT',
                        body: chunk,
                        headers: {
                          'Content-Type': 'application/octet-stream',
                        },
                      }
                    )

                    if (!partRes.ok) {
                      const errorText = await partRes.text()
                      throw new Error(`上传分片 ${j + 1} 失败: HTTP ${partRes.status} ${errorText}`)
                    }

                    const partData = await partRes.json()
                    return { partNumber: j + 1, etag: partData.etag }
                  }

                  if (!presignRes.ok) {
                    const errorText = await presignRes.text()
                    throw new Error(`获取分片 ${j + 1} 上传地址失败: HTTP ${presignRes.status} ${errorText}`)
                  }

                  const { url: presignedUrl } = await presignRes.json()

                  // 2. 直接上传分片到 MinIO（绕过 Vercel）
                  // 如果直接上传失败（网络错误、连接关闭等），回退到 Worker API 上传
                  let etag = ''
                  let useWorkerFallback = false

                  try {
                    const partRes = await fetch(presignedUrl, {
                      method: 'PUT',
                      body: chunk,
                      headers: {
                        'Content-Type': 'application/octet-stream',
                      },
                    })

                    if (!partRes.ok) {
                      const errorText = await partRes.text()
                      console.warn(`[Upload] Direct upload failed: HTTP ${partRes.status} ${errorText}, falling back to Worker API`)
                      useWorkerFallback = true
                    } else {
                      // 从响应头获取 ETag（S3/MinIO 标准）
                      etag = partRes.headers.get('ETag')?.replace(/"/g, '') || ''
                      if (!etag) {
                        console.warn(`[Upload] No ETag received, falling back to Worker API`)
                        useWorkerFallback = true
                      }
                    }
                  } catch (networkError) {
                    // 网络错误：ERR_CONNECTION_CLOSED, TypeError 等
                    console.warn(`[Upload] Network error when uploading to MinIO:`, networkError instanceof Error ? networkError.message : networkError)
                    useWorkerFallback = true
                  }

                  // 回退到 Worker API 上传
                  if (useWorkerFallback) {
                    const partRes = await fetch(
                      `/api/worker/multipart/upload?key=${encodeURIComponent(originalKey)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${j + 1}`,
                      {
                        method: 'PUT',
                        body: chunk,
                        headers: {
                          'Content-Type': 'application/octet-stream',
                        },
                      }
                    )

                    if (!partRes.ok) {
                      const errorText = await partRes.text()
                      throw new Error(`上传分片 ${j + 1} 失败: HTTP ${partRes.status} ${errorText}`)
                    }

                    const partData = await partRes.json()
                    etag = partData.etag
                  }

                  return { partNumber: j + 1, etag }
                } catch (partError) {
                  partRetryCount++
                  if (partRetryCount >= maxPartRetries) {
                    throw partError
                  }
                  // 指数退避重试
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, partRetryCount)))
                }
              }
              
              throw new Error(`上传分片 ${j + 1} 失败：重试次数用尽`)
            })()
          )
        }

        const batchResults = await Promise.all(batch)
        // 过滤掉失败的结果（如果有的话）
        const successfulParts = batchResults.filter(p => p && p.partNumber && p.etag)
        parts.push(...successfulParts)

        // 更新进度和速度（基于已完成的分片数量）
        const completedChunks = parts.length
        const progress = Math.round((completedChunks / totalChunks) * 100)
        const now = Date.now()
        const timeDiff = (now - lastUpdateTime) / 1000 // 秒
        // 计算实际上传的字节数（考虑最后一个分片可能小于 CHUNK_SIZE）
        const uploadedBytes = Math.min(completedChunks * CHUNK_SIZE, uploadFile.file.size)
        const bytesDiff = uploadedBytes - lastUploadedBytes
        
        let speed = 0
        if (timeDiff >= 0.2 && bytesDiff > 0) {
          speed = bytesDiff / timeDiff
          lastUpdateTime = now
          lastUploadedBytes = uploadedBytes
        }
        
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id 
              ? { ...f, progress, ...(speed > 0 ? { speed } : {}) } 
              : f
          )
        )
      }

      // 验证所有分片都已上传
      if (parts.length !== totalChunks) {
        console.error(`[Upload] Parts count mismatch: expected ${totalChunks}, got ${parts.length}`)
        throw new Error(`上传不完整：期望 ${totalChunks} 个分片，实际 ${parts.length} 个`)
      }

      // 4. 完成分片上传
      // 去重并排序 parts（防止重复的 partNumber）
      const uniqueParts = Array.from(
        new Map(parts.map(p => [p.partNumber, p])).values()
      ).sort((a, b) => a.partNumber - b.partNumber)

      const completeRes = await fetch('/api/worker/multipart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: originalKey,
          uploadId,
          parts: uniqueParts,
        }),
      })

      if (!completeRes.ok) {
        const errorData = await completeRes.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || errorData.error || '完成分片上传失败'
        console.error('[Upload] Complete multipart upload failed:', errorMessage, errorData)
        throw new Error(`完成分片上传失败: ${errorMessage}`)
      }

      // 5. 触发处理
      fetch('/api/admin/photos/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
      }).catch((err) => {
        console.error('Failed to trigger photo processing:', err)
        setTimeout(() => {
          fetch(`/api/admin/albums/${respAlbumId}/check-pending`, {
            method: 'POST',
          }).catch(() => {})
        }, 3000)
      })

      // 更新状态为完成
      setFiles((prev) => {
        const currentFile = prev.find(f => f.id === uploadFile.id)
        if (currentFile?.status === 'paused') {
          return prev
        }
        return prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
        )
      })

      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)
      router.refresh()
    } catch (error) {
      // 检查是否是暂停导致的中断
      let shouldSkip = false
      setFiles((prev) => {
        const currentFile = prev.find(f => f.id === uploadFile.id)
        if (currentFile?.status === 'paused') {
          shouldSkip = true
        }
        return prev
      })

      if (shouldSkip) {
        return
      }

      // 检查是否为可重试的错误
      const err = error as Error & { retryable?: boolean }
      const errorMsg = err instanceof Error ? err.message : '分片上传失败'
      
      // 网络错误、超时错误可以重试
      const isRetryable = err.retryable !== false && 
        (errorMsg.includes('网络') || 
         errorMsg.includes('超时') || 
         errorMsg.includes('HTTP') ||
         errorMsg.includes('失败'))
      
      if (isRetryable && retryCount < MAX_RETRIES) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, error: `正在重试 (${retryCount + 1}/${MAX_RETRIES})...` }
              : f
          )
        )
        
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return uploadMultipart(uploadFile, photoId, originalKey, respAlbumId, retryCount + 1)
      }

      // 失败处理
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'failed' as const, error: errorMsg }
            : f
        )
      )

      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)
      router.refresh()
    }
  }

  // 小文件直接上传
  const uploadDirectly = async (
    uploadFile: UploadFile,
    photoId: string,
    uploadUrl: string,
    originalKey: string,
    respAlbumId: string,
    retryCount = 0
  ) => {
    let lastLoaded = 0
    let lastTime = Date.now()
    let uploadStartTime = Date.now()
    let finalProgress = 0 // 记录最终进度

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrMapRef.current.set(uploadFile.id, xhr) // 保存 XHR 引用
        
        // 设置超时时间（根据文件大小动态计算）
        const timeout = calculateTimeout(uploadFile.file.size)
        xhr.timeout = timeout
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            finalProgress = progress // 更新最终进度
            const now = Date.now()
            const timeDiff = (now - lastTime) / 1000
            
            let speed = 0
            if (timeDiff >= 0.2) {
              const bytesDiff = event.loaded - lastLoaded
              speed = bytesDiff / timeDiff
              lastLoaded = event.loaded
              lastTime = now
            }
            
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id 
                  ? { ...f, progress, ...(speed > 0 ? { speed } : {}) } 
                  : f
              )
            )
          }
        }

        xhr.onload = () => {
          xhrMapRef.current.delete(uploadFile.id)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            const errorText = xhr.responseText || ''
            let errorMessage = `上传失败: HTTP ${xhr.status}`
            try {
              const errorData = JSON.parse(errorText)
              if (errorData.error) {
                errorMessage = errorData.error.message || errorData.error || errorMessage
              }
            } catch {
              // 忽略解析错误，使用默认消息
            }
            reject(new Error(errorMessage))
          }
        }

        xhr.onerror = () => {
          xhrMapRef.current.delete(uploadFile.id)
          
          const elapsed = (Date.now() - uploadStartTime) / 1000
          const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
          
          // 检查上传进度，如果已经到95%以上，可能是实际上传成功了但 Cloudflare 关闭了连接
          // 这种情况通常发生在文件上传完成后，Cloudflare Proxy Write Timeout（30秒）导致连接关闭
          const isNearComplete = finalProgress >= 95
          
          // 如果进度接近100%且连接被关闭，可能是上传成功但响应丢失
          // 标记为"可能成功"，让 catch 块检查文件是否存在
          if (isNearComplete && xhr.status === 0 && xhr.readyState === 4) {
            const error = new Error(`上传可能已完成但连接中断（${fileSizeMb}MB，进度 ${finalProgress}%），正在检查文件...`) as Error & { retryable?: boolean; progress?: number; checkBeforeFail?: boolean }
            error.retryable = true // 标记为可重试，但实际上会在 catch 中检查
            error.progress = finalProgress
            error.checkBeforeFail = true // 标记需要先检查文件是否存在
            reject(error)
            return
          }
          
          // 强制关闭连接，释放资源
          try {
            xhr.abort()
          } catch {
            // 忽略 abort 错误
          }
          
          // 检查是否是 HTTP/2 协议错误（ERR_HTTP2_PROTOCOL_ERROR）
          // 这通常发生在 Cloudflare 使用 HTTP/2 但连接不稳定时
          const isHttp2Error = xhr.status === 0 && 
            (xhr.responseText === '' || xhr.responseText.includes('HTTP2') || xhr.responseText.includes('protocol'))
          
          // 判断是否为可重试的网络错误（连接中断、超时、HTTP/2 错误等）
          const isRetryableError = xhr.status === 0 || 
            xhr.readyState === 0 || 
            (xhr.statusText === '' && xhr.responseText === '') ||
            isHttp2Error
          
          const errorMessage = isHttp2Error
            ? `HTTP/2 协议错误（${fileSizeMb}MB），正在重试（将降级到 HTTP/1.1）...`
            : (isRetryableError && retryCount < MAX_RETRIES
              ? `网络连接中断（${fileSizeMb}MB，已用时 ${Math.round(elapsed)}秒），正在重试...`
              : `网络错误：文件上传中断（${fileSizeMb}MB，已用时 ${Math.round(elapsed)}秒）。请检查网络连接或 Worker 服务状态`)
          
          const error = new Error(errorMessage) as Error & { retryable?: boolean; isHttp2Error?: boolean; progress?: number }
          
          error.retryable = isRetryableError
          error.isHttp2Error = isHttp2Error
          error.progress = finalProgress // 记录进度，用于后续检查
          reject(error)
        }
        
        xhr.onabort = () => {
          xhrMapRef.current.delete(uploadFile.id)
          // 暂停时不 reject
        }
        
        xhr.ontimeout = () => {
          xhrMapRef.current.delete(uploadFile.id)
          const fileSizeMb = (uploadFile.file.size / (1024 * 1024)).toFixed(1)
          const timeoutMinutes = Math.round(timeout / 60000)
          
          const error = new Error(
            retryCount < MAX_RETRIES
              ? `上传超时（${fileSizeMb}MB，已等待 ${timeoutMinutes} 分钟），正在重试...`
              : `上传超时：文件过大（${fileSizeMb}MB）或网络较慢，已等待 ${timeoutMinutes} 分钟。请检查网络连接后重试`
          ) as Error & { retryable?: boolean }
          
          error.retryable = true
          reject(error)
        }

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', uploadFile.file.type)
        uploadStartTime = Date.now()
        xhr.send(uploadFile.file)
      })
    } catch (error) {
      // 检查上传进度，如果已经到95%以上，可能是实际上传成功了但连接被关闭
      // 这种情况通常发生在文件上传完成后，Cloudflare Proxy Write Timeout（30秒）导致连接关闭
      const err = error as Error & { retryable?: boolean; progress?: number; checkBeforeFail?: boolean }
      const progress = err.progress || 0
      const isNearComplete = progress >= 95
      
      // 如果进度接近100%且连接被关闭，先检查文件是否真的上传成功
      // 特别是标记了 checkBeforeFail 的错误（上传到100%后连接关闭）
      if ((isNearComplete && err.retryable) || err.checkBeforeFail) {
        try {
          // 等待3秒后检查照片是否已经在数据库中（给 MinIO 和 Worker 一些时间处理）
          // Cloudflare 可能在文件上传完成后30秒内关闭连接，所以需要等待一下
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // 先检查 completed 状态的照片
          const checkRes = await fetch(`/api/admin/albums/${albumId}/photos?status=completed`)
          if (checkRes.ok) {
            const data = await checkRes.json() as { photos?: Array<{ id: string }> }
            const photoExists = data?.photos?.some((p) => p.id === photoId)
            if (photoExists) {
              // 文件已存在，上传成功，直接返回（不抛出错误）
              return
            }
          }
          
          // 也检查 pending 状态的照片（可能正在处理中）
          const pendingRes = await fetch(`/api/admin/albums/${albumId}/photos?status=pending`)
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json() as { photos?: Array<{ id: string }> }
            const photoPending = pendingData?.photos?.some((p) => p.id === photoId)
            if (photoPending) {
              // 照片在 pending 状态，说明上传成功但还在处理中，认为上传成功
              return
            }
          }
          
          // 也检查 processing 状态（可能正在处理中）
          const processingRes = await fetch(`/api/admin/albums/${albumId}/photos?status=processing`)
          if (processingRes.ok) {
            const processingData = await processingRes.json() as { photos?: Array<{ id: string }> }
            const photoProcessing = processingData?.photos?.some((p) => p.id === photoId)
            if (photoProcessing) {
              return
            }
          }
        } catch (checkError) {
          // 检查失败，继续错误处理流程
          console.error('[Upload] Error checking file existence:', checkError)
        }
      }
      
      // 检查是否为可重试的错误
      if (err.retryable && retryCount < MAX_RETRIES) {
        // 更新状态显示重试信息
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, error: `正在重试 (${retryCount + 1}/${MAX_RETRIES})...` }
              : f
          )
        )
        
        // 等待一段时间后重试（指数退避）
        // HTTP/2 错误需要更长的延迟，让浏览器有机会重置连接
        const isHttp2Error = (err as Error & { isHttp2Error?: boolean }).isHttp2Error
        const baseDelay = isHttp2Error ? 3000 : 1000 // HTTP/2 错误基础延迟 3 秒
        const delay = Math.min(baseDelay * Math.pow(2, retryCount), isHttp2Error ? 30000 : 10000) // HTTP/2 错误最多30秒，其他最多10秒
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // 重新获取上传凭证（presigned URL 可能已过期）
        try {
          const credRes = await fetch(`/api/admin/albums/${albumId}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: uploadFile.file.name,
              contentType: uploadFile.file.type,
              fileSize: uploadFile.file.size,
              hash: uploadFile.hash,
            }),
          })
          
          if (!credRes.ok) {
            throw new Error('重新获取上传凭证失败')
          }
          
          const credData = await credRes.json()
          if (credData?.error || !credData?.uploadUrl) {
            throw new Error('重新获取上传凭证失败：无效响应')
          }
          
          // 如果创建了新的 photoId，清理旧的 photoId（避免数据库中有多个 pending 记录）
          const newPhotoId = credData.photoId as string | undefined
          if (newPhotoId && newPhotoId !== photoId) {
            try {
              await fetch(`/api/admin/photos/${photoId}/cleanup`, {
                method: 'DELETE',
              })
            } catch (cleanupErr) {
              console.warn(`[Upload] Failed to cleanup old photoId ${photoId} after retry:`, cleanupErr)
              // 继续重试，即使清理失败
            }
          }
          
          // 更新文件状态，使用新的 photoId
          const finalPhotoId = newPhotoId || photoId
          const finalAlbumId = credData.albumId || respAlbumId
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id 
                ? { 
                    ...f, 
                    progress: 0, 
                    error: undefined,
                    photoId: finalPhotoId,
                    respAlbumId: finalAlbumId
                  } 
                : f
            )
          )
          
          // 递归重试，使用新的 photoId
          return uploadDirectly(
            uploadFile,
            finalPhotoId,
            credData.uploadUrl,
            credData.originalKey || originalKey,
            finalAlbumId,
            retryCount + 1
          )
        } catch (retryError) {
          throw new Error(`重试失败：${retryError instanceof Error ? retryError.message : '未知错误'}`)
        }
      }
      
      // 不可重试或已达到最大重试次数，抛出错误
      throw error
    }

    // 上传成功后才触发处理（避免上传失败时也触发处理）
    // 触发处理（不阻塞，异步执行）
    fetch('/api/admin/photos/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, albumId: respAlbumId, originalKey }),
    }).catch((err) => {
      console.error('Failed to trigger photo processing:', err)
      // 处理 API 调用失败，延迟 3 秒后检查 pending 照片（事件驱动补偿）
      setTimeout(() => {
        fetch('/api/admin/albums/' + respAlbumId + '/check-pending', {
          method: 'POST',
        }).catch((checkErr) => {
          console.error('Failed to check pending photos:', checkErr)
        })
      }, 3000)
    })
  }

  // 暂停上传
  const pauseUpload = async (fileId: string) => {
    const xhr = xhrMapRef.current.get(fileId)
    const currentFile = files.find(f => f.id === fileId)
    
    if (xhr) {
      // 检查上传是否已经完成（readyState === 4 表示请求已完成）
      const isUploadCompleted = xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300
      
      // 如果上传已经完成，应该清理数据库记录而不是暂停
      if (isUploadCompleted && currentFile?.photoId) {
        // 上传已完成但用户暂停了，清理数据库记录
        try {
          const cleanupRes = await fetch(`/api/admin/photos/${currentFile.photoId}/cleanup`, {
            method: 'DELETE',
          })
          
          if (cleanupRes.ok) {
            // 标记为失败（因为用户取消了）
            setFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, status: 'failed' as const, error: '已取消上传' } : f
            ))
          } else {
            // 清理失败，仍然标记为暂停（可能 Worker 已经在处理）
            setFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
            ))
          }
        } catch (cleanupErr) {
          console.error(`[Upload] Failed to cleanup paused upload:`, cleanupErr)
          // 清理失败，仍然标记为暂停
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
          ))
        }
      } else {
        // 上传未完成，正常暂停
        xhr.abort()
        xhrMapRef.current.delete(fileId)
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
        ))
      }
      
      // 从队列中移除暂停的文件
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== fileId)
    } else if (currentFile?.photoId && currentFile.progress >= 100) {
      // 没有 XHR 引用但进度是 100%，说明上传已完成，清理数据库记录
      try {
        const cleanupRes = await fetch(`/api/admin/photos/${currentFile.photoId}/cleanup`, {
          method: 'DELETE',
        })
        
        if (cleanupRes.ok) {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'failed' as const, error: '已取消上传' } : f
          ))
        } else {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
          ))
        }
      } catch (cleanupErr) {
        console.error(`[Upload] Failed to cleanup paused upload:`, cleanupErr)
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
        ))
      }
      
      // 从队列中移除
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== fileId)
    } else {
      // 正常暂停（上传未完成，没有 photoId 或进度未到 100%）
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'paused' as const, speed: undefined } : f
      ))
      // 从队列中移除
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== fileId)
    }
  }

  // 恢复上传（重新开始）
  const resumeUpload = (file: UploadFile) => {
    // 如果文件已经完成上传，不应该恢复
    if (file.status === 'completed' || file.progress >= 100) {
      console.warn('[Upload] Cannot resume completed upload:', file.id)
      return
    }
    
    // 如果文件已经有 photoId 且进度很高，可能是上传完成但状态未更新，不应该重置
    if (file.photoId && file.progress >= 95) {
      console.warn('[Upload] Upload appears to be completed, not resetting:', file.id)
      return
    }
    
    // 确保文件 ID 不在队列中（避免重复）
    if (!uploadQueueRef.current.includes(file.id)) {
      uploadQueueRef.current.unshift(file.id) // 加到队列最前面
    }
    
    // 更新状态为 pending，并触发队列处理
    setFiles(prev => {
      const updated = prev.map(f => 
        f.id === file.id ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f
      )
      
      // 在状态更新后处理队列，确保状态已同步
      setTimeout(() => {
        processQueue()
      }, 0)
      
      return updated
    })
  }

  const uploadSingleFile = async (uploadFile: UploadFile) => {
    let photoId: string | undefined = undefined
    
    try {
      // 更新状态为上传中
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
        )
      )

      // 1. 获取上传凭证
      const credRes = await fetch(`/api/admin/albums/${albumId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.file.name,
          contentType: uploadFile.file.type,
          fileSize: uploadFile.file.size,
          hash: uploadFile.hash,
        }),
      })

      if (!credRes.ok) {
        // 尝试解析错误信息
        let errorMessage = '获取上传凭证失败'
        let photoIdFromError: string | undefined = undefined
        
        try {
          const errorData = await credRes.json()
          if (errorData?.error?.message) {
            errorMessage = errorData.error.message
            // 如果有详细信息，也添加到错误消息中
            if (errorData?.error?.details) {
              errorMessage += `: ${errorData.error.details}`
            }
            // 如果错误响应中包含 photoId，说明记录已创建但后续步骤失败
            if (errorData?.photoId) {
              photoIdFromError = errorData.photoId
            }
          } else if (errorData?.error) {
            errorMessage = typeof errorData.error === 'string' ? errorData.error : errorMessage
            if (errorData?.photoId) {
              photoIdFromError = errorData.photoId
            }
          }
        } catch {
          // 如果响应不是 JSON，使用状态文本
          errorMessage = `获取上传凭证失败 (${credRes.status} ${credRes.statusText})`
        }
        
        // 如果获取凭证失败但照片记录已创建，尝试清理
        if (photoIdFromError) {
          try {
            const cleanupRes = await fetch(`/api/admin/photos/${photoIdFromError}/cleanup`, {
              method: 'DELETE',
            })
            if (cleanupRes.ok) {
            } else {
              // 清理失败，延迟检查 pending 照片
              setTimeout(() => {
                fetch(`/api/admin/albums/${albumId}/check-pending`, {
                  method: 'POST',
                }).catch((checkErr) => {
                  console.error('Failed to check pending photos after credential failure:', checkErr)
                })
              }, 2000)
            }
          } catch (cleanupErr) {
            console.error('[Upload] Failed to cleanup photo record after credential failure:', cleanupErr)
            // 清理失败，延迟检查 pending 照片
            setTimeout(() => {
              fetch(`/api/admin/albums/${albumId}/check-pending`, {
                method: 'POST',
              }).catch((checkErr) => {
                console.error('Failed to check pending photos after credential failure:', checkErr)
              })
            }, 2000)
          }
        }
        
        throw new Error(errorMessage)
      }

      const credData = await credRes.json()
      
      // 检查响应中是否有错误
      if (credData?.error) {
        const errorMessage = credData.error.message || credData.error || '获取上传凭证失败'
        // 如果响应中包含 photoId，说明记录已创建但后续步骤失败，需要清理
        if (credData.photoId) {
          try {
            const cleanupRes = await fetch(`/api/admin/photos/${credData.photoId}/cleanup`, {
              method: 'DELETE',
            })
            if (cleanupRes.ok) {
            } else {
              // 清理失败，延迟检查 pending 照片
              setTimeout(() => {
                fetch(`/api/admin/albums/${albumId}/check-pending`, {
                  method: 'POST',
                }).catch((checkErr) => {
                  console.error('Failed to check pending photos after credential error:', checkErr)
                })
              }, 2000)
            }
          } catch (cleanupErr) {
            console.error('[Upload] Failed to cleanup photo record after credential error:', cleanupErr)
            // 清理失败，延迟检查 pending 照片
            setTimeout(() => {
              fetch(`/api/admin/albums/${albumId}/check-pending`, {
                method: 'POST',
              }).catch((checkErr) => {
                console.error('Failed to check pending photos after credential error:', checkErr)
              })
            }, 2000)
          }
        }
        throw new Error(errorMessage)
      }
      
      photoId = credData.photoId as string
      const { uploadUrl, originalKey, albumId: respAlbumId } = credData

      if (!photoId) {
        throw new Error('获取上传凭证失败：缺少photoId')
      }
      
      if (!uploadUrl) {
        // 如果缺少上传地址，说明获取凭证失败，尝试清理已创建的照片记录
        try {
          await fetch(`/api/admin/photos/${photoId}/cleanup`, {
            method: 'DELETE',
          })
        } catch (cleanupErr) {
          console.error('[Upload] Failed to cleanup photo record after missing uploadUrl:', cleanupErr)
        }
        throw new Error('获取上传凭证失败：缺少上传地址')
      }

      // 保存 photoId 和 respAlbumId 到 uploadFile，以便失败时清理和检查
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, photoId, respAlbumId } : f
        )
      )

      // 2. 根据文件大小选择上传方式
      // 大文件（>= 5MB）使用分片上传，确保分片符合 S3/MinIO 最小 5MB 要求
      if (uploadFile.file.size >= MULTIPART_THRESHOLD) {
        await uploadMultipart(uploadFile, photoId!, originalKey, respAlbumId)
      } else {
        // 小文件直接上传（避免分片上传的开销）
        await uploadDirectly(uploadFile, photoId!, uploadUrl, originalKey, respAlbumId)
      }

      // 3. 上传成功，触发 Worker 处理（uploadDirectly 内部已触发，这里确保状态更新）
      // 注意：处理请求在 uploadDirectly 内部异步触发，不阻塞
      
      // 更新状态为完成（前端显示）
      // 使用函数式更新确保获取最新状态
      setFiles((prev) => {
        const currentFile = prev.find(f => f.id === uploadFile.id)
        // 如果文件已被暂停，不标记为完成
        if (currentFile?.status === 'paused') {
          return prev
        }
        
        return prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
        )
      })
      
      // 从队列中移除已完成的文件
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)
      
      // 延迟刷新页面数据，给照片列表加载一些时间
      // 注意：onComplete 会在 useEffect 中检查所有文件完成后自动调用
      setTimeout(() => {
        router.refresh()
      }, 300)
    } catch (err) {
      // 检查是否是暂停导致的中断（使用函数式更新获取最新状态）
      let shouldSkip = false
      setFiles((prev) => {
        const currentFile = prev.find(f => f.id === uploadFile.id)
        if (currentFile?.status === 'paused') {
          shouldSkip = true
        }
        return prev // 不修改状态，只是检查
      })
      
      if (shouldSkip) {
        return // 暂停状态，不标记为失败
      }
      
      // 上传失败：清理数据库记录和 MinIO 文件
      // 协调机制：前端失败 → 清理数据库 → 清理 MinIO → Worker 队列任务自动跳过
      let cleanupSuccess = false
      let albumIdForCheck: string | undefined = undefined
      
      if (photoId) {
        try {
          const cleanupRes = await fetch(`/api/admin/photos/${photoId}/cleanup`, {
            method: 'DELETE',
          })
          
          if (cleanupRes.ok) {
            cleanupSuccess = true
          } else {
            const errorData = await cleanupRes.json().catch(() => ({}))
            console.error(`[Upload] Cleanup failed for ${photoId}:`, errorData)
            // 清理失败，记录相册 ID 以便后续检查
            albumIdForCheck = uploadFile.respAlbumId || albumId
          }
        } catch (cleanupErr) {
          console.error('[Upload] Failed to cleanup photo record:', cleanupErr)
          // 清理失败，记录相册 ID 以便后续检查
          albumIdForCheck = uploadFile.respAlbumId || albumId
        }
      } else {
        // 如果没有 photoId，说明可能是在获取凭证阶段就失败了
        // 但为了保险，还是检查一下相册的 pending 照片
        albumIdForCheck = uploadFile.respAlbumId || albumId
      }
      
      // 更新前端状态为失败
      const errorMessage = err instanceof Error ? err.message : '上传失败'
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'failed' as const,
                error: errorMessage,
              }
            : f
        )
      )
      
      // 从队列中移除失败的文件
      uploadQueueRef.current = uploadQueueRef.current.filter(id => id !== uploadFile.id)
      
      // 如果清理失败或没有 photoId，延迟检查 pending 照片（事件驱动补偿）
      if (albumIdForCheck && !cleanupSuccess) {
        setTimeout(() => {
          fetch(`/api/admin/albums/${albumIdForCheck}/check-pending`, {
            method: 'POST',
          }).catch((checkErr) => {
            console.error('Failed to check pending photos after upload failure:', checkErr)
          })
        }, 2000) // 延迟 2 秒，给清理操作一些时间
      }
      
      // 无论清理成功与否，都刷新页面数据以更新处理中的照片数量
      // 这样即使清理失败，用户也能看到实际状态
      // 注意：onComplete 会在 useEffect 中检查所有文件完成后自动调用
      router.refresh()
    } finally {
      // 上传完成（无论成功失败），处理队列中的下一个文件
      setTimeout(processQueue, 100)
    }
  }

  // 重试失败的上传
  const retryUpload = async (uploadFile: UploadFile) => {
    // 如果文件已经有 photoId，先检查一下照片是否已经在数据库中
    // 避免重复上传已完成的文件
    if (uploadFile.photoId) {
      try {
        const checkRes = await fetch(`/api/admin/albums/${albumId}/photos`)
        if (checkRes.ok) {
          const data = await checkRes.json() as { photos?: Array<{ id: string }> }
          if (data?.photos?.some((p) => p.id === uploadFile.photoId)) {
            // 照片已存在，更新状态为完成
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id
                  ? { ...f, status: 'completed' as const, progress: 100, error: undefined }
                  : f
              )
            )
            router.refresh()
            return
          }
        }
      } catch (checkErr) {
        console.warn('[Upload] Failed to check photo status before retry:', checkErr)
        // 继续重试流程
      }
    }
    
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id
          ? { ...f, status: 'pending' as const, progress: 0, error: undefined }
          : f
      )
    )
    // 将文件重新加入队列（如果不在队列中）
    if (!uploadQueueRef.current.includes(uploadFile.id)) {
      uploadQueueRef.current.push(uploadFile.id)
    }
    // 触发队列处理
    setTimeout(processQueue, 0)
  }

  const removeFile = (id: string) => {
    // 取消正在进行的上传
    const xhr = xhrMapRef.current.get(id)
    if (xhr) {
      xhr.abort()
      xhrMapRef.current.delete(id)
    }
    // 从队列中移除
    uploadQueueRef.current = uploadQueueRef.current.filter(fileId => fileId !== id)
    // 从文件列表中移除
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const completedCount = files.filter((f) => f.status === 'completed').length
  const uploadingCount = files.filter((f) => f.status === 'uploading').length
  const pausedCount = files.filter((f) => f.status === 'paused').length
  const pendingCount = files.filter((f) => f.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* 拖拽区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 md:p-8 text-center transition-colors',
          isDragging
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-border-light'
        )}
      >
        {/* 选择文件 */}
        <input
          type="file"
          id="file-input"
          multiple
          accept="image/jpeg,image/png,image/heic,image/webp,image/gif,image/tiff,.jpg,.jpeg,.png,.heic,.webp,.gif,.tiff,.tif"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(e.target.files)
              // 重置 input，允许重复选择相同文件
              e.target.value = ''
            }
          }}
          className="hidden"
        />
        {/* 选择文件夹（桌面端和 Android 支持） */}
        <input
          type="file"
          id="folder-input"
          multiple
          // @ts-expect-error webkitdirectory 是非标准属性但广泛支持
          webkitdirectory=""
          directory=""
          accept="image/jpeg,image/png,image/heic,image/webp,image/gif,image/tiff,.jpg,.jpeg,.png,.heic,.webp,.gif,.tiff,.tif"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(e.target.files)
              e.target.value = ''
            }
          }}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <Upload className="w-10 h-10 md:w-12 md:h-12 text-text-muted mx-auto mb-3 md:mb-4" />
          <p className="text-base md:text-lg font-medium mb-1 md:mb-2">
            点击选择文件<span className="hidden md:inline">，或拖拽照片到此处</span>
          </p>
          <p className="text-text-secondary text-xs md:text-sm mb-3">
            支持 JPG、PNG、HEIC、WebP 格式，单文件最大 100MB
          </p>
          {/* 按钮组 */}
          <div className="flex flex-wrap justify-center gap-2 mb-2">
            <label 
              htmlFor="file-input" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg cursor-pointer hover:bg-accent/90 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              选择照片
            </label>
            {!isIOS && (
              <label 
                htmlFor="folder-input" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-elevated text-text-primary border border-border rounded-lg cursor-pointer hover:bg-surface hover:border-border-light transition-colors text-sm font-medium"
                title="选择整个文件夹，一次性上传所有照片"
              >
                <FolderOpen className="w-4 h-4" />
                选择文件夹
              </label>
            )}
          </div>
          {isMobile && (
            <div className="mt-3 p-3 bg-surface-elevated rounded-lg border border-border text-left">
              <p className="text-xs font-medium text-text-primary mb-2">
                📱 移动端选择说明：
              </p>
              {isIOS ? (
                <div className="text-xs text-text-secondary space-y-1.5">
                  <p className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">ℹ</span>
                    <span><strong>默认打开</strong>：点击后会打开手机相册（Photos），不是相机存储卡</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span><strong>从相册选择</strong>：支持多选，可<strong>滑动选择</strong>多张照片（推荐）</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">⚠</span>
                    <span><strong>浏览文件系统</strong>：需要点击&ldquo;浏览&rdquo;或&ldquo;文件&rdquo;，但iOS限制只能<strong>单张点击选择</strong>，不能滑动</span>
                  </p>
                  <div className="pl-6 pt-1 space-y-1 text-text-muted">
                    <p>• <strong>相机存储卡照片</strong>：建议先导入手机相册，然后从相册多选上传</p>
                    <p>• <strong>USB连接相机</strong>：在文件选择器中找到&ldquo;USB存储&rdquo;或相机名称，但只能单选</p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-text-secondary space-y-1.5">
                  <p className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span><strong>选择文件夹</strong>：点击&ldquo;选择文件夹&rdquo;可一次性选择整个文件夹内所有照片（推荐）</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span><strong>多选照片</strong>：<strong>长按第一张</strong>进入选择模式，然后点击或滑动选择其他照片</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">ℹ</span>
                    <span>或点击右上角菜单选择<strong>&ldquo;选择多个&rdquo;</strong>进入多选模式</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 上传进度 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {uploadingCount > 0
                ? `正在上传 ${uploadingCount}/${MAX_CONCURRENT_UPLOADS}${pendingCount > 0 ? `，等待 ${pendingCount}` : ''}${pausedCount > 0 ? `，暂停 ${pausedCount}` : ''}`
                : pausedCount > 0
                ? `已暂停 ${pausedCount} 个，已完成 ${completedCount}/${files.length}`
                : `已完成 ${completedCount}/${files.length}`}
            </span>
            {completedCount === files.length && files.length > 0 && (
              <button
                onClick={() => setFiles([])}
                className="text-text-muted hover:text-text-primary"
              >
                清空列表
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-surface rounded-lg"
              >
                {/* 状态图标 */}
                <div className="shrink-0">
                  {file.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  )}
                  {file.status === 'paused' && (
                    <Pause className="w-5 h-5 text-yellow-400" />
                  )}
                  {file.status === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {file.status === 'failed' && (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  {file.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-text-muted" />
                  )}
                </div>

                {/* 文件信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    {file.status === 'uploading' && (
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-xs text-accent">{file.progress}%</span>
                        {file.speed && (
                          <span className="text-xs text-text-muted">{formatSpeed(file.speed)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {file.status === 'uploading' || file.status === 'paused' ? (
                    <div 
                      className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden cursor-pointer group/progress"
                      onClick={() => file.status === 'uploading' ? pauseUpload(file.id) : resumeUpload(file)}
                      title={file.status === 'uploading' ? '点击暂停' : '点击继续'}
                    >
                      <div 
                        className={cn(
                          "h-full transition-all duration-300 ease-out",
                          file.status === 'paused' ? 'bg-yellow-400' : 'bg-accent'
                        )}
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      {formatFileSize(file.file.size)}
                      {file.error && (
                        <span className="text-red-400 ml-2">{file.error}</span>
                      )}
                    </p>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* 暂停/继续按钮 */}
                  {file.status === 'uploading' && (
                    <button
                      onClick={() => pauseUpload(file.id)}
                      className="p-1 text-yellow-400 hover:text-yellow-300"
                      title="暂停"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  {file.status === 'paused' && (
                    <button
                      onClick={() => resumeUpload(file)}
                      className="p-1 text-green-400 hover:text-green-300"
                      title="继续"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {/* 重试按钮 */}
                  {file.status === 'failed' && (
                    <button
                      onClick={() => retryUpload(file)}
                      className="p-1 text-accent hover:text-accent/80"
                      title="重试"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {/* 移除按钮 */}
                  {file.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 text-text-muted hover:text-text-primary"
                      title="移除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
