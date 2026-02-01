import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('应该渲染按钮', () => {
    render(<Button>点击我</Button>)
    expect(screen.getByText('点击我')).toBeInTheDocument()
  })

  it('应该支持不同的变体', () => {
    const { rerender } = render(<Button variant="primary">主要按钮</Button>)
    expect(screen.getByText('主要按钮')).toHaveClass('bg-accent')

    rerender(<Button variant="secondary">次要按钮</Button>)
    expect(screen.getByText('次要按钮')).toHaveClass('bg-surface-elevated')

    rerender(<Button variant="danger">危险按钮</Button>)
    expect(screen.getByText('危险按钮')).toHaveClass('bg-red-500')
  })

  it('应该支持不同的尺寸', () => {
    const { rerender } = render(<Button size="sm">小按钮</Button>)
    expect(screen.getByText('小按钮')).toHaveClass('text-sm')

    rerender(<Button size="md">中按钮</Button>)
    expect(screen.getByText('中按钮')).toHaveClass('text-base')

    rerender(<Button size="lg">大按钮</Button>)
    expect(screen.getByText('大按钮')).toHaveClass('text-lg')
  })

  it('应该支持禁用状态', () => {
    render(<Button disabled>禁用按钮</Button>)
    expect(screen.getByText('禁用按钮')).toBeDisabled()
  })

  it('应该在加载时显示加载图标', () => {
    render(<Button isLoading>加载中</Button>)
    expect(screen.getByText('加载中')).toBeDisabled()
    // 应该包含加载图标（通过类名或图标元素）
  })

  it('应该支持点击事件', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>点击我</Button>)
    
    await user.click(screen.getByText('点击我'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('应该在禁用时不触发点击事件', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>禁用按钮</Button>)
    
    await user.click(screen.getByText('禁用按钮'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('应该在加载时不触发点击事件', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button isLoading onClick={handleClick}>加载中</Button>)
    
    await user.click(screen.getByText('加载中'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('应该支持全宽', () => {
    render(<Button fullWidth>全宽按钮</Button>)
    expect(screen.getByText('全宽按钮')).toHaveClass('w-full')
  })
})
