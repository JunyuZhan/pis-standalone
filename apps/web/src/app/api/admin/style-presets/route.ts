import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'

/**
 * 预设定义（与 worker 中的定义保持一致）
 * 注意：预设定义需要在前端和 worker 之间共享，这里先定义一份简化版
 */
interface StylePreset {
  id: string
  name: string
  category: 'portrait' | 'landscape' | 'general'
  description: string
  cssFilter?: string
}

const STYLE_PRESETS: Record<string, StylePreset> = {
  // 人物风格
  'japanese-fresh': {
    id: 'japanese-fresh',
    name: '日系小清新',
    category: 'portrait',
    description: '温暖柔和的光线，温柔清新的氛围，适合人像摄影',
    cssFilter: 'brightness(1.05) contrast(0.9) saturate(0.9) hue-rotate(-5deg)' // Gemini 建议：清冷的青蓝色调
  },
  'film-portrait': {
    id: 'film-portrait',
    name: '胶片人像',
    category: 'portrait',
    description: '模拟胶片质感，增强层次感和故事性',
    cssFilter: 'brightness(1.0) contrast(1.15) saturate(1.1) hue-rotate(5deg)'
  },
  'cinematic-portrait': {
    id: 'cinematic-portrait',
    name: '电影感人像',
    category: 'portrait',
    description: '电影级调色，柔和的高光和暖色调，适合浪漫场景',
    cssFilter: 'brightness(0.95) contrast(1.25) saturate(0.85) hue-rotate(15deg)'
  },
  'realistic-portrait': {
    id: 'realistic-portrait',
    name: '写实人像',
    category: 'portrait',
    description: '保留真实色彩和细节，突出皮肤透明度和纹理',
    cssFilter: 'brightness(1.02) contrast(1.1) saturate(1.05)'
  },
  'warm-portrait': {
    id: 'warm-portrait',
    name: '温暖人像',
    category: 'portrait',
    description: '温暖的色调，适合人像和室内拍摄',
    cssFilter: 'brightness(1.05) contrast(1.0) saturate(1.1) hue-rotate(10deg)'
  },
  // 风景风格
  'natural-landscape': {
    id: 'natural-landscape',
    name: '自然风光',
    category: 'landscape',
    description: '保留自然色彩平衡，强调原始质感',
    cssFilter: 'brightness(1.0) contrast(1.1) saturate(1.15)'
  },
  'cinematic-landscape': {
    id: 'cinematic-landscape',
    name: '电影感风光',
    category: 'landscape',
    description: '电影级调色，独特的色调和情绪化氛围',
    cssFilter: 'brightness(0.95) contrast(1.3) saturate(0.9) hue-rotate(5deg)'
  },
  'film-landscape': {
    id: 'film-landscape',
    name: '胶片风光',
    category: 'landscape',
    description: '模拟35mm胶片复古美学，具有颗粒纹理感',
    cssFilter: 'brightness(1.0) contrast(1.2) saturate(1.1) hue-rotate(8deg)'
  },
  'vibrant-landscape': {
    id: 'vibrant-landscape',
    name: '鲜艳风光',
    category: 'landscape',
    description: '增强色彩饱和度，明亮鲜艳',
    cssFilter: 'brightness(1.1) contrast(1.1) saturate(1.3)'
  },
  'golden-hour': {
    id: 'golden-hour',
    name: '黄金时刻',
    category: 'landscape',
    description: '暖色调和金色色调，适合日落和黄金时段',
    cssFilter: 'brightness(1.05) contrast(1.0) saturate(1.2) hue-rotate(20deg)'
  },
  // 通用风格
  'black-white': {
    id: 'black-white',
    name: '黑白',
    category: 'general',
    description: '经典黑白效果',
    cssFilter: 'brightness(1.0) contrast(1.2) grayscale(1)'
  },
  'vintage': {
    id: 'vintage',
    name: '复古',
    category: 'general',
    description: '温暖的复古色调，增强对比度和饱和度',
    cssFilter: 'brightness(1.05) contrast(1.15) saturate(1.1) hue-rotate(15deg)'
  },
  'cool': {
    id: 'cool',
    name: '冷色调',
    category: 'general',
    description: '清爽的冷色调',
    cssFilter: 'brightness(1.0) contrast(1.0) saturate(0.9) hue-rotate(-15deg)'
  },
  // 新增风格
  'cyberpunk': {
    id: 'cyberpunk',
    name: '赛博朋克',
    category: 'general',
    description: '强烈的青色与品红对比，适合夜景',
    cssFilter: 'brightness(0.9) contrast(1.3) saturate(1.4) hue-rotate(-25deg)'
  },
  'morandi-grey': {
    id: 'morandi-grey',
    name: '莫兰迪高级灰',
    category: 'general',
    description: '低饱和、高灰度，适合静物与室内',
    cssFilter: 'brightness(1.0) contrast(0.85) saturate(0.65)'
  },
  'high-key-bw': {
    id: 'high-key-bw',
    name: '高调黑白',
    category: 'general',
    description: '极高亮度与强对比的艺术黑白',
    cssFilter: 'brightness(1.25) contrast(1.4) grayscale(1)'
  },
  'moody-street': {
    id: 'moody-street',
    name: '街头暗调',
    category: 'general',
    description: '压低亮度，增强冷色暗部，适合人文摄影',
    cssFilter: 'brightness(0.85) contrast(1.2) saturate(0.8) hue-rotate(-12deg)'
  },
  'emerald-forest': {
    id: 'emerald-forest',
    name: '森林绿意',
    category: 'landscape',
    description: '增强绿色深度与质感，低gamma值',
    cssFilter: 'brightness(0.95) contrast(1.1) saturate(1.25) hue-rotate(-5deg)'
  },
  'retro-vhs': {
    id: 'retro-vhs',
    name: '复古胶片 (VHS)',
    category: 'general',
    description: '模拟70-80年代家用录影带色调',
    cssFilter: 'brightness(1.0) contrast(0.9) saturate(1.2) hue-rotate(12deg)'
  },
  'dreamy-soft': {
    id: 'dreamy-soft',
    name: '梦幻柔光',
    category: 'general',
    description: '低对比，高亮度，带有淡紫色调的梦幻感',
    cssFilter: 'brightness(1.15) contrast(0.8) saturate(0.9) hue-rotate(-8deg)'
  }
}

