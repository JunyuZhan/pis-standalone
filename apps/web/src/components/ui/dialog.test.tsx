import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog'
import { Button } from './button'

describe('Dialog', () => {
  it('应该渲染对话框', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>打开对话框</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>测试标题</DialogTitle>
            <DialogDescription>测试描述</DialogDescription>
          </DialogHeader>
          <div>对话框内容</div>
        </DialogContent>
      </Dialog>
    )

    const trigger = screen.getByText('打开对话框')
    await user.click(trigger)

    expect(screen.getByText('测试标题')).toBeInTheDocument()
    expect(screen.getByText('测试描述')).toBeInTheDocument()
    expect(screen.getByText('对话框内容')).toBeInTheDocument()
  })

  it('应该能够关闭对话框', async () => {
    const user = userEvent.setup()
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>测试标题</DialogTitle>
            <DialogDescription>测试描述</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByText('测试标题')).toBeInTheDocument()

    // 查找关闭按钮（X按钮）
    const closeButton = screen.getByRole('button', { name: /关闭/i })
    await user.click(closeButton)

    // 对话框应该关闭（通过检查是否还在DOM中）
    await waitFor(() => {
      expect(screen.queryByText('测试标题')).not.toBeInTheDocument()
    })
  })

  it('应该支持受控模式', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>受控对话框</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByText('受控对话框')).toBeInTheDocument()

    const closeButton = screen.getByRole('button', { name: /关闭/i })
    await user.click(closeButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
