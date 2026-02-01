'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Database, FileX, HardDrive } from 'lucide-react'
import { showSuccess, handleApiError } from '@/lib/toast'

interface StorageCheckResult {
  album: {
    id: string
    title: string
  }
  summary: {
    dbPhotos: number
    rawFiles: number
    processedFiles: number
    missingInStorage: number
    missingInDb: number
  }
  details: {
    dbPhotos: Array<{
      id: string
      filename: string | null
      status: string
      original_key: string | null
      thumb_key: string | null
      preview_key: string | null
    }>
    missingInStorage: string[]
    missingInDb: string[]
  }
}

interface StorageCheckerProps {
  albumId: string
}

export function StorageChecker({ albumId }: StorageCheckerProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StorageCheckResult | null>(null)

  const handleCheck = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch(`/api/admin/albums/${albumId}/check-storage`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || '检查失败')
      }

      const data = await response.json()
      setResult(data)
      showSuccess('存储检查完成')
    } catch (error) {
      handleApiError(error, '执行存储检查失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">存储一致性检查</h3>
          <p className="text-sm text-text-muted mt-1">
            检查相册在 MinIO 中的文件情况，对比数据库记录和实际文件
          </p>
        </div>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              检查中...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              开始检查
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-4 space-y-4">
          {/* 摘要信息 */}
          <div className="p-4 bg-surface rounded-lg border border-border">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent" />
              检查摘要
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-text-muted">数据库照片数</p>
                <p className="text-lg font-bold">{result.summary.dbPhotos}</p>
              </div>
              <div>
                <p className="text-text-muted">原始文件数</p>
                <p className="text-lg font-bold">{result.summary.rawFiles}</p>
              </div>
              <div>
                <p className="text-text-muted">处理文件数</p>
                <p className="text-lg font-bold">{result.summary.processedFiles}</p>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <div>
                  <p className="text-text-muted">存储中缺失</p>
                  <p className="text-lg font-bold text-yellow-500">
                    {result.summary.missingInStorage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileX className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-text-muted">数据库中缺失</p>
                  <p className="text-lg font-bold text-orange-500">
                    {result.summary.missingInDb}
                  </p>
                </div>
              </div>
            </div>

            {result.summary.missingInStorage === 0 && result.summary.missingInDb === 0 && (
              <div className="mt-3 flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">存储一致性检查通过</span>
              </div>
            )}
          </div>

          {/* 详细信息 */}
          {(result.summary.missingInStorage > 0 || result.summary.missingInDb > 0) && (
            <div className="space-y-3">
              {result.details.missingInStorage.length > 0 && (
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <h5 className="font-semibold text-yellow-500 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    存储中缺失的文件 ({result.details.missingInStorage.length})
                  </h5>
                  <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                    {result.details.missingInStorage.map((file, index) => (
                      <li key={index} className="text-yellow-400">
                        • {file}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.details.missingInDb.length > 0 && (
                <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <h5 className="font-semibold text-orange-500 mb-2 flex items-center gap-2">
                    <FileX className="w-4 h-4" />
                    数据库中缺失的文件 ({result.details.missingInDb.length})
                  </h5>
                  <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                    {result.details.missingInDb.map((file, index) => (
                      <li key={index} className="text-orange-400">
                        • {file}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
