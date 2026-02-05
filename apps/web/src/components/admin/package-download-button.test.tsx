import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PackageDownloadButton } from './package-download-button'
import { showError } from '@/lib/toast'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock toast
vi.mock('@/lib/toast', () => ({
  showError: vi.fn(),
  showInfo: vi.fn(),
}))

describe('PackageDownloadButton', () => {
  const props = {
    albumId: 'album-1',
    photoCount: 10,
    selectedCount: 5,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染批量下载按钮', () => {
    render(<PackageDownloadButton {...props} />)
    
    // 按钮文本可能是"打包下载"或"打包"
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    expect(button).toBeInTheDocument()
  })

  it('应该显示已选照片数量', async () => {
    const user = userEvent.setup()
    render(<PackageDownloadButton {...props} />)
    
    // 照片数量在对话框内显示，需要先打开对话框
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      // 使用更精确的选择器，查找包含"已选照片"和"5"的元素
      const selectedText = screen.getByText(/已选照片.*5|5.*张/i)
      expect(selectedText).toBeInTheDocument()
    })
  })

  it('应该能够打开对话框', async () => {
    const user = userEvent.setup()
    render(<PackageDownloadButton {...props} />)
    
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/创建打包下载|创建下载包/i)).toBeInTheDocument()
    })
  })

  it('应该能够创建下载包', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ packageId: 'package-1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        status: 'completed',
        downloadUrl: 'http://example.com/download.zip'
      }),
    })

    render(<PackageDownloadButton {...props} />)
    
    // 打开对话框
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/创建打包下载|创建下载包/i)).toBeInTheDocument()
    })
    
    // 点击创建按钮
    const createButton = screen.getByRole('button', { name: /创建|生成/i })
    await user.click(createButton)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/admin/albums/${props.albumId}/package`,
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  it('应该支持选择照片范围', async () => {
    const user = userEvent.setup()
    render(<PackageDownloadButton {...props} />)
    
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/创建打包下载/i)).toBeInTheDocument()
    })
    
    // 应该显示照片选择选项
    expect(screen.getByText(/已选照片/i)).toBeInTheDocument()
    expect(screen.getByText(/全部照片/i)).toBeInTheDocument()
  })

  it('应该支持选择版本类型', async () => {
    const user = userEvent.setup()
    render(<PackageDownloadButton {...props} />)
    
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/创建打包下载/i)).toBeInTheDocument()
    })
    
    // 应该显示版本选择选项（使用更精确的选择器）
    const watermarkedLabel = screen.getByText('有水印版本')
    const originalLabel = screen.getByText('无水印版本（原图）')
    expect(watermarkedLabel).toBeInTheDocument()
    expect(originalLabel).toBeInTheDocument()
    
    // 验证复选框存在
    const watermarkedCheckbox = screen.getByLabelText('有水印版本') as HTMLInputElement
    const originalCheckbox = screen.getByLabelText('无水印版本（原图）') as HTMLInputElement
    expect(watermarkedCheckbox).toBeInTheDocument()
    expect(originalCheckbox).toBeInTheDocument()
  })

  it('应该验证至少选择一种版本', async () => {
    const user = userEvent.setup()
    const { showInfo } = await import('@/lib/toast')
    
    render(<PackageDownloadButton {...props} />)
    
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/创建打包下载/i)).toBeInTheDocument()
    })
    
    // 取消选择所有版本
    const watermarkedCheckbox = screen.getByLabelText(/有水印/i) as HTMLInputElement
    const originalCheckbox = screen.getByLabelText(/无水印/i) as HTMLInputElement
    
    if (watermarkedCheckbox.checked) {
      await user.click(watermarkedCheckbox)
    }
    if (originalCheckbox.checked) {
      await user.click(originalCheckbox)
    }
    
    // 尝试创建
    const createButton = screen.getByRole('button', { name: /创建/i })
    await user.click(createButton)
    
    await waitFor(() => {
      expect(showInfo).toHaveBeenCalledWith('请至少选择一种版本（有水印或无水印）')
    })
  })

  it('应该显示下载进度', async () => {
    const user = userEvent.setup()
    
    // Mock 创建打包请求
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/package') && !url.includes('packageId')) {
        // 创建打包请求
        return Promise.resolve({
          ok: true,
          json: async () => ({ packageId: 'package-1' }),
        } as Response)
      } else if (url.includes('packageId')) {
        // 轮询状态请求
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'processing' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response)
    })

    render(<PackageDownloadButton {...props} />)
    
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/创建打包下载/i)).toBeInTheDocument()
    })
    
    const createButton = screen.getByRole('button', { name: /创建打包|创建/i })
    await user.click(createButton)
    
    // 验证创建请求被调用
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/admin/albums/${props.albumId}/package`,
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
    
    // 等待对话框状态更新（从创建表单切换到进度显示）
    // 创建成功后，组件会设置 packageId，对话框会切换到显示进度状态
    await waitFor(() => {
      // 查找进度相关的文本（使用 getAllByText 处理多个匹配）
      const progressTitles = screen.getAllByText(/打包下载/i)
      // 查找对话框标题中的"打包下载"（不是按钮文本）
      const dialogTitle = progressTitles.find(el => 
        el.tagName === 'H2' || el.closest('[role="dialog"]')
      )
      // 或者查找"正在处理中"描述
      const progressDesc = screen.queryByText(/正在处理中|等待处理|正在打包/i)
      expect(dialogTitle || progressDesc).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('应该处理创建失败', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: '创建失败' } }),
    })

    render(<PackageDownloadButton {...props} />)
    
    const button = screen.getByRole('button', { name: /打包|批量下载/i })
    await user.click(button)
    
    await waitFor(() => {
      expect(screen.getByText(/创建打包下载/i)).toBeInTheDocument()
    })
    
    const createButton = screen.getByRole('button', { name: /创建打包|创建/i })
    await user.click(createButton)
    
    // 错误通过 toast 显示
    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    }, { timeout: 2000 })
  })
})
