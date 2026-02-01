import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * 
 * 运行测试:
 *   pnpm exec playwright test
 * 
 * 在 UI 模式下运行:
 *   pnpm exec playwright test --ui
 * 
 * 调试模式:
 *   pnpm exec playwright test --debug
 */
export default defineConfig({
  testDir: './e2e',
  
  // 测试超时时间
  timeout: 30 * 1000,
  
  // 期望超时时间
  expect: {
    timeout: 5000,
  },
  
  // 并行运行测试
  fullyParallel: true,
  
  // 失败时重试
  retries: process.env.CI ? 2 : 0,
  
  // 工作进程数
  workers: process.env.CI ? 1 : undefined,
  
  // 报告配置
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  // 共享设置
  use: {
    // 基础 URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // 截图配置
    screenshot: 'only-on-failure',
    
    // 视频配置
    video: 'retain-on-failure',
    
    // 追踪配置
    trace: 'on-first-retry',
    
    // 动作超时
    actionTimeout: 10000,
    
    // 导航超时
    navigationTimeout: 30000,
  },

  // 测试项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Web 服务器配置（用于开发模式）
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
