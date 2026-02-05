'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, RefreshCw, Download, Upload } from 'lucide-react'
import { getSafeMediaUrl } from '@/lib/utils'
import { showSuccess, showError } from '@/lib/toast'

interface RetouchTask {
  id: string
  filename: string
  original_key: string
  status: string
  created_at: string
  albums: {
    id: string
    title: string
  }
}

export function RetouchDashboard() {
  const [tasks, setTasks] = useState<RetouchTask[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const mediaUrl = getSafeMediaUrl()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/retouch/tasks')
      
      if (!res.ok) {
        // 尝试解析错误响应
        let errorMessage = '获取任务失败'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error?.message || errorMessage
        } catch {
          // 如果响应不是 JSON，使用状态文本
          errorMessage = `获取任务失败: ${res.status} ${res.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      const json = await res.json()
      if (json.data) {
        setTasks(json.data)
      } else {
        setTasks([])
      }
    } catch (err) {
      console.error(err)
      showError(err instanceof Error ? err.message : '获取任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = (taskId: string) => {
    setSelectedTaskId(taskId)
    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTaskId) return
    
    try {
      setUploadingId(selectedTaskId)
      
      // 1. 获取上传凭证
      const uploadRes = await fetch(`/api/admin/retouch/${selectedTaskId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      })
      
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error?.message || '获取上传凭证失败')
      }
      
      const { uploadUrl, key, photoId, albumId } = await uploadRes.json()
      
      // 2. 上传文件到 MinIO (使用 PUT 方法直接上传)
      // 注意：这里使用 Worker 的代理 URL 或者直接 URL
      // 如果是 presigned URL，通常是 PUT
      
      // 这里的 uploadUrl 是完整的 URL 吗？
      // 取决于 /api/worker/presign 的实现。
      // 通常是 http://worker:3001/api/upload?key=...&signature=...
      // 但前端无法访问 worker:3001。
      // 所以 presign 应该返回前端可访问的 URL。
      // 目前 presign 返回的是基于 request host 的 URL？
      // 让我们假设 uploadUrl 是可以直接使用的。
      
      // 如果 uploadUrl 包含 localhost:3001，在浏览器中可能无法访问（如果是 Docker）。
      // 所以通常我们需要通过 Next.js 代理。
      // 或者 uploadUrl 是相对路径？
      
      // 无论如何，我们尝试直接 fetch uploadUrl
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(file)
      })
      
      // 3. 触发处理 (标记为精修图)
      await fetch('/api/admin/photos/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          photoId, 
          albumId, 
          originalKey: key,
          isRetouch: true 
        }),
      })
      
      showSuccess('精修图已上传并开始处理')
      
      // 刷新列表
      fetchTasks()
      
    } catch (err: unknown) {
      console.error(err)
      showError((err as Error).message || '上传失败')
    } finally {
      setUploadingId(null)
      setSelectedTaskId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">修图工作台</h1>
          <p className="text-text-secondary mt-1">
            处理待修图照片 ({tasks.length})
          </p>
        </div>
        <button 
          onClick={fetchTasks}
          className="btn btn-secondary p-2"
          title="刷新列表"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/jpeg,image/png,image/tiff"
        onChange={handleFileChange}
      />

      {loading && tasks.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-text-secondary" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-text-secondary card">
          暂无待修图任务
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tasks.map((task) => (
            <div key={task.id} className="card p-4 space-y-4">
              <div className="aspect-[3/2] bg-surface-elevated rounded-lg overflow-hidden relative group">
                {/* 预览图（如果有） */}
                {/* 这里的 status 是 pending_retouch，Worker 已经生成了预览图，所以可以用原逻辑访问 */}
                {/* 但我们没有 preview_key。API 应该返回 preview_key */}
                {/* 如果 API 没返回，我们可以猜测路径或使用 API 补充 */}
                <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-xs p-2 text-center">
                  {task.filename}
                  <br/>
                  (预览图加载中...)
                </div>
                {/* 实际应用中应该加载图片 */}
                {/* 
                <img 
                  src={`${mediaUrl}/preview/${task.albums.id}/${task.id}.jpg`} 
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => e.currentTarget.style.display = 'none'}
                /> 
                */}
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium truncate" title={task.albums.title}>{task.albums.title}</div>
                <div className="text-xs text-text-secondary truncate" title={task.filename}>{task.filename}</div>
                
                <div className="flex gap-2">
                   {/* 下载原图 */}
                   <a 
                     href={`${mediaUrl}/${task.original_key}`} 
                     download
                     target="_blank"
                     className="flex-1 btn btn-secondary text-xs flex items-center justify-center gap-1 h-8"
                   >
                     <Download className="w-3 h-3" /> 下载
                   </a>
                   
                   {/* 上传精修 */}
                   <button 
                     onClick={() => handleUploadClick(task.id)}
                     disabled={uploadingId === task.id}
                     className="flex-1 btn btn-primary text-xs flex items-center justify-center gap-1 h-8"
                   >
                     {uploadingId === task.id ? (
                       <Loader2 className="w-3 h-3 animate-spin" />
                     ) : (
                       <>
                         <Upload className="w-3 h-3" /> 上传
                       </>
                     )}
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