function getPresetsByCategory(category: 'portrait' | 'landscape' | 'general'): StylePreset[] {
  return Object.values(STYLE_PRESETS).filter(preset => preset.category === category)
}

function getAllPresets(): StylePreset[] {
  const order = ['portrait', 'landscape', 'general']
  return Object.values(STYLE_PRESETS).sort((a, b) => {
    return order.indexOf(a.category) - order.indexOf(b.category)
  })
}

/**
 * 获取风格预设列表 API
 * 
 * @route GET /api/admin/style-presets
 * @description 获取照片风格预设列表，用于照片调色
 * 
 * @auth 需要管理员登录
 * 
 * @query {string} [category] - 分类筛选（可选：portrait/landscape/general）
 * 
 * @returns {Object} 200 - 成功返回预设列表
 * @returns {Object[]} 200.data.presets - 预设数组
 * @returns {string} 200.data.presets[].id - 预设ID
 * @returns {string} 200.data.presets[].name - 预设名称
 * @returns {string} 200.data.presets[].category - 预设分类（portrait/landscape/general）
 * @returns {string} 200.data.presets[].description - 预设描述
 * @returns {string} [200.data.presets[].cssFilter] - CSS滤镜字符串（可选）
 * 
 * @returns {Object} 401 - 未授权（需要登录）
 * @returns {Object} 500 - 服务器内部错误
 * 
 * @example
 * ```typescript
 * // 获取所有预设
 * const response = await fetch('/api/admin/style-presets')
 * 
 * // 获取人物风格预设
 * const response = await fetch('/api/admin/style-presets?category=portrait')
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 获取查询参数（可选分类筛选）
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as 'portrait' | 'landscape' | 'general' | null

    // 获取预设列表
    let presets
    if (category && ['portrait', 'landscape', 'general'].includes(category)) {
      presets = getPresetsByCategory(category)
    } else {
      presets = getAllPresets()
    }

    // 返回预设列表（不包含内部 config，只返回前端需要的字段）
    const presetList = presets.map(preset => ({
      id: preset.id,
      name: preset.name,
      category: preset.category,
      description: preset.description,
      cssFilter: preset.cssFilter,
    }))

    const response = createSuccessResponse({
      presets: presetList,
    })
    
    // 禁用缓存，确保返回最新数据
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch (error) {
    return handleError(error, '获取风格预设列表失败')
  }
}
