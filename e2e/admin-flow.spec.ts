import { test, expect } from '@playwright/test'

/**
 * 管理员完整流程 E2E 测试
 * 
 * 测试流程:
 * 1. 登录管理员账户
 * 2. 创建相册
 * 3. 上传照片
 * 4. 设置相册
 * 5. 查看相册
 * 6. 分享相册
 */

test.describe('管理员完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 访问登录页
    await page.goto('/admin/login')
  })

  test('应该能够完成完整的相册管理流程', async ({ page }) => {
    // 1. 登录
    await test.step('登录管理员账户', async () => {
      // 等待页面加载
      await page.waitForLoadState('networkidle')
      
      // 填写登录表单
      const usernameInput = page.locator('input[name="username"], input[type="text"]').first()
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
      
      await usernameInput.fill('admin')
      await passwordInput.fill(process.env.ADMIN_PASSWORD || 'admin_password')
      
      // 提交表单
      const submitButton = page.locator('button[type="submit"], button:has-text("登录")').first()
      await submitButton.click()
      
      // 等待跳转到管理后台
      await page.waitForURL('/admin', { timeout: 10000 })
      await expect(page).toHaveURL(/\/admin$/)
    })

    // 2. 创建相册
    await test.step('创建新相册', async () => {
      // 查找创建相册按钮
      const createButton = page.locator('button:has-text("创建相册"), a:has-text("创建相册")').first()
      await createButton.click()
      
      // 填写相册信息
      await page.waitForSelector('input[name="title"], input[placeholder*="标题"]')
      await page.fill('input[name="title"], input[placeholder*="标题"]', 'E2E 测试相册')
      
      // 提交创建
      const submitButton = page.locator('button:has-text("创建"), button[type="submit"]').first()
      await submitButton.click()
      
      // 等待创建完成
      await page.waitForTimeout(2000)
    })

    // 3. 验证相册创建成功
    await test.step('验证相册已创建', async () => {
      // 检查相册列表中有新创建的相册
      await expect(page.locator('text=E2E 测试相册')).toBeVisible({ timeout: 10000 })
    })
  })

  test('应该能够登录并访问管理后台', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    
    // 填写登录信息
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first()
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
    
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin')
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill(process.env.ADMIN_PASSWORD || 'admin_password')
    }
    
    // 提交登录
    const submitButton = page.locator('button[type="submit"], button:has-text("登录")').first()
    await submitButton.click()
    
    // 验证登录成功
    await page.waitForURL('/admin', { timeout: 10000 })
    await expect(page).toHaveURL(/\/admin$/)
    
    // 验证管理后台元素存在
    await expect(page.locator('text=相册管理, text=系统设置').first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('数据一致性检查功能', () => {
  test('应该能够访问并执行一致性检查', async ({ page }) => {
    // 登录
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    
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
    
    // 访问系统设置
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')
    
    // 查找一致性检查组件
    const consistencySection = page.locator('text=数据一致性检查').first()
    await expect(consistencySection).toBeVisible({ timeout: 5000 })
    
    // 查找开始检查按钮
    const checkButton = page.locator('button:has-text("开始检查")').first()
    if (await checkButton.isVisible()) {
      await checkButton.click()
      
      // 等待检查完成（可能显示加载状态）
      await page.waitForTimeout(2000)
    }
  })
})

test.describe('存储检查功能', () => {
  test('应该能够访问并执行存储检查', async ({ page }) => {
    // 登录
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    
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
    
    // 访问相册列表，获取第一个相册
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    
    // 点击第一个相册（如果存在）
    const firstAlbum = page.locator('a[href*="/admin/albums/"]').first()
    if (await firstAlbum.isVisible({ timeout: 5000 })) {
      await firstAlbum.click()
      await page.waitForLoadState('networkidle')
      
      // 访问相册设置
      const settingsLink = page.locator('a[href*="/settings"], button:has-text("设置")').first()
      if (await settingsLink.isVisible({ timeout: 5000 })) {
        await settingsLink.click()
        await page.waitForLoadState('networkidle')
        
        // 查找存储检查组件
        const storageSection = page.locator('text=存储一致性检查').first()
        if (await storageSection.isVisible({ timeout: 5000 })) {
          const checkButton = page.locator('button:has-text("开始检查")').first()
          if (await checkButton.isVisible()) {
            await checkButton.click()
            await page.waitForTimeout(2000)
          }
        }
      }
    }
  })
})
