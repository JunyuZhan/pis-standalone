'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  UserPlus,
  Trash2,
  Settings,
  Check,
  X,
  RefreshCw,
  Users,
  Crown,
  Edit,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'

interface Collaborator {
  id: string
  role: string
  permissions: {
    canUpload: boolean
    canEdit: boolean
    canDelete: boolean
    canManage: boolean
    canInvite: boolean
  }
  status: string
  invitedAt: string
  acceptedAt: string | null
  user: {
    id: string
    email: string
    role: string
  }
  invitedBy: {
    id: string
    email: string
  } | null
}

interface CollaboratorsResponse {
  albumId: string
  albumTitle: string
  ownerId: string
  collaborators: Collaborator[]
}

interface User {
  id: string
  email: string
  role: string
}

interface CollaboratorManagerProps {
  albumId: string
  albumTitle: string
}

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: '所有者', icon: Crown, color: 'text-yellow-600' },
  editor: { label: '编辑者', icon: Edit, color: 'text-blue-600' },
  viewer: { label: '查看者', icon: Eye, color: 'text-gray-600' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '待接受', color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: '已接受', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  removed: { label: '已移除', color: 'bg-gray-100 text-gray-800' },
}

export function CollaboratorManager({ albumId, albumTitle }: CollaboratorManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [newRole, setNewRole] = useState('editor')
  const [permissions, setPermissions] = useState({
    canUpload: true,
    canEdit: true,
    canDelete: false,
    canManage: false,
    canInvite: false,
  })
  const queryClient = useQueryClient()

  // 获取协作者列表
  const { data, isLoading, refetch } = useQuery<CollaboratorsResponse>({
    queryKey: ['album-collaborators', albumId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/albums/${albumId}/collaborators`)
      if (!res.ok) throw new Error('获取协作者失败')
      return res.json()
    },
  })

  // 获取可添加的用户列表
  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['available-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('获取用户列表失败')
      return res.json()
    },
  })

  // 添加协作者
  const addMutation = useMutation({
    mutationFn: async (data: { userId: string; role: string; permissions: typeof permissions }) => {
      const res = await fetch(`/api/admin/albums/${albumId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.userId,
          role: data.role,
          canUpload: data.permissions.canUpload,
          canEdit: data.permissions.canEdit,
          canDelete: data.permissions.canDelete,
          canManage: data.permissions.canManage,
          canInvite: data.permissions.canInvite,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '添加失败')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('已发送协作邀请')
      queryClient.invalidateQueries({ queryKey: ['album-collaborators', albumId] })
      setShowAddDialog(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // 更新协作者权限
  const updateMutation = useMutation({
    mutationFn: async (data: { collaboratorId: string; updates: Partial<typeof permissions> & { role?: string } }) => {
      const res = await fetch(`/api/admin/albums/${albumId}/collaborators/${data.collaboratorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: data.updates.role,
          canUpload: data.updates.canUpload,
          canEdit: data.updates.canEdit,
          canDelete: data.updates.canDelete,
          canManage: data.updates.canManage,
          canInvite: data.updates.canInvite,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '更新失败')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('权限已更新')
      queryClient.invalidateQueries({ queryKey: ['album-collaborators', albumId] })
      setShowEditDialog(false)
      setSelectedCollaborator(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // 移除协作者
  const removeMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      const res = await fetch(`/api/admin/albums/${albumId}/collaborators/${collaboratorId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '移除失败')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('已移除协作者')
      queryClient.invalidateQueries({ queryKey: ['album-collaborators', albumId] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const resetForm = () => {
    setSelectedUserId('')
    setNewRole('editor')
    setPermissions({
      canUpload: true,
      canEdit: true,
      canDelete: false,
      canManage: false,
      canInvite: false,
    })
  }

  const openEditDialog = (collaborator: Collaborator) => {
    setSelectedCollaborator(collaborator)
    setNewRole(collaborator.role)
    setPermissions(collaborator.permissions)
    setShowEditDialog(true)
  }

  // 过滤已有协作者的用户
  const availableUsers = (usersData?.users || []).filter(u => {
    const isCollaborator = data?.collaborators.some(
      c => c.user.id === u.id && c.status !== 'removed'
    )
    const isOwner = u.id === data?.ownerId
    return !isCollaborator && !isOwner
  })

  const collaborators = data?.collaborators.filter(c => c.status !== 'removed') || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Users className="w-5 h-5" />
          协作者管理
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="w-4 h-4 mr-1" />
                添加协作者
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加协作者</DialogTitle>
                <DialogDescription>
                  邀请用户协作管理相册「{albumTitle}」
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>选择用户</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择要邀请的用户" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>角色</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">编辑者</SelectItem>
                      <SelectItem value="viewer">查看者</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>权限设置</Label>
                  <div className="space-y-2">
                    {[
                      { key: 'canUpload', label: '上传照片' },
                      { key: 'canEdit', label: '编辑照片' },
                      { key: 'canDelete', label: '删除照片' },
                      { key: 'canManage', label: '管理设置' },
                      { key: 'canInvite', label: '邀请他人' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm">{label}</span>
                        <Switch
                          checked={permissions[key as keyof typeof permissions]}
                          onCheckedChange={(checked) =>
                            setPermissions(p => ({ ...p, [key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => addMutation.mutate({
                    userId: selectedUserId,
                    role: newRole,
                    permissions,
                  })}
                  disabled={!selectedUserId || addMutation.isPending}
                >
                  发送邀请
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 协作者列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : collaborators.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无协作者</p>
          <p className="text-sm">点击上方按钮添加协作者</p>
        </div>
      ) : (
        <div className="space-y-2">
          {collaborators.map(collaborator => {
            const roleInfo = ROLE_LABELS[collaborator.role] || ROLE_LABELS.viewer
            const statusInfo = STATUS_LABELS[collaborator.status] || STATUS_LABELS.pending
            const RoleIcon = roleInfo.icon

            return (
              <div
                key={collaborator.id}
                className="flex items-center justify-between p-3 bg-surface rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full bg-surface-elevated ${roleInfo.color}`}>
                    <RoleIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{collaborator.user.email}</span>
                      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{roleInfo.label}</span>
                      {collaborator.invitedBy && (
                        <span>• 由 {collaborator.invitedBy.email} 邀请</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {collaborator.status === 'accepted' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(collaborator)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('确定要移除此协作者吗？')) {
                        removeMutation.mutate(collaborator.id)
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 编辑权限对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑协作者权限</DialogTitle>
            <DialogDescription>
              修改 {selectedCollaborator?.user.email} 的协作权限
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">编辑者</SelectItem>
                  <SelectItem value="viewer">查看者</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>权限设置</Label>
              <div className="space-y-2">
                {[
                  { key: 'canUpload', label: '上传照片' },
                  { key: 'canEdit', label: '编辑照片' },
                  { key: 'canDelete', label: '删除照片' },
                  { key: 'canManage', label: '管理设置' },
                  { key: 'canInvite', label: '邀请他人' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={permissions[key as keyof typeof permissions]}
                      onCheckedChange={(checked) =>
                        setPermissions(p => ({ ...p, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (selectedCollaborator) {
                  updateMutation.mutate({
                    collaboratorId: selectedCollaborator.id,
                    updates: { role: newRole, ...permissions },
                  })
                }
              }}
              disabled={updateMutation.isPending}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
