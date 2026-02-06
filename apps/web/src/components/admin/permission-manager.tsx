'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  RefreshCw,
  Save,
  Shield,
  Users,
  FolderOpen,
  Image,
  UserSquare2,
  BarChart3,
  Settings,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface Permission {
  id: string
  code: string
  name: string
  description: string | null
  category: string
  is_system: boolean
}

interface PermissionsResponse {
  permissions: Permission[]
  rolePermissions: Record<string, string[]>
}

const ROLE_INFO = {
  admin: { name: '管理员', description: '拥有所有权限，无法修改', icon: Shield, color: 'bg-red-100 text-red-800' },
  photographer: { name: '摄影师', description: '可以管理相册、照片和客户', icon: Users, color: 'bg-blue-100 text-blue-800' },
  retoucher: { name: '修图师', description: '可以查看和修图照片', icon: Image, color: 'bg-green-100 text-green-800' },
  viewer: { name: '查看者', description: '只读权限', icon: UserSquare2, color: 'bg-gray-100 text-gray-800' },
}

const CATEGORY_INFO: Record<string, { name: string; icon: React.ElementType; color: string }> = {
  album: { name: '相册管理', icon: FolderOpen, color: 'text-blue-600' },
  photo: { name: '照片管理', icon: Image, color: 'text-green-600' },
  customer: { name: '客户管理', icon: UserSquare2, color: 'text-purple-600' },
  analytics: { name: '数据统计', icon: BarChart3, color: 'text-orange-600' },
  system: { name: '系统管理', icon: Settings, color: 'text-red-600' },
}

export function PermissionManager() {
  const [activeRole, setActiveRole] = useState<string>('photographer')
  const [editedPermissions, setEditedPermissions] = useState<Record<string, Set<string>>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const queryClient = useQueryClient()

  // 获取权限数据
  const { data, isLoading, refetch } = useQuery<PermissionsResponse>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/permissions')
      if (!res.ok) throw new Error('获取权限失败')
      return res.json()
    },
  })

  // 保存角色权限
  const saveMutation = useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: string[] }) => {
      const res = await fetch(`/api/admin/permissions/roles/${role}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '保存失败')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('权限已保存')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setHasChanges(false)
      setEditedPermissions({})
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // 获取当前角色的权限
  const getCurrentPermissions = (role: string): Set<string> => {
    if (editedPermissions[role]) {
      return editedPermissions[role]
    }
    return new Set(data?.rolePermissions[role] || [])
  }

  // 切换权限
  const togglePermission = (role: string, code: string) => {
    if (role === 'admin') return // 不能修改管理员权限

    const current = getCurrentPermissions(role)
    const newSet = new Set(current)
    
    if (newSet.has(code)) {
      newSet.delete(code)
    } else {
      newSet.add(code)
    }

    setEditedPermissions(prev => ({
      ...prev,
      [role]: newSet,
    }))
    setHasChanges(true)
  }

  // 保存当前角色的权限
  const saveRolePermissions = () => {
    const permissions = Array.from(getCurrentPermissions(activeRole))
    saveMutation.mutate({ role: activeRole, permissions })
  }

  // 按分类分组权限
  const groupedPermissions = (data?.permissions || []).reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = []
    }
    acc[perm.category].push(perm)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* 角色选择 */}
      <Tabs value={activeRole} onValueChange={setActiveRole}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            {Object.entries(ROLE_INFO).map(([role, info]) => {
              const Icon = info.icon
              return (
                <TabsTrigger key={role} value={role} disabled={role === 'admin'}>
                  <Icon className="w-4 h-4 mr-1" />
                  {info.name}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
            {hasChanges && activeRole !== 'admin' && (
              <Button 
                size="sm" 
                onClick={saveRolePermissions}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-1" />
                保存更改
              </Button>
            )}
          </div>
        </div>

        {/* 角色权限内容 */}
        {Object.entries(ROLE_INFO).map(([role, info]) => (
          <TabsContent key={role} value={role}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={info.color}>{info.name}</Badge>
                  权限配置
                </CardTitle>
                <CardDescription>
                  {info.description}
                  {role === 'admin' && (
                    <span className="text-yellow-600 ml-2">（系统角色，不可修改）</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([category, permissions]) => {
                      const catInfo = CATEGORY_INFO[category] || { 
                        name: category, 
                        icon: Settings, 
                        color: 'text-gray-600' 
                      }
                      const CatIcon = catInfo.icon
                      const currentPerms = getCurrentPermissions(role)

                      return (
                        <div key={category} className="space-y-3">
                          <h3 className={`font-medium flex items-center gap-2 ${catInfo.color}`}>
                            <CatIcon className="w-4 h-4" />
                            {catInfo.name}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {permissions.map((perm) => {
                              const hasPermission = currentPerms.has(perm.code)
                              const isAdmin = role === 'admin'

                              return (
                                <div
                                  key={perm.id}
                                  className={`
                                    flex items-start gap-3 p-3 rounded-lg border
                                    ${hasPermission ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}
                                    ${!isAdmin ? 'cursor-pointer hover:bg-gray-100' : ''}
                                  `}
                                  onClick={() => !isAdmin && togglePermission(role, perm.code)}
                                >
                                  <Checkbox
                                    checked={hasPermission}
                                    disabled={isAdmin}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{perm.name}</span>
                                      {hasPermission ? (
                                        <Check className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <X className="w-3 h-3 text-gray-400" />
                                      )}
                                    </div>
                                    {perm.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {perm.description}
                                      </p>
                                    )}
                                    <code className="text-xs text-muted-foreground">
                                      {perm.code}
                                    </code>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* 权限说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">权限说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong>角色权限</strong>：每个角色有一组默认权限，对该角色的所有用户生效</p>
          <p>• <strong>用户特殊权限</strong>：可以为单个用户授予或撤销特定权限，覆盖角色默认权限</p>
          <p>• <strong>管理员</strong>：拥有所有权限，系统内置角色，不可修改</p>
          <p>• <strong>权限继承</strong>：用户最终权限 = 角色权限 + 用户授予权限 - 用户撤销权限</p>
        </CardContent>
      </Card>
    </div>
  )
}
