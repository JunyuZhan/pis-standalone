/**
 * 风格预设工具函数（前端使用）
 */

export interface StylePreset {
  id: string
  name: string
  category: 'portrait' | 'landscape' | 'general'
  description: string
  cssFilter?: string
}

/**
 * 根据预设 ID 获取 CSS 滤镜字符串
 */
export function getStylePresetCSSFilter(
  colorGrading: { preset?: string } | null | undefined
): string {
  if (!colorGrading || !colorGrading.preset || colorGrading.preset === 'none') {
    return 'none'
  }

  // 预设 ID 到 CSS 滤镜的映射（与 worker 中的定义保持一致）
  const presetFilters: Record<string, string> = {
    'japanese-fresh': 'brightness(1.05) contrast(0.9) saturate(0.9) hue-rotate(-5deg)', // Gemini 建议：清冷的青蓝色调
    'film-portrait': 'brightness(1.0) contrast(1.15) saturate(1.1) hue-rotate(5deg)',
    'cinematic-portrait': 'brightness(0.95) contrast(1.25) saturate(0.85) hue-rotate(15deg)',
    'realistic-portrait': 'brightness(1.02) contrast(1.1) saturate(1.05)',
    'warm-portrait': 'brightness(1.05) contrast(1.0) saturate(1.1) hue-rotate(10deg)',
    'natural-landscape': 'brightness(1.0) contrast(1.1) saturate(1.15)',
    'cinematic-landscape': 'brightness(0.95) contrast(1.3) saturate(0.9) hue-rotate(5deg)',
    'film-landscape': 'brightness(1.0) contrast(1.2) saturate(1.1) hue-rotate(8deg)',
    'vibrant-landscape': 'brightness(1.1) contrast(1.1) saturate(1.3)',
    'golden-hour': 'brightness(1.05) contrast(1.0) saturate(1.2) hue-rotate(20deg)',
    'black-white': 'brightness(1.0) contrast(1.2) grayscale(1)',
    'vintage': 'brightness(1.05) contrast(1.15) saturate(1.1) hue-rotate(15deg)',
    'cool': 'brightness(1.0) contrast(1.0) saturate(0.9) hue-rotate(-15deg)',
    'cyberpunk': 'brightness(0.9) contrast(1.3) saturate(1.4) hue-rotate(-25deg)',
    'morandi-grey': 'brightness(1.0) contrast(0.85) saturate(0.65)',
    'high-key-bw': 'brightness(1.25) contrast(1.4) grayscale(1)',
    'moody-street': 'brightness(0.85) contrast(1.2) saturate(0.8) hue-rotate(-12deg)',
    'emerald-forest': 'brightness(0.95) contrast(1.1) saturate(1.25) hue-rotate(-5deg)',
    'retro-vhs': 'brightness(1.0) contrast(0.9) saturate(1.2) hue-rotate(12deg)',
    'dreamy-soft': 'brightness(1.15) contrast(0.8) saturate(0.9) hue-rotate(-8deg)',
  }

  return presetFilters[colorGrading.preset] || 'none'
}
