'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
  primaryColor: string
  setPrimaryColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => {},
  primaryColor: '#4F46E5',
  setPrimaryColor: () => {},
})

// 默认主色调
const DEFAULT_PRIMARY_COLOR = '#4F46E5'

/**
 * 获取系统主题偏好
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 解析主题模式
 */
function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme()
  }
  return theme
}

/**
 * 应用主题到 DOM
 */
function applyTheme(resolvedTheme: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolvedTheme)
}

/**
 * 应用主色调到 CSS 变量
 */
function applyPrimaryColor(color: string) {
  const root = document.documentElement
  
  // 将 hex 转换为 RGB
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // 设置 CSS 变量
  root.style.setProperty('--color-accent', `${r} ${g} ${b}`)
  root.style.setProperty('--color-accent-hover', `${Math.max(0, r - 20)} ${Math.max(0, g - 20)} ${Math.max(0, b - 20)}`)
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  defaultPrimaryColor?: string
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  defaultPrimaryColor = DEFAULT_PRIMARY_COLOR,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')
  const [primaryColor, setPrimaryColorState] = useState(defaultPrimaryColor)
  const [mounted, setMounted] = useState(false)

  // 设置主题
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme)
    localStorage.setItem('pis-theme', newTheme)
    
    const resolved = resolveTheme(newTheme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  // 设置主色调
  const setPrimaryColor = useCallback((color: string) => {
    setPrimaryColorState(color)
    localStorage.setItem('pis-primary-color', color)
    applyPrimaryColor(color)
  }, [])

  // 初始化
  useEffect(() => {
    // 从 localStorage 读取保存的主题
    const savedTheme = localStorage.getItem('pis-theme') as ThemeMode | null
    const savedColor = localStorage.getItem('pis-primary-color')
    
    // 从服务端设置读取（如果有）
    // 这会在 SettingsProvider 加载后被覆盖
    const initialTheme = savedTheme || defaultTheme
    const initialColor = savedColor || defaultPrimaryColor
    
    setThemeState(initialTheme)
    setPrimaryColorState(initialColor)
    
    const resolved = resolveTheme(initialTheme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
    applyPrimaryColor(initialColor)
    
    setMounted(true)
  }, [defaultTheme, defaultPrimaryColor])

  // 监听系统主题变化
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light'
      setResolvedTheme(newResolved)
      applyTheme(newResolved)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // 防止闪烁
  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      resolvedTheme, 
      setTheme, 
      primaryColor, 
      setPrimaryColor 
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * 使用主题 Hook
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
