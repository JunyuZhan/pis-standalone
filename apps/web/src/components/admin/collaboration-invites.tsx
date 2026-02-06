'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Check,
  X,
  RefreshCw,
  Mail,
  Image,
  ExternalLink,
  Users,
  LogOut,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Invitation {
  id: string
  role: string
  permissions: {
    canUpload: boolean
    canEdit: boolean
    canDelete: boolean
    canManage: boolean
    canInvite: boolean
  }
  invitedAt: string
  album: {
    id: string
    title: string
    slug: string
    photo_count: number
  }
  invitedBy: {
    id: string
    email: string
  }
}

interface Collaboration {
  id: string
  role: string
  permissions: {
    canUpload: boolean
    canEdit: boolean
    canDelete: boolean
    canManage: boolean
    canInvite: boolean
  }
  acceptedAt: string
  album: {
    id: string
    title: string
    slug: string
    photo_count: number
    is_public: boolean
  }
}

interface CollaborationsResponse {
  pending: Invitation[]
  collaborating: Collaboration[]
}

const ROLE_LABELS: Record<string, string> = {
  editor: '编辑者',
  viewer: '查看者',
}

export function CollaborationInvites() {
  const queryClient = useQueryClient()

  // 获取协作数据
  const { data, isLoading, refetch } = useQuery<CollaborationsResponse>({
    queryKey: ['my-collaborations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/collaborations')
      if (!res.ok) throw new Error('获取协作数据失败')
      return res.json()
    },
  })

  // 响应邀请
  const respondMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'accept' | 'reject' }) => {
      const res = await fetch(`/api/admin/collaborations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '操作失败')
      }
      return res.json()
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'accept' ? '已接受邀请' : '已拒绝邀请')
      queryClient.invalidateQueries({ queryKey: ['my-collaborations'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // 退出协作
  const leaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/collaborations/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '操作失败')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('已退出协作')
      queryClient.invalidateQueries({ queryKey: ['my-collaborations'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const pending = data?.pending || []
  const collaborating = data?.collaborating || []

  return (
    <div className="space-y-6">
      {/* 待处理的邀请 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              协作邀请
            </CardTitle>
            <CardDescription>
              您收到的协作邀请
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无待处理的邀请</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(invite => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 bg-surface rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <Image className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{invite.album.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {invite.invitedBy.email} 邀请您以 
                        <Badge variant="outline" className="mx-1">
                          {ROLE_LABELS[invite.role] || invite.role}
                        </Badge>
                        身份协作
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {invite.album.photo_count} 张照片
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => respondMutation.mutate({ id: invite.id, action: 'reject' })}
                      disabled={respondMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-1" />
                      拒绝
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => respondMutation.mutate({ id: invite.id, action: 'accept' })}
                      disabled={respondMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      接受
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 我协作的相册 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            我协作的相册
          </CardTitle>
          <CardDescription>
            您正在协作管理的相册
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : collaborating.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无协作的相册</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collaborating.map(collab => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-4 bg-surface rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600">
                      <Image className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{collab.album.title}</span>
                        <Badge variant="outline">
                          {ROLE_LABELS[collab.role] || collab.role}
                        </Badge>
                        {collab.album.is_public && (
                          <Badge variant="secondary">公开</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {collab.album.photo_count} 张照片
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <span>权限:</span>
                        {collab.permissions.canUpload && <span>上传</span>}
                        {collab.permissions.canEdit && <span>编辑</span>}
                        {collab.permissions.canDelete && <span>删除</span>}
                        {collab.permissions.canManage && <span>管理</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/albums/${collab.album.id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        打开
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('确定要退出此协作吗？')) {
                          leaveMutation.mutate(collab.id)
                        }
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
