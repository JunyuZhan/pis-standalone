import { NextResponse } from 'next/server'
import { createSuccessResponse } from '@/lib/validation/error-handler'

/**
 * 健康检查 API
 * 
 * @route GET /api/health
 * @description 检查服务健康状态，用于 Docker 健康检查和负载均衡器探测
 * 
 * @auth 无需认证（公开接口）
 * 
 * @returns {Object} 200 - 服务正常
 * @returns {string} 200.data.status - 状态（"healthy"）
 * @returns {string} 200.data.timestamp - 时间戳（ISO 8601格式）
 * @returns {string} 200.data.service - 服务名称（"pis-web"）
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/health')
 * const data = await response.json()
 * console.log('Service status:', data.data.status)
 * ```
 */
export async function GET() {
  return createSuccessResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'pis-web'
  })
}

// 同时支持 /health 路径（Nginx 配置使用）
export const dynamic = 'force-dynamic'
