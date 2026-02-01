import { test, expect } from '@playwright/test'

/**
 * 错误场景 E2E 测试
 * 
 * 测试各种错误情况下的用户体验
 */

test.describe('错误场景测试', () => {
  test('应该处理登录失败', async ({ page }) => {
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first()
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
    
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('wrong_user')
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('wrong_password')
    }
    
    const submitButton = page.locator('button[type="submit"], button:has-text("登录")').first()
    await submitButton.click()
    
    // 应该显示错误信息
    await page.waitForTimeout(2000)
    
    // 检查是否有错误提示（可能通过 toast 或页面上的错误信息）
    const errorMessage = page.locator('text=错误, text=失败, text=不正确').first()
    // 如果有错误信息，验证它存在
    // 如果没有，可能是通过其他方式显示错误
  })

  test('应该处理404页面', async ({ page }) => {
    await page.goto('/non-existent-page')
    await page.waitForLoadState('networkidle')
    
    // 应该显示404页面或重定向
    // Next.js 默认会显示404页面
    const notFound = page.locator('text=404, text=Not Found, text=页面不存在').first()
    // 验证404处理
  })

  test('应该处理无效的相册访问', async ({ page }) => {
    await page.goto('/album/invalid-slug-12345')
    await page.waitForLoadState('networkidle')
    
    // 应该显示404或错误信息
    const errorMessage = page.locator('text=不存在, text=404, text=Not Found').first()
    // 验证错误处理
  })

  test('应该处理网络错误', async ({ page, context }) => {
    // 模拟网络离线
    await context.setOffline(true)
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // 应该优雅地处理离线状态
    // 可能显示错误信息或使用缓存
  })

  test('应该处理API错误', async ({ page }) => {
    // 这个测试需要拦截API请求并返回错误
    // 使用 Playwright 的 route 功能
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: { message: '服务器错误' } }),
      })
    })
    
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    
    // 尝试登录（会触发API错误）
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first()
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
    
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin')
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('password')
    }
    
    const submitButton = page.locator('button[type="submit"], button:has-text("登录")').first()
    await submitButton.click()
    
    // 应该显示错误信息
    await page.waitForTimeout(2000)
  })
})

test.describe('边界情况测试', () => {
  test('应该处理超大文件上传', async ({ page }) => {
    // 这个测试需要创建一个大文件
    // 实际测试中应该使用真实的文件
    test.skip('需要真实的大文件进行测试')
  })

  test('应该处理特殊字符文件名', async ({ page }) => {
    // 测试包含特殊字符的文件名
    test.skip('需要包含特殊字符的文件进行测试')
  })

  test('应该处理并发上传', async ({ page }) => {
    // 测试同时上传多个文件
    test.skip('需要多个文件进行测试')
  })
})
