'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  fullWidth?: boolean
}

/**
 * 统一的按钮组件
 * 提供一致的样式、尺寸和交互体验
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95 touch-manipulation'

    const variantClasses = {
      primary: 'bg-accent text-background hover:bg-accent/90 active:scale-[0.98]',
      secondary: 'bg-surface-elevated text-text-primary border border-border hover:bg-surface hover:border-border-light active:scale-[0.98]',
      ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface active:scale-[0.98]',
      danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]',
    }
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm min-h-[36px]',
      md: 'px-4 py-2 text-base min-h-[44px]', // 移动端标准触摸目标
      lg: 'px-6 py-3 text-lg min-h-[48px]',
    }
    
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
