# PIS 开发计划

> 最后更新：2026-02-06

## 目录

- [已完成功能](#已完成功能)
- [高优先级](#高优先级)
- [中优先级](#中优先级)
- [低优先级](#低优先级)
- [长期规划](#长期规划)

---

## 已完成功能

### 核心功能
- [x] 相册管理（创建、编辑、删除、分组）
- [x] 照片上传（支持批量、拖拽、分片上传）
- [x] 照片处理（缩略图生成、EXIF 提取、旋转）
- [x] 照片风格预设（日系、电影、黑白等）
- [x] 水印功能（文字、图片水印）
- [x] 相册分享（链接、二维码、海报）
- [x] 用户认证（JWT 登录、密码管理）
- [x] 多用户支持（管理员、普通用户）

### 相机直传 (FTP)
- [x] FTP 服务器（支持相机直连）
- [x] 被动模式支持（局域网/公网）
- [x] frp 内网穿透支持
- [x] 自动处理上传照片

### 部署相关
- [x] Docker Compose 一键部署
- [x] 单端口模式（Nginx 反向代理）
- [x] 环境变量模板 (.env.example)
- [x] 页面加载动画
- [x] 复制功能兼容性（HTTP 环境）
- [x] ICP 备案号配置支持

---

## 高优先级

### 1. 后台系统设置界面 ✅ 已完成
> 让用户通过网页配置系统，无需编辑 .env 文件

**功能点：**
- [x] 创建 `system_settings` 数据库表
- [x] 品牌设置
  - [x] 摄影师/工作室名称
  - [x] 品牌标语
  - [x] Logo 上传
  - [x] Favicon 上传
- [x] 版权与备案
  - [x] 版权声明文字
  - [x] ICP 备案号
  - [x] 公安备案号
- [x] 站点配置
  - [x] 站点标题
  - [x] 站点描述
  - [x] SEO 关键词
- [x] 功能开关
  - [x] 是否允许游客访问首页
  - [x] 默认是否启用水印
  - [x] 默认是否允许下载
  - [x] 是否显示 EXIF 信息
- [x] 社交链接
  - [x] 微信二维码上传
  - [x] 微博/Instagram 等链接
  - [x] 联系方式
- [x] 主题设置
  - [x] 主题模式（亮色/暗色/跟随系统）
  - [x] 主色调选择

**已完成的技术实现：**
```
1. 数据库表: system_settings
   - docker/init-postgresql-db.sql (新增表和初始数据)
   - docker/migrations/001_add_system_settings.sql (迁移脚本)

2. API 接口
   - GET /api/admin/settings - 获取所有设置
   - PATCH /api/admin/settings - 更新设置
   - GET /api/public/settings - 获取公开设置

3. 前端组件
   - components/admin/system-settings-section.tsx
   - hooks/use-settings.ts (useSettings, useAdminSettings, SettingsProvider)
   - lib/settings.ts (服务端获取设置)

4. Footer 组件更新
   - site-footer.tsx / album-footer.tsx 使用数据库设置
```

### 2. GitHub Releases 升级系统 ✅ 已完成
> 基于版本号的自动升级，替代当前的 Git commit 对比

**功能点：**
- [x] 版本检查
  - [x] 调用 GitHub Releases API 获取最新版本
  - [x] 对比当前版本与最新版本
  - [x] 显示版本号（如 v1.2.0）
- [x] 更新详情
  - [x] 显示 Release Notes（更新日志）
  - [x] 显示发布时间
  - [x] 显示预发布版本标记
- [x] 一键升级
  - [x] 拉取指定版本 Tag
  - [x] 重新构建镜像（可选）
  - [x] 重启服务
  - [x] 显示升级进度（流式日志）
- [x] 升级历史
  - [x] 记录每次升级
  - [x] 支持回滚到历史版本

**已完成的技术实现：**
```
1. 版本管理
   - lib/version.ts: 版本号常量和比较工具
   - package.json version: 1.0.0

2. API 接口
   - GET /api/admin/upgrade/check
     调用 GitHub Releases API
     返回: currentVersion, latestVersion, hasUpdate, releaseNotes, publishedAt
   
   - POST /api/admin/upgrade/execute
     支持 targetVersion 参数
     执行: git fetch --tags && git checkout <tag>
     可选: --rebuild (无缓存构建)
     自动记录升级历史
   
   - GET /api/admin/upgrade/history
     获取升级历史记录（分页）
     包含执行人、状态、耗时等信息
   
   - POST /api/admin/upgrade/rollback
     执行版本回滚
     支持 target_version 参数
     流式日志输出
     自动记录回滚历史

3. 升级脚本
   - scripts/deploy/quick-upgrade.sh
     新增 --tag <version> 参数
     支持切换到指定版本 Tag

4. 数据库表
   - upgrade_history: 升级/回滚历史记录
     记录版本变更、状态、执行人、耗时等

5. 前端组件
   - components/admin/upgrade-manager.tsx
     版本信息展示
     更新日志 Markdown 渲染
     一键升级按钮
     流式升级日志显示
     升级历史列表
     版本回滚功能
```

### 3. 海报预览图优化 ✅ 已完成
> 为海报模板添加真实的预览效果

**功能点：**
- [x] 海报模板预览图
  - [x] 经典模板预览
  - [x] 简约模板预览
  - [x] 优雅模板预览
  - [x] 商务模板预览
- [x] 实时预览
  - [x] 调整参数时实时更新预览
  - [x] 使用相册封面作为背景
- [x] Canvas 动态渲染
  - [x] 使用 Canvas API 实时渲染预览
  - [x] 支持文字、遮罩、二维码预览

**已完成的技术实现：**
```
1. 预览组件
   - components/admin/poster-preview.tsx
     - PosterPreview: Canvas 实时渲染预览
     - PosterTemplatePreview: 模板选择卡片

2. 配置对话框增强
   - poster-config-dialog.tsx
     - 添加实时预览面板（可切换）
     - 支持传入相册标题、描述、封面

3. 技术特点
   - Canvas API 渲染海报效果
   - 支持背景图片居中裁剪
   - 动态文字定位（顶部/居中/底部）
   - 二维码位置模拟
   - 响应式预览尺寸（sm/md/lg）
```

---

## 中优先级

### 4. 主题系统 ✅ 已完成
> 支持多种主题风格

**功能点：**
- [x] 内置主题
  - [x] 亮色主题
  - [x] 暗色主题（默认）
  - [x] 自动跟随系统
- [x] 自定义主题
  - [x] 主色调选择
  - [x] 背景色（随主题自动切换）
  - [x] 文字颜色（随主题自动切换）
  - [x] 圆角大小
- [x] 主题切换
  - [x] 前台主题切换按钮
  - [x] 后台主题设置

**已完成的技术实现：**
```
1. CSS 变量系统
   - globals.css: 亮色/暗色主题 CSS 变量定义
   - tailwind.config.ts: 使用 CSS 变量实现动态颜色

2. 主题提供者
   - components/theme-provider.tsx: ThemeProvider 和 useTheme
   - 支持 localStorage 持久化
   - 支持系统主题偏好检测

3. 主题切换组件
   - components/theme-toggle.tsx: 主题切换按钮
   - 循环切换：亮色 -> 暗色 -> 跟随系统

4. 主色调动态应用
   - 保存设置时同步更新 CSS 变量
   - 支持任意 HEX 颜色

5. 防闪烁优化
   - layout.tsx 内联初始化脚本
   - 页面加载前即应用正确主题
```

### 5. 相册模板系统 ✅ 已完成
> 预设相册样式模板

**功能点：**
- [x] 内置模板
  - [x] 婚礼相册模板（经典婚礼、现代婚礼）
  - [x] 活动相册模板（活力活动、商务活动）
  - [x] 人像相册模板（艺术人像、清新人像）
  - [x] 产品相册模板（产品展示）
  - [x] 旅行相册模板（旅行探险）
- [x] 模板配置
  - [x] 布局样式（瀑布流、网格、故事流、时间线）
  - [x] 配色方案（主题色、背景色、文字色、强调色）
  - [x] 字体选择（衬线/无衬线字体）
  - [x] 动画效果（淡入、滑入、缩放）
  - [x] 悬停效果（缩放、浮起、发光、遮罩）
- [ ] 自定义模板
  - [ ] 模板编辑器（待实现）
  - [ ] 模板导入/导出（待实现）

**已完成的技术实现：**
```
1. 模板定义
   - lib/album-templates.ts: 模板类型和内置模板配置
   - 8 个内置模板覆盖婚礼、活动、人像、产品、旅行场景
   - 完整的模板样式配置（主题、字体、布局、动画等）

2. 数据库支持
   - albums.template_id: 存储选择的模板 ID
   - albums.template_config: 存储自定义模板配置
   - 迁移脚本: 004_add_album_template.sql

3. 模板选择器
   - components/admin/template-selector.tsx: 模板选择组件
   - 按分类筛选（婚礼、活动、人像等）
   - 模板预览卡片（实时预览效果）
   - 模板详情展示（布局、字体、动画、配色）

4. 样式应用
   - components/album/template-style-provider.tsx: 客户端样式提供者
   - hooks/use-template-styles.ts: 模板样式 Hook
   - 动态 CSS 变量注入
   - 主题模式自动切换

5. 集成
   - 相册设置页面添加模板选择
   - 相册浏览页面自动应用模板样式
   - API 支持模板字段更新
```

### 6. 客户管理 ✅ 已完成
> 管理客户信息和相册关联

**功能点：**
- [x] 客户信息
  - [x] 姓名、电话、邮箱、微信
  - [x] 公司/单位、地址
  - [x] 备注信息
  - [x] 标签分类（支持多标签）
  - [x] 客户来源（转介绍/网站/社交媒体/其他）
  - [x] 客户状态（活跃/非活跃/已归档）
- [x] 相册关联
  - [x] 一个客户多个相册
  - [x] 客户-相册关联 API
  - [x] 相册页面关联客户选择器
- [x] 通知功能
  - [x] 相册就绪通知
  - [x] 邮件通知（SMTP）
  - [ ] 短信通知（待实现，需要第三方短信服务）

**已完成的技术实现：**
```
1. 数据库表
   - customers: 客户信息表
   - customer_albums: 客户-相册关联表
   - notifications: 通知记录表
   - email_config: 邮件配置表

2. API 接口
   - GET /api/admin/customers: 获取客户列表（支持搜索、筛选、分页）
   - POST /api/admin/customers: 创建客户
   - GET /api/admin/customers/[id]: 获取客户详情及关联相册
   - PATCH /api/admin/customers/[id]: 更新客户
   - DELETE /api/admin/customers/[id]: 删除客户（软删除）
   - POST /api/admin/customers/[id]/albums: 关联相册
   - DELETE /api/admin/customers/[id]/albums: 取消关联
   - POST /api/admin/notifications/send: 发送客户通知
   - GET /api/admin/notifications: 获取通知历史
   - GET/POST /api/admin/notifications/email-config: 邮件配置管理

3. 前端组件
   - components/admin/customer-list.tsx: 客户列表页
   - components/admin/customer-dialog.tsx: 客户编辑对话框
   - components/admin/send-notification-dialog.tsx: 发送通知对话框
   - app/admin/(dashboard)/customers/page.tsx: 客户管理页面

4. 功能特点
   - 支持姓名、电话、邮箱、公司搜索
   - 按状态、标签筛选
   - 显示关联相册数量
   - 标签管理（添加/删除）
   - 相册就绪邮件通知（精美模板）
   - 支持自定义邮件主题和内容
   - 通知历史记录
```

### 7. 数据统计 ✅ 已完成
> 相册访问和下载统计

**功能点：**
- [x] 访问统计
  - [x] 相册浏览量
  - [x] 照片查看量
  - [x] 访问来源
  - [x] 访问设备（电脑/手机/平板）
  - [x] 浏览器统计
- [x] 下载统计
  - [x] 单张下载次数
  - [x] 下载文件数量
  - [x] 下载数据大小
- [x] 数据可视化
  - [x] 访问趋势图表
  - [x] 热门相册排行
  - [x] 设备类型分布
  - [x] 导出报表（CSV/JSON）

**已完成的技术实现：**
```
1. 数据库表
   - album_views: 相册访问记录
   - photo_views: 照片查看记录
   - download_logs: 下载记录
   - daily_stats: 每日统计汇总（用于快速查询）

2. API 接口
   - POST /api/analytics/track: 记录访问事件
   - GET /api/admin/analytics: 获取统计概览
   - GET /api/admin/analytics/albums/[id]: 获取相册详细统计

3. 前端组件
   - components/admin/analytics-dashboard.tsx: 统计仪表盘
   - hooks/use-analytics.ts: 访问追踪 hooks

4. 功能特点
   - 自动追踪相册访问（AlbumClient）
   - 自动追踪照片查看（Lightbox）
   - 自动追踪下载事件
   - 会话去重（避免重复计数）
   - 多时间范围支持（7天/30天/90天/全部）
```

---

## 低优先级

### 8. 多语言支持增强
> 完善国际化支持

**功能点：**
- [x] 后台语言切换
  - [x] 语言切换组件（已集成到侧边栏）
  - [x] 后台管理翻译字符串（中/英）
  - [x] 侧边栏菜单国际化
- [x] 相册多语言标题/描述
  - [x] 数据库字段支持（title_translations, description_translations 等 JSONB 字段）
  - [x] API 支持（createAlbumSchema, updateAlbumSchema 添加多语言字段）
  - [x] 前端编辑组件（TranslationEditor 组件）
- [ ] 语言包管理界面

**已完成的技术实现：**
```
1. i18n 配置
   - i18n/config.ts: 语言配置（zh-CN, en）
   - lib/i18n.ts: 语言工具函数
   - messages/zh-CN.json: 中文翻译
   - messages/en.json: 英文翻译

2. 组件
   - components/ui/language-switcher.tsx: 语言切换组件
   - components/admin/sidebar.tsx: 使用 useTranslations
   - components/admin/translation-editor.tsx: 多语言编辑器组件

3. 翻译内容
   - 后台侧边栏菜单
   - 客户管理相关
   - 通知功能相关
   - 数据统计相关
   - 系统升级相关
   - 系统设置相关

4. 相册多语言编辑
   - 标题多语言编辑（title_translations）
   - 描述多语言编辑（description_translations）
   - 分享标题多语言编辑（share_title_translations）
   - 分享描述多语言编辑（share_description_translations）
   - 已集成到 album-settings-form.tsx
```

### 9. 插件系统
> 支持第三方插件扩展

**功能点：**
- [ ] 插件 API
- [ ] 插件市场
- [ ] 官方插件（云存储、AI 修图等）

### 10. 移动端 App
> 原生移动应用

**功能点：**
- [ ] iOS App
- [ ] Android App
- [ ] 相册管理
- [ ] 推送通知

---

## 长期规划

### 11. AI 功能增强
- [ ] AI 自动修图
- [ ] AI 人脸识别分组
- [ ] AI 智能标签
- [ ] AI 相册描述生成

### 12. 协作功能
- [ ] 多摄影师协作
- [ ] 权限管理
- [ ] 操作日志

### 13. 云服务版本
- [ ] SaaS 多租户支持
- [ ] 订阅计费
- [ ] 云存储集成

---

## 版本规划

| 版本 | 主要功能 | 预计内容 |
|------|---------|---------|
| v1.1.0 | 后台配置 | 系统设置界面、品牌配置 |
| v1.2.0 | 升级系统 | GitHub Releases 升级、版本管理 |
| v1.3.0 | 主题系统 | 多主题支持、自定义主题 |
| v1.4.0 | 客户管理 | 客户信息、相册关联 |
| v1.5.0 | 数据统计 | 访问统计、数据可视化 |
| v2.0.0 | 重大更新 | AI 功能、插件系统 |

---

## 贡献指南

欢迎贡献代码！请参考以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 问题反馈

如有问题或建议，请通过以下方式反馈：

- [GitHub Issues](https://github.com/JunyuZhan/pis/issues)
- 邮箱：[项目维护者邮箱]

---

*此文档会随开发进度持续更新*
