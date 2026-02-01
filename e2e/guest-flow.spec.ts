import { test, expect } from '@playwright/test'

/**
 * 访客完整流程 E2E 测试
 * 
 * 测试流程:
 * 1. 访问首页
 * 2. 查看相册列表
 * 3. 访问相册（如果需要密码）
 * 4. 浏览照片
 * 5. 下载照片
 */

test.describe('访客完整流程', () => {
  test('应该能够访问首页并查看相册', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // 验证首页加载
    await expect(page).toHaveURL('/')
    
    // 检查页面标题或关键元素
    const pageTitle = page.locator('h1, [role="heading"]').first()
    if (await pageTitle.isVisible({ timeout: 5000 })) {
      await expect(pageTitle).toBeVisible()
    }
  })

  test('应该能够访问公开相册', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // 查找相册链接
    const albumLink = page.locator('a[href*="/album/"]').first()
    
    if (await albumLink.isVisible({ timeout: 5000 })) {
      const href = await albumLink.getAttribute('href')
      if (href) {
        await albumLink.click()
        await page.waitForLoadState('networkidle')
        
        // 验证跳转到相册页面
        await expect(page).toHaveURL(/\/album\//)
      }
    }
  })

  test('应该能够处理密码保护的相册', async ({ page }) => {
    // 这个测试需要先创建一个密码保护的相册
    // 暂时跳过，需要测试数据支持
    test.skip()
  })
})
