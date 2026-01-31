'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    // 验证
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('请填写所有字段')
      setLoading(false)
      return
    }

    if (formData.newPassword.length < 6) {
      setError('新密码至少需要6个字符')
      setLoading(false)
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      setLoading(false)
      return
    }

    try {
      // 调用 API 路由更新密码
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || '密码修改失败')
        return
      }

      setSuccess(true)
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch {
      setError('密码修改失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400 flex items-center gap-2">
          <Check className="w-4 h-4" />
          密码修改成功
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">当前密码</label>
        <div className="relative">
          <input
            type={showCurrentPassword ? 'text' : 'password'}
            value={formData.currentPassword}
            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
            className="input pr-10"
            placeholder="请输入当前密码"
            required
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1.5 -m-1.5 rounded active:scale-[0.95] touch-manipulation"
            aria-label={showCurrentPassword ? '隐藏密码' : '显示密码'}
          >
            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">新密码</label>
        <div className="relative">
          <input
            type={showNewPassword ? 'text' : 'password'}
            value={formData.newPassword}
            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
            className="input pr-10"
            placeholder="至少6个字符"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1.5 -m-1.5 rounded active:scale-[0.95] touch-manipulation"
            aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
          >
            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">确认新密码</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="input pr-10"
            placeholder="请再次输入新密码"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1.5 -m-1.5 rounded active:scale-[0.95] touch-manipulation"
            aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            修改中...
          </>
        ) : (
          '修改密码'
        )}
      </button>
    </form>
  )
}
