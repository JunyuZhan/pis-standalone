'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Loader2, Folder, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showSuccess, handleApiError, showInfo } from '@/lib/toast'
import type { PhotoGroup } from '@/types/database'
import { cn } from '@/lib/utils'

interface PhotoGroupManagerProps {
  albumId: string
  onGroupSelect?: (groupId: string | null) => void
  selectedGroupId?: string | null
}

interface GroupWithCount extends PhotoGroup {
  photo_count: number
}

export function PhotoGroupManager({
  albumId,
  onGroupSelect,
  selectedGroupId,
}: PhotoGroupManagerProps) {
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<GroupWithCount | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'default' | 'danger'
  } | null>(null)

  // 加载分组列表
  const loadGroups = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/groups`)
      if (response.ok) {
        const data = await response.json()
        // API 返回格式是 { data: { groups: [...] } }
        setGroups(data.data?.groups || data.groups || [])
      }
    } catch (error) {
      console.error('Failed to load groups:', error)
    } finally {
      setLoading(false)
    }
  }, [albumId])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  // 创建分组
  const handleCreate = async (name: string, description?: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description }),
      })

      if (response.ok) {
        await loadGroups()
        setShowCreateDialog(false)
        showSuccess('分组创建成功')
      } else {
        const data = await response.json()
        handleApiError(new Error(data.error?.message || '创建失败'))
      }
    } catch (error) {
      console.error('Failed to create group:', error)
      handleApiError(error, '创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 更新分组
  const handleUpdate = async (groupId: string, name: string, description?: string, sortOrder?: number) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, sort_order: sortOrder }),
      })

      if (response.ok) {
        await loadGroups()
        setEditingGroup(null)
        showSuccess('分组已更新')
      } else {
        const data = await response.json()
        handleApiError(new Error(data.error?.message || '更新失败'))
      }
    } catch (error) {
      console.error('Failed to update group:', error)
      handleApiError(error, '更新失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 删除分组
  const handleDelete = (groupId: string) => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: '确定要删除此分组吗？分组中的照片不会被删除，只是解除分组关联。',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/admin/albums/${albumId}/groups/${groupId}`, {
            method: 'DELETE',
          })

          if (response.ok) {
            await loadGroups()
            showSuccess('分组已删除')
            // 如果删除的是当前选中的分组，清除选择
            if (selectedGroupId === groupId && onGroupSelect) {
              onGroupSelect(null)
            }
          } else {
            const data = await response.json()
            handleApiError(new Error(data.error?.message || '删除失败'))
          }
        } catch (error) {
          console.error('Failed to delete group:', error)
          handleApiError(error, '删除失败')
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 分组列表 - 移动端可横向滚动 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {/* 全部照片 */}
        <button
          onClick={() => onGroupSelect?.(null)}
          className={cn(
            'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
            'min-h-[44px] flex items-center justify-center', // 移动端最小触摸目标
            selectedGroupId === null
              ? 'bg-accent text-background'
              : 'bg-surface text-text-secondary hover:bg-surface-elevated active:scale-95'
          )}
        >
          全部照片
        </button>

        {/* 分组标签 */}
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onGroupSelect?.(group.id)}
            className={cn(
              'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0',
              'min-h-[44px]', // 移动端最小触摸目标
              selectedGroupId === group.id
                ? 'bg-accent text-background'
                : 'bg-surface text-text-secondary hover:bg-surface-elevated active:scale-95'
            )}
          >
            <Folder className="w-4 h-4 flex-shrink-0" />
            <span>{group.name}</span>
            {group.photo_count > 0 && (
              <span className="text-xs opacity-75">({group.photo_count})</span>
            )}
          </button>
        ))}

        {/* 创建分组按钮 */}
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-surface text-text-secondary hover:bg-surface-elevated transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0 min-h-[44px] active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">新建分组</span>
          <span className="sm:hidden">新建</span>
        </button>
      </div>

      {/* 创建/编辑对话框 */}
      {(showCreateDialog || editingGroup) && (
        <GroupDialog
          group={editingGroup}
          onSave={(name, description, sortOrder) => {
            if (!name.trim()) {
              showInfo('分组名称不能为空')
              return
            }
            if (editingGroup) {
              handleUpdate(editingGroup.id, name, description, sortOrder)
            } else {
              handleCreate(name, description)
            }
          }}
          onClose={() => {
            setShowCreateDialog(false)
            setEditingGroup(null)
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* 分组管理（编辑/删除） - 移动端优化 */}
      {groups.length > 0 && (
        <div className="card p-3 sm:p-4">
          <h3 className="text-sm font-medium mb-3 text-text-secondary">分组管理</h3>
          <div className="space-y-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-start sm:items-center justify-between p-3 bg-surface rounded-lg gap-3"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Folder className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{group.name}</div>
                    {group.description && (
                      <div className="text-xs text-text-muted mt-1 line-clamp-2">{group.description}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">
                      {group.photo_count} 张照片
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditingGroup(group)}
                    className="p-2 sm:p-2.5 hover:bg-surface-elevated rounded transition-colors active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-text-muted" />
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="p-2 sm:p-2.5 hover:bg-surface-elevated rounded transition-colors active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(open ? confirmDialog : null)}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </div>
  )
}

// 分组对话框组件
function GroupDialog({
  group,
  onSave,
  onClose,
  isSubmitting,
}: {
  group: GroupWithCount | null
  onSave: (name: string, description?: string, sortOrder?: number) => void
  onClose: () => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [sortOrder, setSortOrder] = useState(group?.sort_order?.toString() || '0')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      // 验证在父组件中处理
      return
    }
    onSave(name.trim(), description.trim() || undefined, Number(sortOrder) || 0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-md p-4 sm:p-6 m-0 sm:m-4 rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto safe-area-inset-bottom">
        <div className="flex items-center justify-between mb-4 sm:mb-6 sticky top-0 bg-surface-elevated -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 sm:pt-0 pb-2 border-b border-border sm:border-none">
          <h2 className="text-lg sm:text-xl font-semibold">
            {group ? '编辑分组' : '新建分组'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded transition-colors active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">
              分组名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：签到、会议、颁奖、晚宴"
              className="input w-full text-base" // 移动端防止缩放
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">
              描述（可选）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="分组描述..."
              rows={3}
              className="input w-full text-base resize-none" // 移动端防止缩放
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">
              排序顺序
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="数字越小越靠前"
              className="input w-full text-base" // 移动端防止缩放
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 sm:pt-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 min-h-[48px] text-base"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 min-h-[48px] text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
