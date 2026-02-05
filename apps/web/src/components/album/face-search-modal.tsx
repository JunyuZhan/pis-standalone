
'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, Camera } from 'lucide-react'
import { showSuccess, showError } from '@/lib/toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface FaceSearchModalProps {
  albumSlug: string
  isOpen: boolean
  onClose: () => void
  onSearch: (photoIds: string[]) => void
}

export function FaceSearchModal({ albumSlug, isOpen, onClose, onSearch }: FaceSearchModalProps) {
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/public/albums/${albumSlug}/search-face`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('搜索失败')
      }

      const data = await res.json()
      
      if (data.photos.length === 0) {
        showSuccess('未找到匹配的照片')
      } else {
        showSuccess(`找到 ${data.photos.length} 张照片`)
        const photoIds = data.photos.map((p: { id: string }) => p.id)
        onSearch(photoIds)
        onClose()
      }
    } catch (err) {
      console.error(err)
      showError('搜索出错，请重试')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>人脸搜索</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 gap-4">
          <div className="w-24 h-24 bg-accent/10 rounded-full flex items-center justify-center mb-2">
            <Camera className="w-10 h-10 text-accent" />
          </div>
          <p className="text-center text-text-secondary mb-4">
            上传一张您的自拍，我们将为您找到相册中包含您的照片。
          </p>
          
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="btn btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在搜索...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                上传自拍
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
