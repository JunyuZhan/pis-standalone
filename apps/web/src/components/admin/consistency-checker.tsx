'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Database, FileX, Trash2 } from 'lucide-react'
import { showSuccess, handleApiError } from '@/lib/toast'

interface ConsistencyCheckResult {
  success: boolean
  result?: {
    totalChecked?: number
    inconsistencies?: number
    fixed?: number
    orphanedFiles?: number
    orphanedRecords?: number
    errors?: string[]
    orphanedFilesDetails?: Array<{
      key: string
      size: number
      lastModified: string
    }>
    inconsistentPhotosDetails?: Array<{
      photoId: string
      albumId: string
      filename: string
      issue: string
      action: string
    }>
  }
}

export function ConsistencyChecker() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ConsistencyCheckResult | null>(null)
  const [options, setOptions] = useState({
    autoFix: false,
    deleteOrphanedFiles: false,
    deleteOrphanedRecords: false,
    batchSize: 100,
  })

  const handleCheck = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/consistency/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error?.message || data.error?.details || '检查失败'
        throw new Error(errorMessage)
      }

      setResult(data)
      showSuccess('一致性检查完成')
    } catch (error) {
      handleApiError(error, '执行一致性检查失败')
      setResult({ success: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold mb-2">检查选项</h3>
        <div className="space-y-4">
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={options.autoFix}
              onChange={(e) => setOptions({ ...options, autoFix: e.target.checked })}
              className="rounded border-border mt-0.5"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">自动修复不一致记录</span>
              <p className="text-xs text-text-muted mt-1">
                发现照片记录与文件不一致时自动修复：
                <br />• pending 状态但原图缺失 → 删除记录
                <br />• completed 状态但文件缺失 → 标记为待处理
              </p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={options.deleteOrphanedFiles}
              onChange={(e) => setOptions({ ...options, deleteOrphanedFiles: e.target.checked })}
              className="rounded border-border mt-0.5"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">删除孤立文件</span>
              <p className="text-xs text-text-muted mt-1">
                删除存储中存在但数据库中没有对应记录的文件（占用存储空间但无法访问）
              </p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={options.deleteOrphanedRecords}
              onChange={(e) => {
                if (e.target.checked && !options.autoFix) {
                  alert('删除孤立记录需要同时启用"自动修复不一致记录"')
                  return
                }
                setOptions({ ...options, deleteOrphanedRecords: e.target.checked })
              }}
              className="rounded border-border mt-0.5"
              disabled={!options.autoFix}
            />
            <div className="flex-1">
              <span className="text-sm font-medium">删除孤立记录</span>
              <p className="text-xs text-text-muted mt-1">
                删除数据库中存在但存储中没有对应文件的记录（需要同时启用自动修复）
                {!options.autoFix && (
                  <span className="text-yellow-500 block mt-1">⚠️ 请先启用"自动修复不一致记录"</span>
                )}
              </p>
            </div>
          </label>
          <div className="flex items-center gap-2">
            <label className="text-sm">批次大小:</label>
            <input
              type="number"
              min="10"
              max="1000"
              value={options.batchSize}
              onChange={(e) => setOptions({ ...options, batchSize: parseInt(e.target.value) || 100 })}
              className="w-20 px-2 py-1 text-sm border border-border rounded bg-background"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleCheck}
        disabled={loading}
        className="btn-primary flex items-center gap-2"
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

      {result && (
        <div className="mt-4 p-4 bg-surface rounded-lg border border-border">
          {result.success && result.result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {result.result.inconsistencies === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <h4 className="font-semibold">
                  {result.result.inconsistencies === 0 ? '检查通过' : '发现不一致'}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">检查记录数:</span>
                  <span className="font-medium">{result.result.totalChecked || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="text-text-muted">不一致记录:</span>
                  <span className="font-medium">{result.result.inconsistencies || 0}</span>
                </div>
                {result.result.fixed !== undefined && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-text-muted">已修复:</span>
                    <span className="font-medium">{result.result.fixed}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FileX className="w-4 h-4 text-orange-500" />
                  <span className="text-text-muted">孤立文件:</span>
                  <span className="font-medium">{result.result.orphanedFiles || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <span className="text-text-muted">孤立记录:</span>
                  <span className="font-medium">{result.result.orphanedRecords || 0}</span>
                </div>
              </div>

              {/* 显示不一致照片详情 */}
              {result.result.inconsistentPhotosDetails && result.result.inconsistentPhotosDetails.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-500/10 rounded border border-yellow-500/20">
                  <p className="text-sm font-medium text-yellow-500 mb-2">不一致照片详情:</p>
                  <ul className="text-sm text-yellow-400 space-y-1">
                    {result.result.inconsistentPhotosDetails.map((photo, index) => (
                      <li key={index}>
                        • {photo.filename} ({photo.photoId.slice(0, 8)}...): {photo.issue} - {photo.action === 'none' ? '未处理' : photo.action === 'marked_for_reprocessing' ? '已标记重新处理' : '已删除'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 显示孤立文件详情 */}
              {result.result.orphanedFilesDetails && result.result.orphanedFilesDetails.length > 0 && (
                <div className="mt-3 p-3 bg-orange-500/10 rounded border border-orange-500/20">
                  <p className="text-sm font-medium text-orange-500 mb-2">孤立文件详情（存储中存在但数据库无记录）:</p>
                  <ul className="text-sm text-orange-400 space-y-1">
                    {result.result.orphanedFilesDetails.map((file, index) => (
                      <li key={index}>
                        • {file.key} ({(file.size / 1024).toFixed(2)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.result.errors && result.result.errors.length > 0 && (
                <div className="mt-3 p-3 bg-red-500/10 rounded border border-red-500/20">
                  <p className="text-sm font-medium text-red-500 mb-2">错误信息:</p>
                  <ul className="text-sm text-red-400 space-y-1">
                    {result.result.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <span>检查失败，请查看控制台或联系管理员</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
