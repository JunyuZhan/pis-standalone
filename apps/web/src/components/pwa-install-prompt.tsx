'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const hasBeforeInstallPromptRef = useRef(false)
  const promptShownRef = useRef(false)

  useEffect(() => {
    // 检查是否已经安装
    interface NavigatorStandalone extends Navigator {
      standalone?: boolean
    }
    interface WindowMSStream extends Window {
      MSStream?: unknown
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as NavigatorStandalone).standalone === true
    setIsStandalone(standalone)

    if (standalone) {
      console.log('[PWA] Already installed, skipping prompt')
      return
    }

    // 检查是否已经提示过（永久不再提示）
    const lastPrompt = localStorage.getItem('pwa-prompt-dismissed')
    if (lastPrompt) {
      console.log('[PWA] Prompt was dismissed before, skipping')
      return
    }

    // 标记：用于防止多个 setTimeout 同时显示提示
    const markPromptShown = () => {
      if (!promptShownRef.current) {
        promptShownRef.current = true
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
        console.log('[PWA] Marked prompt as shown, will not show again')
      }
    }
    
    // 检查是否应该显示提示的辅助函数
    const shouldShowPrompt = () => {
      return !localStorage.getItem('pwa-prompt-dismissed') && !promptShownRef.current
    }

    // 检查是否是 iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as WindowMSStream).MSStream
    setIsIOS(iOS)
    
    // 检查是否是移动设备（包括 Android、iOS 等）
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    setIsMobile(mobile)

    // 检查 Service Worker 是否已注册
    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            console.log('[PWA] Service Worker is registered')
          } else {
            console.log('[PWA] Service Worker not yet registered, waiting...')
            // 等待 Service Worker 注册
            navigator.serviceWorker.ready.then(() => {
              console.log('[PWA] Service Worker ready')
            })
          }
        } catch (error) {
          console.error('[PWA] Error checking Service Worker:', error)
        }
      }
    }
    checkServiceWorker()

    // 监听 beforeinstallprompt 事件（仅 Chrome/Edge/Opera 等支持）
    const handler = async (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired')
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      hasBeforeInstallPromptRef.current = true
      
      // 移动端：直接弹出系统安装提示
      if (mobile && !iOS) {
        // 延迟一点时间，确保页面加载完成
        setTimeout(async () => {
          if (shouldShowPrompt()) {
            try {
              console.log('[PWA] Mobile device detected, showing system install prompt directly')
              // 先标记，避免重复弹出
              markPromptShown()
              await promptEvent.prompt()
              const { outcome } = await promptEvent.userChoice
              if (outcome === 'accepted') {
                console.log('[PWA] User accepted install prompt')
              } else {
                console.log('[PWA] User dismissed install prompt')
              }
              setDeferredPrompt(null)
            } catch (error) {
              console.error('[PWA] Install prompt error:', error)
              // 如果直接弹出失败，显示自定义提示
              // 注意：此时 markPromptShown() 已经调用，需要重置才能显示
              promptShownRef.current = false
              localStorage.removeItem('pwa-prompt-dismissed')
              if (shouldShowPrompt()) {
                markPromptShown()
                setShowPrompt(true)
              }
            }
          }
        }, 2000)
      } else {
        // 桌面端或移动端没有 beforeinstallprompt 事件：显示自定义提示框
        // 移动端 Android 如果有 beforeinstallprompt 事件，会在上面的 if 分支直接弹出
        setTimeout(() => {
          if (shouldShowPrompt()) {
            console.log('[PWA] Desktop or mobile without beforeinstallprompt, showing custom install prompt')
            markPromptShown()
            setShowPrompt(true)
          }
        }, 3000)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    // iOS 设备显示手动安装提示（只有在未关闭过的情况下）
    if (iOS) {
      console.log('[PWA] iOS device detected, showing manual install instructions')
      setTimeout(() => {
        // 再次检查是否已经显示过（防止重复）
        if (shouldShowPrompt()) {
          markPromptShown()
          setShowPrompt(true)
        }
      }, 5000)
    } else {
      // 非 iOS 设备：即使没有 beforeinstallprompt 事件，也尝试显示提示
      // 但需要等待 Service Worker 注册完成
      setTimeout(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(() => {
            // 如果 7 秒后还没有 beforeinstallprompt 事件，也显示提示
            // 用户可以通过浏览器菜单手动安装
            setTimeout(() => {
              // 使用 ref 检查，避免闭包问题
              // 再次检查是否已经显示过（防止重复）
              if (!hasBeforeInstallPromptRef.current && shouldShowPrompt()) {
                console.log('[PWA] No beforeinstallprompt event, showing manual install prompt')
                markPromptShown()
                setShowPrompt(true)
              }
            }, 2000)
          })
        }
      }, 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    // 确保标记已设置（防止重复显示）
    promptShownRef.current = true
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
    
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        
        if (outcome === 'accepted') {
          console.log('[PWA] User accepted install prompt')
        }
      } catch (error) {
        console.error('[PWA] Install error:', error)
      }

      setDeferredPrompt(null)
      setShowPrompt(false)
    } else {
      // 没有 deferredPrompt，提供手动安装指引
      console.log('[PWA] No deferredPrompt, showing manual install instructions')
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    // 确保标记已设置（防止重复显示）
    promptShownRef.current = true
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
    setShowPrompt(false)
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
            <Download className="w-6 h-6 text-accent" />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-text-primary mb-1">
              安装 PIS 应用
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              {isIOS 
                ? '添加到主屏幕，获得更好的体验'
                : '安装应用，随时随地查看照片'
              }
            </p>

            {isIOS ? (
              // iOS 安装指引
              <div className="text-xs text-text-muted space-y-1">
                <p className="flex items-center gap-1">
                  <span className="bg-surface px-1.5 py-0.5 rounded">1</span>
                  点击底部的 <Share className="w-3.5 h-3.5 inline" /> 分享按钮
                </p>
                <p className="flex items-center gap-1">
                  <span className="bg-surface px-1.5 py-0.5 rounded">2</span>
                  选择 <Plus className="w-3.5 h-3.5 inline" /> &quot;添加到主屏幕&quot;
                </p>
              </div>
            ) : (
              // 其他平台安装按钮
              <div className="space-y-2">
                {deferredPrompt ? (
                  <button
                    onClick={handleInstall}
                    className="btn-primary text-sm w-full"
                  >
                    <Download className="w-4 h-4" />
                    立即安装
                  </button>
                ) : (
                  <div className="text-xs text-text-muted space-y-1">
                    <p className="font-medium text-text-secondary mb-1">手动安装步骤：</p>
                    {isMobile ? (
                      <>
                        <p className="flex items-center gap-1">
                          <span className="bg-surface px-1.5 py-0.5 rounded">1</span>
                          点击浏览器菜单（右上角 <span className="text-accent">⋮</span>）
                        </p>
                        <p className="flex items-center gap-1">
                          <span className="bg-surface px-1.5 py-0.5 rounded">2</span>
                          选择"安装应用"或"添加到主屏幕"
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="flex items-center gap-1">
                          <span className="bg-surface px-1.5 py-0.5 rounded">1</span>
                          点击浏览器地址栏右侧的 <Download className="w-3.5 h-3.5 inline" /> 图标
                        </p>
                        <p className="flex items-center gap-1">
                          <span className="bg-surface px-1.5 py-0.5 rounded">2</span>
                          选择"安装"或"添加到主屏幕"
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={handleDismiss}
            className="text-text-muted hover:text-text-primary p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
