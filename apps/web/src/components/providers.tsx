'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState } from 'react'
import { SettingsProvider } from '@/hooks/use-settings'
import { ThemeProvider } from './theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 分钟（提高缓存时间，减少请求）
            gcTime: 10 * 60 * 1000, // 10 分钟垃圾回收（原 cacheTime）
            refetchOnWindowFocus: false,
            refetchOnReconnect: true, // 网络重连时刷新
            retry: 1, // 减少重试次数，快速失败
            retryDelay: 1000, // 重试延迟 1 秒
          },
          mutations: {
            retry: false, //  mutations 不重试
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsProvider>
          {children}
          <Toaster 
            position="top-center"
            richColors
            closeButton
            duration={3000}
          />
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
