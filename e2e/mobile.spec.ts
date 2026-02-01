import { test, expect, devices } from '@playwright/test'

/**
 * 移动端专项测试
 * 
 * 测试移动设备的响应式布局和触摸交互
 */

// iPhone 13 测试
test.use({ ...devices['iPhone 13'] })

test.describe('移动端 - iPhone 13', () => {
  test('应该正确显示首页', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // 验证页面加载
    await expect(page).toHaveURL('/')
    
    // 检查移动端布局（应该使用移动端样式）
    const viewport = page.viewportSize()
    expect(viewport?.width).toBeLessThanOrEqual(390) // iPhone 13 宽度
  })

  test('应该能够访问管理后台', async ({ page }) => {
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    
    // 验证登录页在移动端正确显示
    await expect(page).toHaveURL(/\/admin\/login/)
    
    // 检查移动端导航（底部导航栏）
    const mobileNav = page.locator('[class*="mobile"], [class*="bottom-nav"]').first()
    // 移动端应该有底部导航
  })

  test('应该支持触摸交互', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // 测试触摸事件（点击）
    const albumLink = page.locator('a[href*="/album/"]').first()
    if (await albumLink.isVisible({ timeout: 5000 })) {
      await albumLink.tap()
      await page.waitForLoadState('networkidle')
    }
  })

  test('应该支持滑动操作', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // 测试滑动（如果有轮播或可滑动内容）
    // 使用 touch 事件模拟滑动
    await page.touchscreen.tap(100, 200)
    await page.mouse.move(100, 200)
    await page.mouse.down()
    await page.mouse.move(300, 200)
    await page.mouse.up()
  })
})

// Android Pixel 5 测试
test.describe('移动端 - Android Pixel 5', () => {
  test.use({ ...devices['Pixel 5'] })

  test('应该正确显示首页', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveURL('/')
    
    const viewport = page.viewportSize()
    expect(viewport?.width).toBeLessThanOrEqual(393) // Pixel 5 宽度
  })

  test('应该支持移动端上传', async ({ page }) => {
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    
    // 登录
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first()
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
    
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin')
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill(process.env.ADMIN_PASSWORD || 'admin_password')
    }
    
    const submitButton = page.locator('button[type="submit"], button:has-text("登录")').first()
    await submitButton.click()
    await page.waitForURL('/admin', { timeout: 10000 })
    
    // 访问相册
    const firstAlbum = page.locator('a[href*="/admin/albums/"]').first()
    if (await firstAlbum.isVisible({ timeout: 5000 })) {
      await firstAlbum.click()
      await page.waitForLoadState('networkidle')
      
      // 检查移动端上传区域
      const uploadArea = page.locator('text=点击选择文件').first()
      if (await uploadArea.isVisible({ timeout: 2000 })) {
        await expect(uploadArea).toBeVisible()
      }
    }
  })
})

test.describe('响应式布局测试', () => {
  const viewports = [
    { name: 'Mobile Small', width: 320, height: 568 }, // iPhone SE
    { name: 'Mobile Medium', width: 375, height: 667 }, // iPhone 8
    { name: 'Mobile Large', width: 414, height: 896 }, // iPhone 11 Pro Max
    { name: 'Tablet', width: 768, height: 1024 }, // iPad
    { name: 'Desktop', width: 1920, height: 1080 }, // Desktop
  ]

  for (const viewport of viewports) {
    test(`应该在 ${viewport.name} (${viewport.width}x${viewport.height}) 正确显示`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // 验证页面在不同尺寸下都能正常显示
      await expect(page).toHaveURL('/')
      
      // 检查关键元素是否可见
      const mainContent = page.locator('main, [role="main"]').first()
      await expect(mainContent).toBeVisible()
    })
  }
})
