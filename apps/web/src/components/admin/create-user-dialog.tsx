'use client'

import { useState } from 'react'
import { Loader2, Mail, Lock, Shield } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { showSuccess, handleApiError } from '@/lib/toast'

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type UserRole = 'admin' | 'photographer' | 'retoucher' | 'guest'

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'photographer', label: '摄影师' },
  { value: 'retoucher', label: '修图师' },
  { value: 'guest', label: '访客' },
]

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 验证邮箱格式
    if (!email.trim() || !email.includes('@')) {
      setError('请输入有效的邮箱地址')
      return
    }

    // 如果提供了密码，验证密码长度
    if (password && password.length > 0 && password.length < 8) {
      setError('密码至少需要 8 个字符')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim() || undefined,
          role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || '创建用户失败')
      }

      showSuccess('用户创建成功')
      setEmail('')
      setPassword('')
      setRole('admin')
      setError('')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      handleApiError(error, '创建用户失败')
      setError(error instanceof Error ? error.message : '创建用户失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>创建新用户</DialogTitle>
          <DialogDescription>创建新的系统用户账户</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              邮箱地址 <span className="text-destructive">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* 密码 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              密码 <span className="text-text-muted text-xs">(可选，留空则首次登录时设置)</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="留空则首次登录时设置"
              minLength={8}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {password && password.length > 0 && password.length < 8 && (
              <p className="text-xs text-destructive mt-1">密码至少需要 8 个字符</p>
            )}
          </div>

          {/* 角色 */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-text-primary mb-2">
              <Shield className="w-4 h-4 inline mr-1" />
              角色
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                setEmail('')
                setPassword('')
                setRole('admin')
                setError('')
              }}
              className="px-4 py-2 text-sm bg-surface border border-border rounded-lg hover:bg-background transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="px-4 py-2 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              创建用户
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
