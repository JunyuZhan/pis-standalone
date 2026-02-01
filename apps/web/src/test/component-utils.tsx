import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'

/**
 * 自定义渲染函数，包含所有必要的 providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    ...options,
  })
}

/**
 * Mock fetch 响应
 */
export function mockFetchResponse(data: any, ok = true) {
  return {
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
  }
}

/**
 * 创建 mock fetch
 */
export function createMockFetch(responses: Array<{ data: any; ok?: boolean }>) {
  let callCount = 0
  return vi.fn().mockImplementation(() => {
    const response = responses[callCount] || responses[responses.length - 1]
    callCount++
    return Promise.resolve(mockFetchResponse(response.data, response.ok ?? true))
  })
}

export * from '@testing-library/react'
export { customRender as render }
