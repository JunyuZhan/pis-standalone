import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConsistencyChecker } from './consistency-checker'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ConsistencyChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染检查选项', () => {
    render(<ConsistencyChecker />)
    
    expect(screen.getByText('检查选项')).toBeInTheDocument()
    expect(screen.getByText('自动修复不一致记录')).toBeInTheDocument()
    expect(screen.getByText('删除孤立文件')).toBeInTheDocument()
    expect(screen.getByText('删除孤立记录')).toBeInTheDocument()
    expect(screen.getByText('批次大小:')).toBeInTheDocument()
  })

  it('应该显示默认批次大小为 100', () => {
    render(<ConsistencyChecker />)
    
    const batchSizeInput = screen.getByText('批次大小:').parentElement?.querySelector('input[type="number"]') as HTMLInputElement
    expect(batchSizeInput).toBeInTheDocument()
    if (batchSizeInput) {
      expect(parseInt(batchSizeInput.value) || batchSizeInput.value).toBe(100)
    }
  })

  it('应该能够切换检查选项', async () => {
    const user = userEvent.setup()
    render(<ConsistencyChecker />)
    
    const autoFixCheckbox = screen.getByLabelText(/^自动修复不一致记录/)
    expect(autoFixCheckbox).not.toBeChecked()
    
    await user.click(autoFixCheckbox)
    expect(autoFixCheckbox).toBeChecked()
  })

  it('应该能够触发检查', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          totalChecked: 100,
          inconsistencies: 0, // 0 表示检查通过
          fixed: 0,
          orphanedFiles: 0,
          orphanedRecords: 0,
        },
      }),
    })
    global.fetch = mockFetch

    render(<ConsistencyChecker />)
    
    const checkButton = screen.getByText('开始检查')
    await user.click(checkButton)
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/consistency/check',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )
    
    await waitFor(() => {
      expect(screen.getByText('检查通过')).toBeInTheDocument()
    })
  })

  it('应该显示检查结果', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          totalChecked: 100,
          inconsistencies: 0, // 0 表示检查通过
          fixed: 0,
          orphanedFiles: 0,
          orphanedRecords: 0,
        },
      }),
    })
    global.fetch = mockFetch

    render(<ConsistencyChecker />)
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(screen.getByText('检查通过')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument() // totalChecked
    })
  })

  it('应该显示不一致结果', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          totalChecked: 100,
          inconsistencies: 10,
          fixed: 0,
        },
      }),
    })
    global.fetch = mockFetch

    render(<ConsistencyChecker />)
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(screen.getByText('发现不一致')).toBeInTheDocument()
    })
  })

  it('应该显示错误信息', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          totalChecked: 100,
          inconsistencies: 5,
          errors: ['错误1', '错误2'],
        },
      }),
    })
    global.fetch = mockFetch

    render(<ConsistencyChecker />)
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(screen.getByText('错误信息:')).toBeInTheDocument()
      expect(screen.getByText('• 错误1')).toBeInTheDocument()
      expect(screen.getByText('• 错误2')).toBeInTheDocument()
    })
  })

  it('应该处理检查失败', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: '检查失败' },
      }),
    })
    global.fetch = mockFetch

    render(<ConsistencyChecker />)
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(screen.getByText('检查失败，请查看控制台或联系管理员')).toBeInTheDocument()
    })
  })

  it('应该在检查时显示加载状态', async () => {
    const user = userEvent.setup()
    let resolvePromise: (value: any) => void
    mockFetch.mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePromise = resolve
      })
    })
    global.fetch = mockFetch

    render(<ConsistencyChecker />)
    
    await user.click(screen.getByText('开始检查'))
    
    expect(screen.getByText('检查中...')).toBeInTheDocument()
    
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true, result: {} }),
    })

    await waitFor(() => {
      expect(screen.queryByText('检查中...')).not.toBeInTheDocument()
    })
  })

  it('应该发送正确的请求体', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: {} }),
    })
    global.fetch = mockFetch

    render(<ConsistencyChecker />)
    
    // 启用所有选项
    await user.click(screen.getByLabelText(/^自动修复不一致记录/))
    await user.click(screen.getByLabelText(/^删除孤立文件/))
    await user.click(screen.getByLabelText(/^删除孤立记录/))
    
    // 修改批次大小 - 直接设置value并触发change事件
    const batchSizeInput = screen.getByText('批次大小:').parentElement?.querySelector('input[type="number"]') as HTMLInputElement
    if (batchSizeInput) {
      // 直接设置值并触发change事件
      await user.click(batchSizeInput)
      // 使用triple click选中所有文本
      await user.tripleClick(batchSizeInput)
      await user.type(batchSizeInput, '200', { skipClick: true })
      // 触发blur以确保值更新
      await user.tab()
    }
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[0]).toBe('/api/admin/consistency/check')
      expect(callArgs[1]).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
      
      // 检查请求体
      const requestBody = JSON.parse(callArgs[1].body)
      // 验证所有字段都存在且值正确
      expect(requestBody.autoFix).toBe(true)
      expect(requestBody.deleteOrphanedFiles).toBe(true)
      expect(requestBody.deleteOrphanedRecords).toBe(true)
      expect(requestBody.batchSize).toBe(200)
    }, { timeout: 3000 })
  })
})
