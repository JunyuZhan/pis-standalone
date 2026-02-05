'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, RefreshCw, Download, GitBranch, GitCommit, Clock, Loader2, Server } from 'lucide-react'
import { showSuccess, handleApiError } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface UpgradeStatus {
  currentCommit: string
  currentBranch: string
  remoteCommit: string | null
  hasUpdate: boolean
  uncommittedChanges: boolean
  lastChecked: string
}

interface UpgradeLog {
  type: 'start' | 'stdout' | 'stderr' | 'success' | 'error'
  message: string
  stdout?: string
  stderr?: string
}

export function UpgradeManager() {
  const [checking, setChecking] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [status, setStatus] = useState<UpgradeStatus | null>(null)
  const [logs, setLogs] = useState<UpgradeLog[]>([])
  const [skipRestart, setSkipRestart] = useState(false)
  const [rebuildImages, setRebuildImages] = useState(false)

  // 组件加载时自动检查
  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    setChecking(true)
    try {
      const response = await fetch('/api/admin/upgrade/check')
      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error?.message || data.error?.details || '检查失败'
        throw new Error(errorMessage)
      }

      setStatus(data)
    } catch (error) {
      handleApiError(error, '检查版本状态失败')
    } finally {
      setChecking(false)
    }
  }

  const executeUpgrade = async () => {
    if (!status?.hasUpdate && !status?.uncommittedChanges) {
      showSuccess('已是最新版本，无需升级')
      return
    }

    if (!confirm('确定要执行升级吗？升级过程中服务可能会短暂中断。')) {
      return
    }

    setUpgrading(true)
    setLogs([])

    try {
      const response = await fetch('/api/admin/upgrade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipRestart, rebuildImages }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || '升级失败')
      }

      // 读取流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              setLogs((prev) => [...prev, data])

              if (data.type === 'success') {
                showSuccess('升级完成')
                // 重新检查状态
                setTimeout(() => {
                  checkStatus()
                }, 2000)
              } else if (data.type === 'error') {
                handleApiError(new Error(data.message), '升级失败')
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      handleApiError(error, '执行升级失败')
    } finally {
      setUpgrading(false)
    }
  }

  const formatCommit = (commit: string) => {
    return commit ? commit.substring(0, 7) : 'N/A'
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-4">
      {/* 版本状态 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">版本信息</h3>
          <button
            onClick={checkStatus}
            disabled={checking}
            className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', checking && 'animate-spin')} />
            刷新
          </button>
        </div>

        {status ? (
          <div className="space-y-3 p-4 bg-surface rounded-lg border border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-text-muted" />
                <span className="text-text-muted">当前分支:</span>
                <span className="font-medium font-mono">{status.currentBranch}</span>
              </div>
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-text-muted" />
                <span className="text-text-muted">当前提交:</span>
                <span className="font-medium font-mono">{formatCommit(status.currentCommit)}</span>
              </div>
              {status.remoteCommit && (
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">远程提交:</span>
                  <span className="font-medium font-mono">{formatCommit(status.remoteCommit)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-muted" />
                <span className="text-text-muted">最后检查:</span>
                <span className="font-medium">{formatDate(status.lastChecked)}</span>
              </div>
            </div>

            {/* 更新状态 */}
            <div className="mt-3 pt-3 border-t border-border">
              {status.hasUpdate ? (
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">有新版本可用</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">已是最新版本</span>
                </div>
              )}

              {status.uncommittedChanges && (
                <div className="mt-2 flex items-center gap-2 text-orange-500">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">检测到未提交的更改，升级脚本会自动暂存</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-surface rounded-lg border border-border text-center text-text-muted">
            {checking ? '检查中...' : '点击刷新按钮检查版本状态'}
          </div>
        )}
      </div>

      {/* 升级选项 */}
      {status && (status.hasUpdate || status.uncommittedChanges) && (
        <div>
          <h3 className="text-base font-semibold mb-2">升级选项</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rebuildImages}
                onChange={(e) => setRebuildImages(e.target.checked)}
                className="rounded border-border mt-0.5"
                disabled={upgrading}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">重新构建镜像（无缓存）</span>
                <p className="text-xs text-text-muted mt-1">
                  适用于依赖更新、Dockerfile 修改或构建配置变更。构建时间较长，但确保镜像完全更新。
                </p>
                <div className="mt-1 text-xs text-text-muted">
                  <p className="font-medium mb-0.5">建议在以下情况使用：</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>package.json 或 pnpm-lock.yaml 有变更</li>
                    <li>Dockerfile 有修改</li>
                    <li>构建时环境变量（NEXT_PUBLIC_*）有变更</li>
                    <li>镜像损坏或容器启动异常</li>
                  </ul>
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={skipRestart}
                onChange={(e) => setSkipRestart(e.target.checked)}
                className="rounded border-border mt-0.5"
                disabled={upgrading}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">跳过容器重启</span>
                <p className="text-xs text-text-muted mt-1">
                  仅更新代码和配置，不重启 Docker 容器。需要手动重启容器以应用更改。
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* 升级按钮 */}
      {status && (status.hasUpdate || status.uncommittedChanges) && (
        <button
          onClick={executeUpgrade}
          disabled={upgrading || checking}
          className="btn-primary flex items-center gap-2 w-full"
        >
          {upgrading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              升级中...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              开始升级
            </>
          )}
        </button>
      )}

      {/* 升级日志 */}
      {logs.length > 0 && (
        <div className="mt-4">
          <h3 className="text-base font-semibold mb-2">升级日志</h3>
          <div className="p-4 bg-surface rounded-lg border border-border max-h-96 overflow-y-auto">
            <div className="space-y-1 font-mono text-sm">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    'py-1 px-2 rounded',
                    log.type === 'stderr' || log.type === 'error'
                      ? 'bg-red-500/10 text-red-400'
                      : log.type === 'success'
                      ? 'bg-green-500/10 text-green-400'
                      : 'text-text-secondary'
                  )}
                >
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
        <div className="flex items-start gap-2">
          <Server className="w-4 h-4 text-blue-500 mt-0.5" />
          <div className="flex-1 text-sm text-blue-400">
            <p className="font-medium mb-1">升级说明：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>升级会自动拉取最新代码并更新配置</li>
              <li>默认会自动重启 Docker 容器以应用更改</li>
              <li>升级过程中服务可能会短暂中断</li>
              <li>建议在低峰期执行升级操作</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
