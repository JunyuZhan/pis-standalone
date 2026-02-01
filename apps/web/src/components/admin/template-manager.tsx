'use client'

import { useState, useEffect } from 'react'
// useRouter removed as it's not used
import { Plus, Trash2, Edit2, Loader2, FileText } from 'lucide-react'
import type { AlbumTemplate } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showSuccess, handleApiError, showInfo } from '@/lib/toast'

export function TemplateManager() {
  const [templates, setTemplates] = useState<AlbumTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<AlbumTemplate | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'default' | 'danger'
  } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates')
      const data = await res.json()
      if (res.ok) {
        // API 返回格式是 { data: { templates: [...] } }
        setTemplates(data.data?.templates || data.templates || [])
      }
    } catch (error) {
      console.error('加载模板失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showInfo('请输入模板名称')
      return
    }

    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          // 使用默认值
          is_public: false,
          layout: 'masonry',
          sort_rule: 'capture_desc',
          allow_download: false,
          allow_batch_download: true,
          show_exif: true,
          watermark_enabled: false,
        }),
      })

      if (res.ok) {
        setShowCreateDialog(false)
        setFormData({ name: '', description: '' })
        showSuccess('模板创建成功')
        loadTemplates()
      } else {
        const data = await res.json()
        handleApiError(new Error(data.error?.message || '创建失败'))
      }
    } catch (error) {
      handleApiError(error, '创建失败，请重试')
    }
  }

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: '确定要删除这个模板吗？',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/templates/${id}`, {
            method: 'DELETE',
          })

          if (res.ok) {
            showSuccess('模板已删除')
            loadTemplates()
          } else {
            const data = await res.json()
            handleApiError(new Error(data.error?.message || '删除失败'))
          }
        } catch (error) {
          handleApiError(error, '删除失败，请重试')
        }
      },
    })
  }

  const handleEdit = (template: AlbumTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
    })
    setShowCreateDialog(true)
  }

  const handleUpdate = async () => {
    if (!editingTemplate || !formData.name.trim()) {
      showInfo('请输入模板名称')
      return
    }

    try {
      const res = await fetch(`/api/admin/templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      })

      if (res.ok) {
        setShowCreateDialog(false)
        setEditingTemplate(null)
        setFormData({ name: '', description: '' })
        showSuccess('模板已更新')
        loadTemplates()
      } else {
        const data = await res.json()
        handleApiError(new Error(data.error?.message || '更新失败'))
      }
    } catch (error) {
      handleApiError(error, '更新失败，请重试')
    }
  }

  const handleCloseDialog = () => {
    setShowCreateDialog(false)
    setEditingTemplate(null)
    setFormData({ name: '', description: '' })
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">相册模板</h3>
          <p className="text-sm text-text-muted mt-1">
            创建模板以快速复用相册配置
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="btn-primary text-sm"
        >
          <Plus className="w-4 h-4" />
          新建模板
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary mb-4">还没有模板</p>
          <button type="button" onClick={() => setShowCreateDialog(true)} className="btn-secondary">
            <Plus className="w-4 h-4" />
            创建第一个模板
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium">{template.name}</h4>
                  {template.description && (
                    <p className="text-sm text-text-muted mt-1">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(template)}
                    className="btn-ghost p-2 text-sm"
                    title="编辑"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="btn-ghost p-2 text-sm text-red-400 hover:text-red-300"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 text-xs text-text-muted">
                <span className="px-2 py-1 bg-surface rounded">
                  {template.layout === 'masonry' ? '瀑布流' : template.layout === 'grid' ? '网格' : '轮播'}
                </span>
                {template.is_public && (
                  <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">公开</span>
                )}
                {template.watermark_enabled && (
                  <span className="px-2 py-1 bg-surface rounded">水印</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑模板' : '新建模板'}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? '修改模板名称和描述'
                : '创建一个新的相册模板，创建相册时可以使用模板快速应用配置'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                模板名称 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="例如：婚礼相册模板"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                模板描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input min-h-[80px] resize-none"
                placeholder="可选的模板描述..."
              />
            </div>

            <div className="text-sm text-text-muted bg-surface p-3 rounded-lg">
              <p className="font-medium mb-1">提示：</p>
              <p>
                模板创建后，您可以在相册设置页面将当前配置保存为模板，或从模板加载配置。
                模板的详细设置（布局、水印等）需要在相册设置页面配置。
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <button type="button" onClick={handleCloseDialog} className="btn-secondary">
              取消
            </button>
            <button
              onClick={editingTemplate ? handleUpdate : handleCreate}
              className="btn-primary"
            >
              {editingTemplate ? '保存' : '创建'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmDialog(null)
            }
          }}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={async () => {
            await confirmDialog.onConfirm()
            setConfirmDialog(null)
          }}
        />
      )}
    </div>
  )
}
