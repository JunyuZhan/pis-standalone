'use client'

import { useState } from 'react'
import { Globe, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { locales, localeNames, type Locale } from '@/i18n/config'

interface TranslationEditorProps {
  /** 当前翻译值 */
  value: Record<string, string> | null
  /** 值变化回调 */
  onChange: (value: Record<string, string> | null) => void
  /** 默认语言的原始值（用于显示参考） */
  defaultValue?: string
  /** 字段标签 */
  label: string
  /** 是否为多行文本 */
  multiline?: boolean
  /** 占位符 */
  placeholder?: string
  /** 最大长度 */
  maxLength?: number
  /** 是否禁用 */
  disabled?: boolean
}

/**
 * 多语言翻译编辑器
 * 支持为不同语言添加翻译内容
 */
export function TranslationEditor({
  value,
  onChange,
  defaultValue,
  label,
  multiline = false,
  placeholder,
  maxLength,
  disabled = false,
}: TranslationEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeLocales, setActiveLocales] = useState<Locale[]>(() => {
    // 初始化时，根据已有值确定激活的语言
    if (value && typeof value === 'object') {
      return Object.keys(value).filter(k => locales.includes(k as Locale)) as Locale[]
    }
    return []
  })

  // 获取未添加的语言列表
  const availableLocales = locales.filter(locale => !activeLocales.includes(locale))

  // 添加语言
  const addLocale = (locale: Locale) => {
    setActiveLocales(prev => [...prev, locale])
    // 初始化该语言的值为空字符串
    const newValue = { ...(value || {}), [locale]: '' }
    onChange(newValue)
  }

  // 移除语言
  const removeLocale = (locale: Locale) => {
    setActiveLocales(prev => prev.filter(l => l !== locale))
    // 从值中移除该语言
    if (value) {
      const { [locale]: _, ...rest } = value
      onChange(Object.keys(rest).length > 0 ? rest : null)
    }
  }

  // 更新某个语言的值
  const updateLocaleValue = (locale: Locale, text: string) => {
    const newValue = { ...(value || {}), [locale]: text }
    onChange(newValue)
  }

  // 获取翻译数量
  const translationCount = activeLocales.length

  return (
    <div className="space-y-2">
      {/* 标签和展开按钮 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center justify-between w-full text-left',
          'px-3 py-2 rounded-lg border border-border',
          'hover:bg-surface-elevated transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">{label} 多语言</span>
          {translationCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
              {translationCount} 种语言
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="pl-4 space-y-3 border-l-2 border-accent/20">
          {/* 默认值参考 */}
          {defaultValue && (
            <div className="text-sm text-text-muted bg-surface-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted mb-1">默认值（参考）</div>
              <div className="text-text-secondary">{defaultValue}</div>
            </div>
          )}

          {/* 已添加的语言 */}
          {activeLocales.map(locale => (
            <div key={locale} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface-elevated">
                    {locale}
                  </span>
                  {localeNames[locale]}
                </label>
                <button
                  type="button"
                  onClick={() => removeLocale(locale)}
                  className="p-1 text-text-muted hover:text-red-500 transition-colors"
                  title="移除此语言"
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {multiline ? (
                <textarea
                  value={value?.[locale] || ''}
                  onChange={(e) => updateLocaleValue(locale, e.target.value)}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  disabled={disabled}
                  className="input min-h-[80px] resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={value?.[locale] || ''}
                  onChange={(e) => updateLocaleValue(locale, e.target.value)}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  disabled={disabled}
                  className="input"
                />
              )}
            </div>
          ))}

          {/* 添加语言按钮 */}
          {availableLocales.length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-text-muted mb-2">添加语言翻译</div>
              <div className="flex flex-wrap gap-2">
                {availableLocales.map(locale => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => addLocale(locale)}
                    disabled={disabled}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                      'border border-dashed border-border',
                      'hover:border-accent hover:text-accent transition-colors',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Plus className="w-3 h-3" />
                    {localeNames[locale]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 无翻译提示 */}
          {activeLocales.length === 0 && (
            <div className="text-sm text-text-muted py-2">
              点击上方按钮添加不同语言的翻译
            </div>
          )}
        </div>
      )}
    </div>
  )
}
