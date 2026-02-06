'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Eye, 
  Users, 
  Image, 
  Download, 
  TrendingUp, 
  Monitor, 
  Smartphone, 
  Tablet,
  RefreshCw,
  Calendar,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { showError } from '@/lib/toast'

interface AnalyticsData {
  period: string
  startDate: string
  summary: {
    totalViews: number
    uniqueVisitors: number
    photoViews: number
    downloads: number
    downloadedFiles: number
  }
  dailyTrend: Array<{ date: string; views: number; visitors: number }>
  deviceStats: Array<{ device_type: string; count: number }>
  browserStats: Array<{ browser: string; count: number }>
  topAlbums: Array<{
    album_id: string
    title: string
    slug: string
    views: number
    visitors: number
  }> | null
  topPhotos: Array<{
    photo_id: string
    filename: string
    thumbnail_url: string
    views: number
  }>
}

const periods = [
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' },
  { value: 'all', label: '全部' },
]

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/analytics?period=${period}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || '获取统计数据失败')
      }
      
      setData(result)
    } catch (error) {
      console.error('获取统计数据失败:', error)
      showError('获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-text-muted">
        暂无统计数据
      </div>
    )
  }

  // 计算设备类型比例
  const totalDevices = data.deviceStats.reduce((sum, d) => sum + parseInt(String(d.count)), 0)
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return Smartphone
      case 'tablet': return Tablet
      default: return Monitor
    }
  }
  const getDeviceLabel = (type: string) => {
    switch (type) {
      case 'mobile': return '手机'
      case 'tablet': return '平板'
      case 'desktop': return '电脑'
      default: return type
    }
  }

  // 计算趋势图数据
  const maxViews = Math.max(...data.dailyTrend.map(d => d.views), 1)

  return (
    <div className="space-y-6">
      {/* 头部：标题和时间范围选择 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">数据统计</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* 时间范围选择 */}
          <div className="flex bg-surface rounded-lg p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  period === p.value
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* 刷新按钮 */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
            title="刷新数据"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Eye}
          label="总访问量"
          value={data.summary.totalViews}
          color="text-blue-500"
        />
        <StatCard
          icon={Users}
          label="独立访客"
          value={data.summary.uniqueVisitors}
          color="text-green-500"
        />
        <StatCard
          icon={Image}
          label="照片查看"
          value={data.summary.photoViews}
          color="text-purple-500"
        />
        <StatCard
          icon={Download}
          label="下载次数"
          value={data.summary.downloads}
          subValue={`${data.summary.downloadedFiles} 个文件`}
          color="text-orange-500"
        />
      </div>

      {/* 趋势图 */}
      <div className="bg-surface-elevated rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-text-muted" />
          <h3 className="font-medium">访问趋势</h3>
        </div>
        
        {data.dailyTrend.length > 0 ? (
          <div className="space-y-4">
            {/* 简单条形图 */}
            <div className="flex items-end gap-1 h-32">
              {data.dailyTrend.map((day, index) => (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-accent/80 rounded-t transition-all hover:bg-accent"
                    style={{ 
                      height: `${(day.views / maxViews) * 100}%`,
                      minHeight: day.views > 0 ? '4px' : '0'
                    }}
                    title={`${day.date}: ${day.views} 次访问`}
                  />
                  {index % Math.ceil(data.dailyTrend.length / 7) === 0 && (
                    <span className="text-[10px] text-text-muted">
                      {new Date(day.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {/* 图例 */}
            <div className="flex items-center justify-center gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-accent" />
                <span>访问量</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-text-muted">
            暂无数据
          </div>
        )}
      </div>

      {/* 设备和浏览器统计 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 设备类型 */}
        <div className="bg-surface-elevated rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-text-muted" />
            <h3 className="font-medium">设备类型</h3>
          </div>
          
          {data.deviceStats.length > 0 ? (
            <div className="space-y-3">
              {data.deviceStats.map((device) => {
                const Icon = getDeviceIcon(device.device_type)
                const percentage = totalDevices > 0 
                  ? Math.round((parseInt(String(device.count)) / totalDevices) * 100) 
                  : 0
                return (
                  <div key={device.device_type} className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-text-muted" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{getDeviceLabel(device.device_type)}</span>
                        <span className="text-sm text-text-muted">{percentage}%</span>
                      </div>
                      <div className="h-2 bg-surface rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-text-muted">暂无数据</div>
          )}
        </div>

        {/* 浏览器统计 */}
        <div className="bg-surface-elevated rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-text-muted" />
            <h3 className="font-medium">浏览器</h3>
          </div>
          
          {data.browserStats.length > 0 ? (
            <div className="space-y-3">
              {data.browserStats.map((browser, index) => {
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500']
                return (
                  <div key={browser.browser} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-3 h-3 rounded-full', colors[index % colors.length])} />
                      <span className="text-sm">{browser.browser || '未知'}</span>
                    </div>
                    <span className="text-sm text-text-muted">{browser.count}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-text-muted">暂无数据</div>
          )}
        </div>
      </div>

      {/* 热门相册 */}
      {data.topAlbums && data.topAlbums.length > 0 && (
        <div className="bg-surface-elevated rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-text-muted" />
            <h3 className="font-medium">热门相册</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-text-muted border-b border-border">
                  <th className="pb-2 font-medium">相册</th>
                  <th className="pb-2 font-medium text-right">访问量</th>
                  <th className="pb-2 font-medium text-right">访客数</th>
                </tr>
              </thead>
              <tbody>
                {data.topAlbums.map((album, index) => (
                  <tr 
                    key={album.album_id} 
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted w-4">{index + 1}</span>
                        <span className="font-medium">{album.title}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">{album.views}</td>
                    <td className="py-3 text-right text-text-muted">{album.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number
  subValue?: string
  color?: string
}

function StatCard({ icon: Icon, label, value, subValue, color = 'text-accent' }: StatCardProps) {
  return (
    <div className="bg-surface-elevated rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg bg-surface', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-sm text-text-muted">{label}</div>
          {subValue && (
            <div className="text-xs text-text-muted">{subValue}</div>
          )}
        </div>
      </div>
    </div>
  )
}
