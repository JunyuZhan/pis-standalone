'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, Edit2, Trash2, RefreshCw, Loader2, Shield, User, Palette, Eye } from 'lucide-react'
import { CreateUserDialog } from './create-user-dialog'
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

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const roleLabels: Record<UserRole, string> = {
  admin: '管理员',
  photographer: '摄影师',
  retoucher: '修图师',
  guest: '访客',
}

const roleIcons: Record<UserRole, typeof Shield> = {
  admin: Shield,
  photographer: User,
  retoucher: Palette,
  guest: Eye,
}

export function UserList() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'default' | 'danger'
  } | null>(null)

  useEffect(() => {
    loadUsers()
  }, [pagination.page, roleFilter, statusFilter, searchQuery])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (roleFilter !== 'all') {
        params.append('role', roleFilter)
      }

      if (statusFilter !== 'all') {
        params.append('is_active', statusFilter === 'active' ? 'true' : 'false')
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || '加载用户列表失败')
      }

      setUsers(data.data?.users || [])
      setPagination((prev) => ({
        ...prev,
        total: data.data?.pagination?.total || 0,
        totalPages: data.data?.pagination?.totalPages || 0,
      }))
    } catch (error) {
      handleApiError(error, '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (user: User) => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: `确定要删除用户 "${user.email}" 吗？此操作不可恢复。`,
      variant: 'danger',
      onConfirm: async () => {
        setIsDeleting(user.id)
        try {
          const response = await fetch(`/api/admin/users/${user.id}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error?.message || '删除失败')
          }

          showSuccess('用户已删除')
          loadUsers()
        } catch (error) {
          handleApiError(error, '删除用户失败')
        } finally {
          setIsDeleting(null)
          setConfirmDialog(null)
        }
      },
    })
  }

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false)
    loadUsers()
  }

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold">用户管理</h1>
          <p className="text-text-secondary text-sm md:text-base mt-1">
            管理系统用户和角色权限
          </p>
        </div>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>创建用户</span>
        </button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="搜索邮箱..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as UserRole | 'all')
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">全部角色</option>
            <option value="admin">管理员</option>
            <option value="photographer">摄影师</option>
            <option value="retoucher">修图师</option>
            <option value="guest">访客</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">全部状态</option>
            <option value="active">已激活</option>
            <option value="inactive">已禁用</option>
          </select>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-text-muted" />
            <p className="text-text-muted mt-2">加载中...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-text-muted">暂无用户</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">邮箱</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">角色</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">最后登录</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">创建时间</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-text-primary">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const RoleIcon = roleIcons[user.role]
                    return (
                      <tr key={user.id} className="hover:bg-background/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-text-primary">{user.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <RoleIcon className="w-4 h-4 text-text-muted" />
                            <span className="text-sm text-text-primary">{roleLabels[user.role]}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              user.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}
                          >
                            {user.is_active ? '已激活' : '已禁用'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {user.last_login_at ? formatRelativeTime(user.last_login_at) : '从未登录'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {formatRelativeTime(user.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => router.push(`/admin/users/${user.id}`)}
                              className="p-2 text-text-muted hover:text-text-primary hover:bg-background rounded-lg transition-colors"
                              title="编辑"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={isDeleting === user.id}
                              className="p-2 text-text-muted hover:text-destructive hover:bg-background rounded-lg transition-colors disabled:opacity-50"
                              title="删除"
                            >
                              {isDeleting === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                <div className="text-sm text-text-secondary">
                  共 {pagination.total} 个用户，第 {pagination.page} / {pagination.totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 text-sm bg-surface border border-border rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 text-sm bg-surface border border-border rounded-lg hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 创建用户对话框 */}
      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={handleCreateSuccess} />

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
