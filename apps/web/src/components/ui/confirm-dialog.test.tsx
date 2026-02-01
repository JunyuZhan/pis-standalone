import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染确认对话框', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="确认删除"
        message="确定要删除这个项目吗？"
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText('确认删除')).toBeInTheDocument()
    expect(screen.getByText('确定要删除这个项目吗？')).toBeInTheDocument()
    expect(screen.getByText('确认')).toBeInTheDocument()
    expect(screen.getByText('取消')).toBeInTheDocument()
  })

  it('应该支持自定义确认和取消文本', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="确认操作"
        message="确定要继续吗？"
        confirmText="是的"
        cancelText="不了"
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText('是的')).toBeInTheDocument()
    expect(screen.getByText('不了')).toBeInTheDocument()
  })

  it('应该支持危险变体', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="确认删除"
        message="此操作不可恢复"
        variant="danger"
        onConfirm={vi.fn()}
      />
    )

    // 危险变体应该有警告图标
    const dialog = screen.getByText('确认删除').closest('[role="dialog"]')
    expect(dialog).toBeInTheDocument()
  })

  it('应该能够取消操作', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="确认操作"
        message="确定要继续吗？"
        onConfirm={onConfirm}
      />
    )

    const cancelButton = screen.getByText('取消')
    await user.click(cancelButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('应该能够确认操作', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="确认操作"
        message="确定要继续吗？"
        onConfirm={onConfirm}
      />
    )

    const confirmButton = screen.getByText('确认')
    await user.click(confirmButton)

    expect(onConfirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('应该在确认时显示加载状态', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(resolve, 100)
      })
    })

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="确认操作"
        message="确定要继续吗？"
        onConfirm={onConfirm}
      />
    )

    const confirmButton = screen.getByText('确认')
    await user.click(confirmButton)

    // 按钮应该在加载时禁用
    expect(confirmButton).toBeDisabled()
  })

  it('应该在确认失败时保持打开状态', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn().mockRejectedValue(new Error('操作失败'))

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="确认操作"
        message="确定要继续吗？"
        onConfirm={onConfirm}
      />
    )

    const confirmButton = screen.getByText('确认')
    await user.click(confirmButton)

    // 等待异步操作完成
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled()
    })

    // 对话框应该仍然打开（因为操作失败）
    expect(screen.getByText('确认操作')).toBeInTheDocument()
  })
})
