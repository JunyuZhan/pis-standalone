'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from './theme-provider'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * 主题切换按钮
 * 循环切换：亮色 -> 暗色 -> 跟随系统
 */
export function ThemeToggle({ className, showLabel = false, size = 'md' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()

  // 循环切换主题
  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  // 获取当前图标
  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  // 获取标签文字
  const label = theme === 'system' 
    ? '跟随系统' 
    : theme === 'dark' 
    ? '暗色模式' 
    : '亮色模式'

  // 尺寸样式
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'rounded-lg transition-colors',
        'hover:bg-surface-elevated active:scale-95',
        'text-text-secondary hover:text-text-primary',
        sizeClasses[size],
        showLabel && 'flex items-center gap-2 px-3',
        className
      )}
      title={label}
      aria-label={label}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span className="text-sm">{label}</span>}
    </button>
  )
}

/**
 * 主题选择器（下拉菜单形式）
 */
export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  const options = [
    { value: 'light', label: '亮色', icon: Sun },
    { value: 'dark', label: '暗色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ] as const

  return (
    <div className={cn('flex gap-1 p-1 bg-surface rounded-lg', className)}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
            theme === value
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
