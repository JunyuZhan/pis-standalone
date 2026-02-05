'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Shield, Save, RefreshCw, Loader2, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showSuccess, handleApiError } from '@/lib/toast'
import { formatRelativeTime } from '@/lib/utils'

type UserRole = 'admin' | 'photographer' | 'retoucher' | 'guest'

interface User {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

interface UserDetailClientProps {
  user: User
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'photographer', label: '摄影师' },
  { value: 'retoucher', label: '修图师' },
  { value: 'guest', label: '访客' },
]

export function UserDetailClient({ user: initialUser }: UserDetailClientProps) {
  const router = useRouter()
  const [user, setUser] = useState<User>(initialUser)
  const [formData, setFormData] = useState({
    email: initialUser.email,
    role: initialUser.role,
    is_active: initialUser.is_active,
  })
  const [loading, setLoading] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'default' | 'danger'
  } | null>(null)

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || '更新失败')
      }

      showSuccess('用户信息已更新')
      setUser(data.data)
      router.refresh()
    } catch (error) {
      handleApiError(error, '更新用户信息失败')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = () => {
    setConfirmDialog({
      open: true,
      title: '确认重置密码',
      message: `确定要重置用户 "${user.email}" 的密码吗？重置后用户需要首次登录时设置新密码。`,
      variant: 'default',
      onConfirm: async () => {
        setResettingPassword(true)
        try {
          const response = await fetch(`/api/admin/users/${user.id}/reset-password`, {
            method: 'POST',
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error?.message || '重置密码失败')
          }

          showSuccess('密码已重置，用户首次登录时需要设置新密码')
          setConfirmDialog(null)
        } catch (error) {
          handleApiError(error, '重置密码失败')
        } finally {
          setResettingPassword(false)
        }
      },
    })
  }

  const handleDelete = () => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: `确定要删除用户 "${user.email}" 吗？此操作不可恢复。`,
      variant: 'danger',
      onConfirm: async () => {
        setLoading(true)
        try {
          const response = await fetch(`/api/admin/users/${user.id}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error?.message || '删除失败')
          }

          showSuccess('用户已删除')
          router.push('/admin/users')
        } catch (error) {
          handleApiError(error, '删除用户失败')
        } finally {
          setLoading(false)
          setConfirmDialog(null)
        }
      },
    })
  }

  const hasChanges =
    formData.email !== user.email ||
    formData.role !== user.role ||
    formData.is_active !== user.is_active

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <button
        onClick={() => router.push('/admin/users')}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回用户列表</span>
      </button>

      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-serif font-bold">用户详情</h1>
        <p className="text-text-secondary text-sm mt-1">管理用户信息和权限</p>
      </div>

      {/* 用户信息表单 */}
      <div className="bg-surface rounded-lg border border-border p-6 space-y-6">
        {/* 基本信息 */}
        <div>
          <h2 className="text-lg font-semibold mb-4">基本信息</h2>
          <div className="space-y-4">
            {/* 邮箱 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* 角色 */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-text-primary mb-2">
                <Shield className="w-4 h-4 inline mr-1" />
                角色
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 激活状态 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">状态</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.is_active === true}
                    onChange={() => setFormData((prev) => ({ ...prev, is_active: true }))}
                    className="w-4 h-4 text-accent"
                  />
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>已激活</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.is_active === false}
                    onChange={() => setFormData((prev) => ({ ...prev, is_active: false }))}
                    className="w-4 h-4 text-accent"
                  />
                  <XCircle className="w-4 h-4 text-gray-600" />
                  <span>已禁用</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={loading || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            <span>保存更改</span>
          </button>

          <button
            onClick={handleResetPassword}
            disabled={resettingPassword}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
          >
            {resettingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
            <RefreshCw className="w-4 h-4" />
            <span>重置密码</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除用户</span>
          </button>
        </div>
      </div>

      {/* 用户统计信息 */}
      <div className="bg-surface rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">统计信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-text-muted">用户ID</p>
            <p className="text-sm font-mono text-text-primary mt-1">{user.id}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">创建时间</p>
            <p className="text-sm text-text-primary mt-1">{formatRelativeTime(user.created_at)}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">最后登录</p>
            <p className="text-sm text-text-primary mt-1">
              {user.last_login_at ? formatRelativeTime(user.last_login_at) : '从未登录'}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-muted">最后更新</p>
            <p className="text-sm text-text-primary mt-1">{formatRelativeTime(user.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant || 'default'}
          onConfirm={confirmDialog.onConfirm}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmDialog(null)
            }
          }}
        />
      )}
    </div>
  )
}
