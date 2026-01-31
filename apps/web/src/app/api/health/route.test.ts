/**
 * 健康检查 API 路由测试
 * 
 * 测试 GET 方法
 */

import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('should return healthy status', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.status).toBe('healthy')
    expect(data.data.service).toBe('pis-web')
    expect(data.data.timestamp).toBeDefined()
    expect(new Date(data.data.timestamp).toISOString()).toBe(data.data.timestamp)
  })

  it('should return valid ISO timestamp', async () => {
    const response = await GET()
    const data = await response.json()

    const timestamp = data.data.timestamp
    expect(() => new Date(timestamp)).not.toThrow()
    expect(new Date(timestamp).toISOString()).toBe(timestamp)
  })
})
