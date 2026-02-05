/**
 * 风格预设工具函数（前端使用）
 */

export interface StylePresetConfig {
  brightness?: number
  contrast?: number
  saturation?: number
  hueRotate?: number
  grayscale?: number
  sepia?: number
}

export interface StylePreset {
  id: string
  name: string
  category: 'portrait' | 'landscape' | 'general'
  description: string
  config: StylePresetConfig
  cssFilter?: string
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  'japanese-fresh': {
    id: 'japanese-fresh',
    name: '日系清新',
    category: 'portrait',
    description: '清冷的青蓝色调，适合人像',
    config: { brightness: 1.05, contrast: 0.9, saturation: 0.9, hueRotate: -5 }
  },
  'film-portrait': {
    id: 'film-portrait',
    name: '胶片人像',
    category: 'portrait',
    description: '经典胶片质感',
    config: { brightness: 1.0, contrast: 1.15, saturation: 1.1, hueRotate: 5 }
  },
  'cinematic-portrait': {
    id: 'cinematic-portrait',
    name: '电影人像',
    category: 'portrait',
    description: '电影般的质感',
    config: { brightness: 0.95, contrast: 1.25, saturation: 0.85, hueRotate: 15 }
  },
  'realistic-portrait': {
    id: 'realistic-portrait',
    name: '真实人像',
    category: 'portrait',
    description: '还原真实肤色',
    config: { brightness: 1.02, contrast: 1.1, saturation: 1.05 }
  },
  'warm-portrait': {
    id: 'warm-portrait',
    name: '暖调人像',
    category: 'portrait',
    description: '温馨的暖色调',
    config: { brightness: 1.05, contrast: 1.0, saturation: 1.1, hueRotate: 10 }
  },
  'natural-landscape': {
    id: 'natural-landscape',
    name: '自然风光',
    category: 'landscape',
    description: '自然真实的风景',
    config: { brightness: 1.0, contrast: 1.1, saturation: 1.15 }
  },
  'cinematic-landscape': {
    id: 'cinematic-landscape',
    name: '电影风光',
    category: 'landscape',
    description: '电影质感的风景',
    config: { brightness: 0.95, contrast: 1.3, saturation: 0.9, hueRotate: 5 }
  },
  'film-landscape': {
    id: 'film-landscape',
    name: '胶片风光',
    category: 'landscape',
    description: '胶片质感的风景',
    config: { brightness: 1.0, contrast: 1.2, saturation: 1.1, hueRotate: 8 }
  },
  'vibrant-landscape': {
    id: 'vibrant-landscape',
    name: '鲜艳风光',
    category: 'landscape',
    description: '色彩鲜艳的风景',
    config: { brightness: 1.1, contrast: 1.1, saturation: 1.3 }
  },
  'golden-hour': {
    id: 'golden-hour',
    name: '黄金时刻',
    category: 'landscape',
    description: '日落时分的暖色',
    config: { brightness: 1.05, contrast: 1.0, saturation: 1.2, hueRotate: 20 }
  },
  'black-white': {
    id: 'black-white',
    name: '经典黑白',
    category: 'general',
    description: '永恒的黑白质感',
    config: { brightness: 1.0, contrast: 1.2, grayscale: 1 }
  },
  'vintage': {
    id: 'vintage',
    name: '复古',
    category: 'general',
    description: '怀旧复古风格',
    config: { brightness: 1.05, contrast: 1.15, saturation: 1.1, hueRotate: 15 }
  },
  'cool': {
    id: 'cool',
    name: '冷调',
    category: 'general',
    description: '冷静的冷色调',
    config: { brightness: 1.0, contrast: 1.0, saturation: 0.9, hueRotate: -15 }
  },
  'cyberpunk': {
    id: 'cyberpunk',
    name: '赛博朋克',
    category: 'general',
    description: '霓虹科幻风格',
    config: { brightness: 0.9, contrast: 1.3, saturation: 1.4, hueRotate: -25 }
  },
  'morandi-grey': {
    id: 'morandi-grey',
    name: '莫兰迪灰',
    category: 'general',
    description: '低饱和度的高级灰',
    config: { brightness: 1.0, contrast: 0.85, saturation: 0.65 }
  },
  'high-key-bw': {
    id: 'high-key-bw',
    name: '高调黑白',
    category: 'general',
    description: '明亮的黑白风格',
    config: { brightness: 1.25, contrast: 1.4, grayscale: 1 }
  },
  'moody-street': {
    id: 'moody-street',
    name: '情绪街头',
    category: 'general',
    description: '充满故事感的街头风格',
    config: { brightness: 0.85, contrast: 1.2, saturation: 0.8, hueRotate: -12 }
  },
  'emerald-forest': {
    id: 'emerald-forest',
    name: '翡翠森林',
    category: 'general',
    description: '深邃的绿色调',
    config: { brightness: 0.95, contrast: 1.1, saturation: 1.25, hueRotate: -5 }
  },
  'retro-vhs': {
    id: 'retro-vhs',
    name: '复古VHS',
    category: 'general',
    description: '老录像带风格',
    config: { brightness: 1.0, contrast: 0.9, saturation: 1.2, hueRotate: 12 }
  },
  'dreamy-soft': {
    id: 'dreamy-soft',
    name: '梦幻柔焦',
    category: 'general',
    description: '梦幻般的柔和感',
    config: { brightness: 1.15, contrast: 0.8, saturation: 0.9, hueRotate: -8 }
  }
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

  const preset = STYLE_PRESETS[colorGrading.preset]
  if (!preset) {
    return 'none'
  }

  const { config } = preset
  const filters: string[] = []

  if (config.brightness !== undefined && config.brightness !== 1) {
    filters.push(`brightness(${config.brightness})`)
  }
  if (config.contrast !== undefined && config.contrast !== 1) {
    filters.push(`contrast(${config.contrast})`)
  }
  if (config.saturation !== undefined && config.saturation !== 1) {
    filters.push(`saturate(${config.saturation})`)
  }
  if (config.hueRotate !== undefined && config.hueRotate !== 0) {
    filters.push(`hue-rotate(${config.hueRotate}deg)`)
  }
  if (config.grayscale !== undefined && config.grayscale !== 0) {
    filters.push(`grayscale(${config.grayscale})`)
  }
  if (config.sepia !== undefined && config.sepia !== 0) {
    filters.push(`sepia(${config.sepia})`)
  }

  return filters.length > 0 ? filters.join(' ') : 'none'
}

/**
 * 获取所有预设列表（数组格式）
 */
export function getAllPresets(): StylePreset[] {
  return Object.values(STYLE_PRESETS)
}

/**
 * 根据分类获取预设
 */
export function getPresetsByCategory(category: StylePreset['category']): StylePreset[] {
  return getAllPresets().filter(preset => preset.category === category)
}

/**
 * 根据 ID 获取预设
 */
export function getPresetById(id: string): StylePreset | undefined {
  if (!id) return undefined
  return STYLE_PRESETS[id]
}
