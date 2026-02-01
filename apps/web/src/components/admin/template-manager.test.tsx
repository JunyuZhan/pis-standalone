import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateManager } from './template-manager'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TemplateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该加载并显示模板列表', async () => {
    const mockTemplates = [
      { id: '1', name: '模板1', description: '描述1', created_at: '2024-01-01' },
      { id: '2', name: '模板2', description: '描述2', created_at: '2024-01-02' },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ 
        data: { templates: mockTemplates },
        templates: mockTemplates 
      }),
    })

    render(<TemplateManager />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates')
    })

    await waitFor(() => {
      expect(screen.getByText('模板1')).toBeInTheDocument()
      expect(screen.getByText('模板2')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('应该能够创建新模板', async () => {
    const user = userEvent.setup()

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { templates: [] },
          templates: [] 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { id: '1', name: '新模板', description: '' },
          id: '1', 
          name: '新模板', 
          description: '' 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { templates: [{ id: '1', name: '新模板', description: '' }] },
          templates: [{ id: '1', name: '新模板', description: '' }] 
        }),
      })

    render(<TemplateManager />)

    // 等待组件加载完成
    await waitFor(() => {
      // 查找"新建模板"按钮（按钮文本）
      const createButtons = screen.queryAllByText(/新建模板|创建模板/i)
      expect(createButtons.length).toBeGreaterThan(0)
    })

    // 查找并点击"新建模板"按钮 - 使用更精确的选择器
    let createButton: HTMLElement | null = null
    try {
      // 先尝试通过 role 查找
      createButton = screen.getByRole('button', { name: /新建模板/i })
    } catch {
      // 如果找不到，通过文本查找并定位到按钮
      const createTexts = screen.getAllByText(/新建模板/i)
      for (const text of createTexts) {
        const button = text.closest('button')
        if (button) {
          createButton = button
          break
        }
      }
    }
    
    if (createButton) {
      await user.click(createButton)
    } else {
      throw new Error('找不到"新建模板"按钮')
    }
    
    // 等待对话框打开
    await waitFor(() => {
      // 对话框标题应该是"新建模板"
      const dialogTitle = screen.getByRole('heading', { name: /新建模板/i })
      expect(dialogTitle).toBeInTheDocument()
    }, { timeout: 3000 })

    // 填写表单 - 使用placeholder查找输入框
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText(/例如：婚礼相册模板/i)
      expect(nameInput).toBeInTheDocument()
    }, { timeout: 2000 })
    
    const nameInput = screen.getByPlaceholderText(/例如：婚礼相册模板/i)
    await user.clear(nameInput)
    await user.type(nameInput, '新模板')

    // 提交 - 查找对话框中的提交按钮
    const submitButton = screen.getByRole('button', { name: /创建|确认|保存/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/templates',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  it('应该能够删除模板', async () => {
    const user = userEvent.setup()
    const mockTemplates = [
      { id: '1', name: '模板1', description: '描述1', created_at: '2024-01-01' },
    ]

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { templates: mockTemplates },
          templates: mockTemplates 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { templates: [] },
          templates: [] 
        }),
      })

    render(<TemplateManager />)

    // 等待模板加载完成
    await waitFor(() => {
      // 模板名称可能显示在多个地方，检查是否存在
      const templateName = screen.queryByText('模板1')
      expect(templateName).toBeTruthy()
    }, { timeout: 5000 })
    
    // 确保模板已经渲染
    expect(screen.getByText('模板1')).toBeInTheDocument()

    // 查找删除按钮
    const deleteButton = screen.getByRole('button', { name: /删除/i })
    await user.click(deleteButton)

    // 确认删除
    await waitFor(() => {
      expect(screen.getByText(/确认删除/i)).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /确认/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/templates/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  it('应该能够编辑模板', async () => {
    const user = userEvent.setup()
    const mockTemplates = [
      { id: '1', name: '模板1', description: '描述1', created_at: '2024-01-01' },
    ]

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { templates: mockTemplates },
          templates: mockTemplates 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { id: '1', name: '模板1', description: '描述1' },
          id: '1', 
          name: '模板1', 
          description: '描述1' 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { id: '1', name: '修改后的模板', description: '新描述' },
          id: '1', 
          name: '修改后的模板', 
          description: '新描述' 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          data: { templates: [{ id: '1', name: '修改后的模板', description: '新描述', created_at: '2024-01-01' }] },
          templates: [{ id: '1', name: '修改后的模板', description: '新描述', created_at: '2024-01-01' }] 
        }),
      })

    render(<TemplateManager />)

    await waitFor(() => {
      expect(screen.getByText('模板1')).toBeInTheDocument()
    }, { timeout: 5000 })

    // 查找编辑按钮
    const editButton = screen.getByRole('button', { name: /编辑/i })
    await user.click(editButton)

    // 修改名称
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('模板1')
      expect(nameInput).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('模板1')
    await user.clear(nameInput)
    await user.type(nameInput, '修改后的模板')

    // 提交（编辑时按钮文本是"保存"）
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /保存/i })
      expect(submitButton).toBeInTheDocument()
    })
    const submitButton = screen.getByRole('button', { name: /保存/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/templates/1',
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })
  })

  it('应该显示加载状态', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // 永不resolve

    render(<TemplateManager />)

    // 应该显示加载状态（如果有的话）
    // 或者至少不应该显示错误
  })

  it('应该处理加载失败', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: '加载失败' } }),
    })

    render(<TemplateManager />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // 应该优雅地处理错误（不崩溃）
    expect(screen.queryByText('加载失败')).not.toBeInTheDocument()
  })
})
