'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ArrowLeft } from 'lucide-react'

/**
 * 主页访问守卫
 * 阻止通过分享链接访问的用户进入主页
 */
export function HomeAccessGuard() {
  const router = useRouter()
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    // 检查是否有分享链接访问标记
    const cookies = document.cookie.split(';')
    const shareLinkCookie = cookies.find(cookie => 
      cookie.trim().startsWith('pis_share_link_access=')
    )

    if (shareLinkCookie && shareLinkCookie.includes('true')) {
      // 用户是通过分享链接访问的，阻止进入主页
      setIsBlocked(true)
    }
  }, [])

  // 如果被阻止，显示提示页面
  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-accent" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-text-primary">访问受限</h1>
            <p className="text-text-secondary">
              您通过分享链接访问了相册。为了安全起见，您无法访问主页。
            </p>
            <p className="text-sm text-text-muted mt-4">
              如需访问主页，请直接访问网站首页。
            </p>
          </div>
          <button
            onClick={() => {
              // 清除 cookie 并尝试返回上一页，如果没有历史记录则显示提示
              document.cookie = 'pis_share_link_access=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
              if (window.history.length > 1) {
                router.back()
              } else {
                // 如果没有历史记录，显示提示
                alert('请通过分享链接访问相册，或直接访问网站首页。')
              }
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-background rounded-lg hover:bg-accent/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回相册
          </button>
        </div>
      </div>
    )
  }

  return null
}
