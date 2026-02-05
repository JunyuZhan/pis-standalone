# 🚀 PIS 项目路线图与实施计划

> **目标**：打造比肩行业领袖（如拍立享）的专业级“即拍即传”平台，专注于采集、工作流和智能化。

## 📦 项目结构概览
- **`apps/web`**: Next.js 应用（管理后台、客户端相册、API 路由）。
- **`services/worker`**: Node.js 后台服务（图片处理、存储、队列消费）。
- **`services/ai`** (规划中): Python 微服务，用于人脸识别 (InsightFace)。

---

## 🗓️ 第一阶段：采集 - FTP 服务集成（优先级：最高）
**目标**：支持相机（Sony/Canon）通过 FTP 协议直接上传照片，无需手机 APP。

### 1.1 服务搭建 (`services/worker`)
- [x] **依赖安装**: 在 `services/worker` 中安装 `ftp-srv`。
- [x] **架构设计**: 创建 `services/worker/src/ftp-server.ts` 处理 FTP 生命周期。
- [x] **Docker 配置**: 在 `docker-compose.yml` 中暴露 FTP 命令端口 (21) 和被动模式端口 (如 30000-30009)。

### 1.2 认证与路由
- [x] **认证策略**:
  - 用户名: `album_id` (UUID) 或 `short_code` (短码)。
  - 密码: `upload_token` (在相册设置中定义)。
- [x] **验证逻辑**: 通过数据库适配器验证相册是否存在且令牌匹配。

### 1.3 文件处理流程
- [x] **接收**: 将传入的 FTP 文件流写入本地临时存储。
- [x] **存储**: 上传到 MinIO (`raw/{album_id}/{photo_id}.jpg`)。
- [x] **入库**:
  - 插入数据库记录，状态为 `pending`。
  - 触发 BullMQ 中的 `process-photo` 任务（复用现有逻辑）。
- [x] **清理**: MinIO 上传成功后删除本地临时文件。

### 1.4 前端管理与 API 接口（已完成 ✅）
**状态**: 所有前端管理和 API 接口已完成，FTP 功能现在可以正常使用。

- [x] **TypeScript 类型定义** (`apps/web/src/types/database.ts`):
  - 在 `albums` 表的 `Row`、`Insert`、`Update` 接口中添加 `upload_token` 字段。
  
- [x] **验证 Schema** (`apps/web/src/lib/validation/schemas.ts`):
  - 在 `createAlbumSchema` 中添加 `upload_token` 字段（可选，自动生成）。
  - 在 `updateAlbumSchema` 中添加 `upload_token` 字段（可选，用于重置）。

- [x] **API 接口** (`apps/web/src/app/api/admin/albums/route.ts`):
  - 创建相册时自动生成 `upload_token`（如果未提供）。
  - 使用安全的随机字符串生成器（`generateUploadToken`）。
  - 返回创建的相册数据时包含 `upload_token`。

- [x] **API 接口** (`apps/web/src/app/api/admin/albums/[id]/route.ts`):
  - 更新相册时支持重置 `upload_token`（发送空字符串时自动生成新令牌）。

- [x] **前端界面** (`apps/web/src/components/admin/album-settings-form.tsx`):
  - 添加 FTP 配置区域，显示：
    - FTP 服务器地址（从环境变量读取）
    - FTP 端口（默认 21）
    - 用户名（相册 ID 和 Slug，两种方式）
    - 上传令牌（`upload_token`，可复制）
    - 重置令牌按钮
  - 添加配置说明和使用提示。

- [x] **前端界面** (`apps/web/src/components/admin/create-album-dialog.tsx`):
  - 创建相册成功后，显示 FTP 配置信息（可折叠区域）。

- [x] **工具函数** (`apps/web/src/lib/utils.ts`):
  - 添加生成安全随机令牌的函数 `generateUploadToken()`。
  - 添加获取 FTP 服务器地址的函数 `getFtpServerHost()`。
  - 添加获取 FTP 端口的函数 `getFtpServerPort()`。

**注意事项**:
- `upload_token` 应该使用安全的随机字符串（建议长度 32-64 字符）。
- 前端显示时应该支持一键复制功能。
- 重置令牌时应该提示用户更新相机配置。

---

## 📱 第一阶段补充方案：相机-手机-服务器上传（优先级：中）
**目标**：支持摄影师通过数据线将相机连接到手机，手机中安装PIS软件或打开网页，当PIS检测到相机时自动上传照片。

### 方案概述
- **场景**：相机通过USB数据线连接手机，手机打开PIS网页或PWA应用，上传相机中的照片。
- **优势**：无需相机Wi-Fi功能，利用手机作为中转，降低硬件要求。
- **挑战**：浏览器安全限制，无法自动检测USB连接的相机，需要用户手动选择照片。

### ⚠️ 重要说明：当前Web端限制
**浏览器无法自动检测USB连接的相机**，实际工作流程如下：

**当前可行的工作流程（Web端）**：
1. 摄影师用USB数据线连接相机到手机
2. 手机系统识别相机为存储设备（MTP模式），相机的存储卡内容会出现在手机的文件管理器中
3. 摄影师打开PIS网页，点击"上传照片"按钮
4. 浏览器弹出文件选择器：
   - **iOS Safari**：
     - 默认打开手机相册（Photos），支持多选和滑动选择（推荐）
     - 如需访问相机存储卡，需点击"浏览"或"文件"，但只能单张点击选择，不能滑动
   - **Android Chrome**：
     - 可能打开相册或文件管理器（取决于浏览器设置）
     - 支持多选：长按第一张照片进入选择模式，或点击菜单选择"选择多个"
     - 在文件管理器中可导航到相机存储卡（通常显示为"USB存储"），支持多选
5. 选择后自动上传到PIS服务器

**✅ 当前已支持的功能**：
- ✅ **浏览相机存储卡**：通过浏览器的文件选择器可以访问相机存储卡内的照片
- ✅ **批量选择**：文件选择器支持多选，可以一次选择多张照片
- ✅ **支持多种格式**：JPG、PNG、HEIC、WebP、GIF、TIFF
- ✅ **大文件支持**：支持最大100MB的单文件，大文件自动使用分片上传

**⚠️ 限制**：
- ❌ **无法自动检测**：浏览器无法知道相机已连接，需要用户手动点击上传按钮
- ❌ **无法自动选择**：需要用户手动从文件选择器中选择照片
- ⚠️ **iOS文件系统限制**：浏览文件系统时只能单张点击选择，不能滑动多选（这是iOS Safari的限制）
- ⚠️ **需要手机系统支持**：相机必须被手机系统识别为存储设备（MTP模式），部分相机可能需要设置为"文件传输"模式
- ✅ **推荐方案**：iOS用户建议先将相机照片导入手机相册，然后从相册多选上传（支持滑动选择）

**未来改进方向**：
- ✅ **HTML5相机直接拍摄**：添加"直接拍摄"按钮，摄影师可以直接用手机拍摄并上传（不需要USB连接）
- ⚠️ **原生应用**：开发Android/iOS原生应用可以实现自动检测相机连接（需要系统级权限）

### 当前代码状态检查 ✅
**已实现的功能**：
- ✅ **Web上传组件** (`apps/web/src/components/admin/photo-uploader.tsx`):
  - 支持拖拽上传、批量选择、上传进度显示
  - 支持分片上传（>=5MB文件）、断点续传、自动重试机制
  - 支持移动端响应式设计
  - 支持从手机相册选择照片上传（`<input type="file" multiple accept="image/*">`）
  
- ✅ **PWA支持** (`apps/web/public/manifest.json`):
  - 已配置PWA manifest，支持安装到主屏幕
  - 已配置Web Share Target API，可以从其他应用分享照片到PIS
  - 已实现Service Worker，支持离线缓存

- ✅ **上传API** (`apps/web/src/app/api/admin/albums/[id]/upload/route.ts`):
  - 支持presigned URL直接上传到MinIO
  - 支持文件类型验证、大小限制（100MB）
  - 支持速率限制（300次/分钟）

**可行性评估**：
- ✅ **立即可行**：HTML5相机直接拍摄、优化移动端上传体验
- ⚠️ **技术限制**：浏览器无法直接检测USB连接的相机设备
- ⚠️ **需要原生应用**：自动检测相机连接需要系统级权限

### 1.5 移动端上传优化（立即可实施，优先级：高）✅ 部分完成
**当前状态**：基础功能已实现，需要优化移动端体验。

- [x] **基础功能** (`apps/web/src/components/admin/photo-uploader.tsx`):
  - ✅ 支持移动端响应式设计
  - ✅ 支持从手机相册选择照片上传
  - ✅ 支持分片上传、断点续传、自动重试
  - ✅ 支持上传进度显示和错误提示

- [x] **移动端多选提示优化** (`apps/web/src/components/admin/photo-uploader.tsx`):
  - ✅ 添加移动设备检测（iOS/Android）
  - ✅ 添加多选操作提示
  - ✅ iOS：提示从相册选择支持多选，浏览文件系统只能单选
  - ✅ Android：提示如何进入多选模式
  - ⚠️ **已知限制**：iOS Safari浏览文件系统时不支持多选（浏览器限制）

- [ ] **HTML5相机直接拍摄** (`apps/web/src/components/admin/photo-uploader.tsx`):
  - [ ] 添加"直接拍摄"按钮，使用 `<input type="file" capture="environment">`
  - [ ] 支持前后摄像头切换（`capture="user"` 前置，`capture="environment"` 后置）
  - [ ] 拍摄后自动添加到上传队列
  - [ ] 优化移动端拍摄体验（全屏、横屏支持）

- [ ] **PWA离线上传** (`apps/web/public/sw.js`):
  - [ ] 实现离线队列，网络恢复后自动重试上传
  - [ ] 使用IndexedDB存储待上传文件列表
  - [ ] 显示离线状态和待上传文件数量

- [ ] **移动端体验优化** (`apps/web/src/components/admin/photo-uploader.tsx`):
  - [ ] 优化大文件上传提示（移动端网络可能不稳定）
  - [ ] 添加"仅Wi-Fi上传"选项（避免消耗移动数据）
  - [ ] 优化上传进度条在移动端的显示
  - [ ] 添加批量选择时的缩略图预览

### 1.6 相机检测与自动上传（技术限制，优先级：低）
**⚠️ 重要说明**：由于浏览器安全限制，以下方案在Web端**不可行**或**支持有限**。

- [ ] **WebUSB API集成** (`apps/web`):
  - ⚠️ **不可行**：WebUSB API主要支持自定义USB设备（需要设备厂商实现WebUSB协议），标准相机（Sony/Canon等）不支持。
  - ⚠️ **限制**：即使相机支持WebUSB，也需要用户手动授权，无法自动检测。

- [ ] **File System Access API集成** (`apps/web`):
  - ⚠️ **移动端不支持**：File System Access API仅在桌面端Chrome/Edge支持，移动端浏览器不支持。
  - ⚠️ **限制**：即使支持，也需要用户手动选择文件夹，无法自动检测相机存储。

- [ ] **MTP协议支持** (`apps/web` 或 `services/worker`):
  - ⚠️ **浏览器无法访问**：MTP（Media Transfer Protocol）需要系统级权限，浏览器无法直接访问。
  - ⚠️ **需要原生应用**：必须通过原生应用（Android/iOS）才能访问MTP设备。

### 1.7 替代实现方案（推荐实施路径）

**方案A：优化Web上传体验（短期，优先级：高）✅ 推荐**
**状态**：基础功能已实现，需要添加相机直接拍摄功能。

- [x] **移动端上传基础功能** (`apps/web/src/components/admin/photo-uploader.tsx`):
  - ✅ 支持从手机相册选择照片上传
  - ✅ 支持批量选择、上传进度显示
  - ✅ 支持分片上传、断点续传、自动重试

- [ ] **HTML5相机直接拍摄** (`apps/web/src/components/admin/photo-uploader.tsx`):
  - [ ] 添加"拍摄照片"按钮，使用 `<input type="file" capture="environment">`
  - [ ] 支持前后摄像头切换
  - [ ] 拍摄后自动添加到上传队列
  - **实施难度**：低（1-2天）
  - **用户体验**：摄影师可以直接用手机拍摄并上传，无需先保存到相册

- [ ] **PWA离线上传** (`apps/web/public/sw.js`):
  - [ ] 实现离线队列，使用IndexedDB存储待上传文件
  - [ ] 网络恢复后自动重试上传
  - **实施难度**：中（3-5天）
  - **用户体验**：网络不稳定时也能继续上传，提升可靠性

**方案B：Android原生应用（中期，优先级：中）**
**状态**：需要新建项目，可以访问系统级API。

- [ ] **Android原生应用** (新建 `apps/android`):
  - [ ] 使用Android Media Store API访问相机照片
  - [ ] 实现USB设备检测（通过USB Host API）
  - [ ] 自动检测相机连接（监听USB设备连接事件）
  - [ ] 提供PIS上传功能，与Web API集成（复用现有上传API）
  - **实施难度**：高（2-3周）
  - **技术栈**：Kotlin/Java + Android SDK
  - **优势**：可以自动检测相机连接，用户体验最佳

**方案C：iOS原生应用（中期，优先级：中）**
**状态**：需要新建项目，可以访问系统级API。

- [ ] **iOS原生应用** (新建 `apps/ios`):
  - [ ] 使用Photos Framework访问相机照片
  - [ ] 实现USB设备检测（通过External Accessory Framework）
  - [ ] 自动检测相机连接（需要MFi认证，仅支持认证设备）
  - [ ] 提供PIS上传功能，与Web API集成（复用现有上传API）
  - **实施难度**：高（2-3周）
  - **技术栈**：Swift + iOS SDK
  - **限制**：MFi认证设备才能自动检测，其他设备需要手动选择

**方案D：混合应用（长期，优先级：低）**
**状态**：需要新建项目，可以复用Web端业务逻辑。

- [ ] **React Native / Capacitor应用**:
  - [ ] 使用跨平台框架开发移动应用
  - [ ] 通过原生插件访问相机存储（React Native Camera Roll / Capacitor Filesystem）
  - [ ] 通过原生插件检测USB设备（需要自定义插件）
  - [ ] 复用Web端业务逻辑，降低开发成本
  - **实施难度**：中-高（3-4周）
  - **优势**：一套代码支持iOS和Android，维护成本低

### 实施建议与优先级

**第一阶段（立即实施，1-2周）**：
1. ✅ **优化现有Web上传体验**（已完成基础功能）
2. [ ] **添加HTML5相机直接拍摄功能**（优先级：高，1-2天）
3. [ ] **实现PWA离线上传**（优先级：中，3-5天）

**第二阶段（根据用户反馈，1-2个月）**：
1. [ ] **评估原生应用需求**（根据用户反馈决定）
2. [ ] **开发Android原生应用**（如果用户需求强烈）
3. [ ] **开发iOS原生应用**（如果用户需求强烈）

**技术选型建议**：
- **短期**：优先实施方案A（Web优化），成本低、见效快
- **中期**：根据用户反馈决定是否开发原生应用
- **长期**：如果多平台需求强烈，考虑方案D（混合应用）

### 技术限制说明

**浏览器安全限制**：
- ❌ **无法自动检测USB设备**：浏览器无法访问USB设备列表，无法自动检测相机连接
- ❌ **无法访问MTP设备**：MTP协议需要系统级权限，浏览器无法访问
- ❌ **File System Access API移动端不支持**：仅在桌面端Chrome/Edge支持
- ✅ **HTML5相机拍摄可行**：可以使用 `<input type="file" capture="environment">` 直接调用相机
- ✅ **从相册选择可行**：可以使用 `<input type="file" multiple accept="image/*">` 选择照片

**推荐路径**：
1. **立即实施**：添加HTML5相机直接拍摄功能，优化移动端上传体验
2. **收集反馈**：观察用户使用情况，评估是否需要原生应用
3. **按需开发**：如果用户需求强烈，再考虑开发原生应用（方案B/C）

**注意事项**：
- 浏览器安全限制使得直接访问USB设备（如相机）在Web端**不可行**
- WebUSB API主要支持自定义USB设备，标准相机（Sony/Canon等）**不支持**
- File System Access API在移动端**不支持**
- MTP协议需要系统级权限，浏览器**无法直接访问**
- **推荐路径**：先优化Web上传体验（方案A），再根据实际需求考虑原生应用开发（方案B/C）

---

## 🗓️ 第二阶段：协作工作流 - 修图师角色（优先级：高）
**目标**：引入“人工介入”流程，支持发布前的专业修图。

### 2.1 数据库架构 (`apps/web`)
- [x] **迁移**:
  - `users` 表添加 `role` 枚举: `['admin', 'photographer', 'retoucher', 'guest']`。
  - `photos` 表添加 `status` 枚举: `['pending_retouch', 'retouching']`。
  - `photos` 表添加 `retoucher_id` (关联到 users 表)。

### 2.2 修图师工作台 (`apps/web`)
- [x] **界面**: 创建 `/admin/retouch` 仪表盘（修图师视图）。
  - 列出状态为 `pending_retouch` 的照片。
  - “领取任务”按钮（将照片分配给当前用户）。
- [x] **操作**: 下载原图 -> 上传精修图。
- [x] **逻辑**: 当精修图上传后：
  - 替换 `original_key`（或保存为新版本）。
  - 更新状态为 `processing`。
  - 触发 Worker 重新生成缩略图/水印。

### 2.3 管理配置
- [x] **相册设置**: 增加“开启人工修图”模式开关。
  - 开启后，上传的照片状态默认为 `pending_retouch` 而非 `processing`。

---

## 🗓️ 第三阶段：AI 智能 - 智能修图（优先级：中）
**目标**：为没有人工修图师的活动提供自动化的质量增强。

### 3.1 AI 服务商集成 (`services/worker`)
- [x] **选型**: 选择 API 提供商（目前实现为 Mock/Sharp 基础增强，架构支持扩展）。
- [x] **实现**: 创建 `services/worker/src/lib/ai-retouch.ts`。
- [x] **流程**:
  - 在 `PhotoProcessor` 中增加步骤：在添加水印之前。
  - 发送原图 -> AI API -> 接收增强图 -> 继续处理。

### 3.2 配置
- [x] **界面**: 在相册设置中添加“AI 增强”开关。
- [x] **参数**: 允许选择预设（如“人像模式”、“风景模式”）。

### 3.3 全局设置（已完成 ✅，优先级：中）
- [ ] **系统设置页面** (`apps/web/src/app/admin/(dashboard)/settings/page.tsx`):
  - [ ] 添加“AI 修图全局设置”卡片
  - [ ] 添加全局开关，允许一键关闭/开启所有相册的 AI 修图功能
  - [ ] 显示当前启用 AI 修图的相册数量统计
  - [ ] 提供批量操作：一键关闭所有相册的 AI 修图

- [ ] **客户端组件** (`apps/web/src/components/admin/ai-retouch-settings.tsx`):
  - [x] 创建新的 Client Component（参考 `ConsistencyChecker` 组件结构）
  - [x] Props: `{ totalAlbums: number, enabledAlbums: number, allAlbumIds: string[] }`
  - [x] 显示统计信息：总相册数、启用 AI 修图的相册数、百分比
  - [x] 添加全局开关（使用 Toggle 组件，参考相册设置中的开关样式）
  - [x] 使用 `useState` 管理加载状态和开关状态
  - [x] 使用 `fetch` 调用批量更新 API：`PATCH /api/admin/albums/batch`
  - [x] 使用 `showSuccess` 和 `handleApiError` 处理结果
  - [x] 使用 `Sparkles` 图标（与相册设置保持一致）
  - [x] 添加空状态提示（当没有相册时）

- [x] **扩展批量更新 API** (`apps/web/src/app/api/admin/albums/batch/route.ts`):
  - [x] 扩展 `batchUpdateSchema` (`apps/web/src/lib/validation/schemas.ts`)：
    - 在 `updates` 对象中添加 `enable_ai_retouch: z.boolean().optional()`
  - [x] 扩展批量更新逻辑：
    - 在 `PATCH /api/admin/albums/batch` 中添加 `enable_ai_retouch` 字段支持
    - 使用现有的批量更新机制：`db.update('albums', updateData, { 'id[]': albumIds, deleted_at: null })`

- [x] **批量操作逻辑**:
  - [x] 在 Server Component 中获取所有未删除的相册 ID
  - [x] 在 Client Component 中调用批量更新 API：`PATCH /api/admin/albums/batch`
  - [x] 请求体：`{ albumIds: [...], updates: { enable_ai_retouch: true/false } }`
  - [x] 复用现有的批量更新机制，无需新建 API 路由

**实施难度**：中（2-3天）
**用户体验**：管理员可以在系统设置中统一管理所有相册的 AI 修图功能，无需逐个相册设置

**设计说明**：
- ✅ **复用现有架构**：使用现有的批量更新 API (`/api/admin/albums/batch`)，无需新建路由
- ✅ **符合代码风格**：参考 `ConsistencyChecker` 和 `TemplateManager` 组件模式
- ✅ **Server + Client 混合**：统计信息在 Server Component 中查询，操作在 Client Component 中执行
- ✅ **统一图标**：使用 `Sparkles` 图标，与相册设置保持一致
- ✅ **统一验证**：扩展 `batchUpdateSchema`，复用现有验证逻辑

---

## 🗓️ 第四阶段：AI 智能 - 人脸识别（优先级：低/未来） (已完成 ✅)
**目标**：允许访客通过上传自拍找到自己的照片。

### 4.1 向量数据库
- [x] **基础设施**: 在 PostgreSQL 中启用 `pgvector` 扩展 (Docker Image: pgvector/pgvector:pg16)。
- [x] **Schema**: 创建 `face_embeddings` 表 (photo_id, embedding_vector, face_location) 及 RPC 搜索函数。

### 4.2 人脸服务 (新建 `services/ai`)
- [x] **搭建**: 使用 FastAPI + InsightFace 创建 Python 服务 (Docker Service: ai)。
- [x] **API**:
  - `POST /extract`: 从图片提取人脸 -> 返回向量。
  - (优化) 搜索直接使用 PostgreSQL RPC `search_faces`，无需 Python 服务介入搜索过程。

### 4.3 Worker 集成
- [x] **流程**: 照片处理完成后，发送缩略图给 人脸服务。
- [x] **存储**: 将返回的向量保存到数据库。

### 4.4 用户界面 (`apps/web`)
- [x] **C 端**: 在相册页添加“找自己”按钮 (`FloatingActions`)。
- [x] **交互**: 上传自拍 -> 调用搜索 API -> 存入 SessionStorage -> 过滤相册显示。

---

## 🛠 系统优化（已完成/进行中）
- [x] **代码质量**: 修复所有 TypeScript 类型错误 (apps/web)。
- [x] **测试优化**: 修复 `src/app/api/auth/change-password/route.test.ts` 和 `signout/route.test.ts` 中的噪声日志。

## 🔐 角色权限管理（已完成 ✅）
**目标**：完善用户角色系统，实现基于角色的访问控制（RBAC）。

### 5.1 数据库角色定义完善（已完成 ✅）
- [x] **更新数据库注释** (`docker/init-postgresql-db.sql`):
  - 更新 `users` 表的 `role` 字段注释，明确支持的角色列表：`['admin', 'photographer', 'retoucher', 'guest']`。
  - 确保角色字段定义清晰，便于后续维护。

### 5.2 角色检查辅助函数（已完成 ✅）
- [x] **创建角色检查工具** (`apps/web/src/lib/auth/role-helpers.ts`):
  - 创建 `requireRole()` 函数，统一角色权限检查逻辑。
  - 创建 `getUserRole()` 函数，获取当前用户的角色。
  - 创建 `requireAdmin()` 便捷函数，检查管理员权限。
  - 创建 `requireRetoucherOrAdmin()` 便捷函数，检查修图师或管理员权限。
  - 支持多角色检查（如：`['admin', 'retoucher']`）。
  - 返回统一的错误响应格式。

### 5.3 API 权限检查实现（已完成 ✅）
- [x] **修图任务 API** (`apps/web/src/app/api/admin/retouch/tasks/route.ts`):
  - 实现角色检查，只允许 `admin` 或 `retoucher` 角色访问。
  - 移除 TODO 注释，完成权限验证。

- [x] **修图上传 API** (`apps/web/src/app/api/admin/retouch/[id]/upload/route.ts`):
  - 添加角色检查，确保只有 `admin` 或 `retoucher` 可以上传精修图。

- [x] **其他管理 API**:
  - 升级检查 API (`upgrade/check`) 已使用新的角色检查函数。
  - 升级执行 API (`upgrade/execute`) 已使用新的角色检查函数。

### 5.4 代码重构（已完成 ✅）
- [x] **统一角色检查模式**:
  - 重构现有的角色检查代码（`upgrade/check` 和 `upgrade/execute`），使用新的辅助函数。
  - 确保所有角色检查使用统一的实现方式。
  - 移除了重复的数据库查询代码，提高了代码可维护性。

**实现说明**:
- ✅ 采用"角色检查辅助函数"方案，避免修改 JWT 结构，保持灵活性。
- ✅ 角色变更后立即生效，无需重新登录。
- ✅ 所有角色检查统一使用 `requireRole()`、`requireAdmin()` 或 `requireRetoucherOrAdmin()` 函数。
- ✅ 代码已通过构建测试，无类型错误。

## 👥 用户与角色管理（已完成 ✅）
**目标**：完善用户创建和管理功能，支持创建不同角色的用户，并提供用户管理界面。

### 6.1 用户创建功能增强（已完成 ✅）
- [x] **修改 createUser 方法** (`apps/web/src/lib/auth/database.ts`):
  - 添加 `role` 参数，支持指定用户角色（默认为 'admin' 保持向后兼容）。
  - 更新方法签名：`createUser(email: string, passwordHash: string | null, role?: UserRole)`。
  - 支持 `passwordHash` 为 `null`（首次登录时设置密码）。
  - 验证角色值有效性（必须是 'admin', 'photographer', 'retoucher', 'guest' 之一）。
  - 更新 `AuthDatabase` 接口定义，保持向后兼容。
  - ✅ 添加 `deleted_at` 检查，防止已删除用户登录。

- [x] **更新 create-admin 脚本** (`scripts/utils/create-admin.ts`):
  - 添加 `--role` 参数，支持创建不同角色的用户。
  - 更新脚本帮助信息，说明支持的角色类型。
  - 保持向后兼容（不指定角色时默认为 'admin'）。

- [x] **更新部署脚本** (`docker/deploy.sh`):
  - ✅ 部署脚本已支持创建管理员账号（`create_admin_account` 函数）。
  - ✅ 支持通过 `pnpm create-admin` 脚本创建不同角色的用户（已更新脚本支持 `--role` 参数）。
  - ⚠️ **说明**：部署脚本目前创建的是 `admin` 角色用户，如需创建其他角色用户，可在部署后使用 `pnpm create-admin <email> <password> <role>` 命令。
  - 💡 **未来优化**：可以考虑在部署脚本中添加交互式选择角色功能，但当前实现已满足需求。

### 6.2 用户管理 API（已完成 ✅）
- [x] **创建用户 API** (`apps/web/src/app/api/admin/users/route.ts`):
  - `POST /api/admin/users` - 创建新用户（需要管理员权限）。
  - 支持指定角色、邮箱、密码（可选，首次登录时设置）。
  - 验证邮箱唯一性、角色有效性。

- [x] **用户列表 API** (`apps/web/src/app/api/admin/users/route.ts`):
  - `GET /api/admin/users` - 获取用户列表（需要管理员权限）。
  - 支持分页、筛选（按角色、状态）、搜索（按邮箱）。

- [x] **用户详情 API** (`apps/web/src/app/api/admin/users/[id]/route.ts`):
  - `GET /api/admin/users/[id]` - 获取用户详情（需要管理员权限）。
  - 返回用户信息（不包含密码哈希）。

- [x] **更新用户 API** (`apps/web/src/app/api/admin/users/[id]/route.ts`):
  - `PATCH /api/admin/users/[id]` - 更新用户信息（需要管理员权限）。
  - 支持更新角色、邮箱、激活状态。
  - 不允许通过此 API 更新密码（使用专门的密码修改 API）。
  - ✅ 防止修改/禁用最后一个管理员账户。

- [x] **删除用户 API** (`apps/web/src/app/api/admin/users/[id]/route.ts`):
  - `DELETE /api/admin/users/[id]` - 删除用户（需要管理员权限）。
  - 使用软删除（设置 `deleted_at`），与相册删除保持一致。
  - 软删除后用户数据保留，可以通过恢复功能恢复。
  - ✅ 防止删除最后一个管理员账户（检查 `role='admin'` 且 `is_active=true` 且 `deleted_at IS NULL` 的用户数量）。

- [x] **重置用户密码 API** (`apps/web/src/app/api/admin/users/[id]/reset-password/route.ts`):
  - `POST /api/admin/users/[id]/reset-password` - 管理员重置用户密码（需要管理员权限）。
  - 重置后用户需要首次登录时设置新密码。

### 6.3 验证 Schema（已完成 ✅）
- [x] **用户创建 Schema** (`apps/web/src/lib/validation/schemas.ts`):
  - 创建 `createUserSchema`，验证邮箱、密码（可选）、角色。
    - `email`: 使用 `emailSchema`（邮箱格式验证）。
    - `password`: 可选，如果提供则使用 `passwordSchema`（至少 8 个字符）。
    - `role`: 枚举类型 `['admin', 'photographer', 'retoucher', 'guest']`，默认 'admin'。
  - 创建 `updateUserSchema`，验证可更新的字段。
    - `email`: 可选，邮箱格式验证。
    - `role`: 可选，角色枚举验证。
    - `is_active`: 可选，布尔值。

- [x] **用户查询 Schema** (`apps/web/src/lib/validation/schemas.ts`):
  - 创建 `userListQuerySchema`，验证分页、筛选、搜索参数。
    - `page`: 可选字符串，转换为数字（默认 1）。
    - `limit`: 可选字符串，转换为数字（默认 50，最大 100）。
    - `role`: 可选，角色枚举筛选。
    - `is_active`: 可选字符串，转换为布尔值（'true'/'false'），修复了 `undefined` 转换问题。
    - `search`: 可选字符串，用于邮箱搜索。

- [x] **用户 ID Schema** (`apps/web/src/lib/validation/schemas.ts`):
  - 创建 `userIdSchema`，验证用户 ID（UUID 格式）。
  - 与现有的 `albumIdSchema` 保持一致的模式。

### 6.4 用户管理界面（已完成 ✅）
- [x] **用户列表页面** (`apps/web/src/app/admin/users/page.tsx`):
  - 显示用户列表（邮箱、角色、状态、最后登录时间）。
  - 支持搜索、筛选（按角色）、分页。
  - 添加"创建用户"按钮。
  - ✅ 在侧边栏添加"用户管理"菜单项。

- [x] **创建用户对话框** (`apps/web/src/components/admin/create-user-dialog.tsx`):
  - 表单字段：邮箱、密码（可选）、角色选择。
  - 验证邮箱格式、密码强度（如果提供）。
  - 成功后刷新用户列表。

- [x] **用户详情/编辑页面** (`apps/web/src/app/admin/users/[id]/page.tsx`):
  - 显示用户详细信息。
  - 支持编辑角色、邮箱、激活状态。
  - 支持重置密码功能。
  - 显示用户最后登录时间、创建时间等。

### 6.5 权限检查（已完成 ✅）
- [x] **用户管理 API 权限**:
  - 所有用户管理 API 只允许 `admin` 角色访问。
  - 使用 `requireAdmin()` 函数进行权限检查。

- [x] **前端路由保护**:
  - `/admin/users` 路由需要管理员权限。
  - 在页面组件中检查用户角色（服务端组件）。

### 6.6 代码重构（已完成 ✅）
- [x] **统一用户创建逻辑**:
  - `setup-password` API 已使用 `createUser` 方法（向后兼容）。
  - 所有用户创建路径使用统一的实现。

**实现说明**:
- ✅ 所有功能已实现并通过构建测试。
- ✅ 修复了安全漏洞：`findUserByEmail` 和 `hasAnyAdmin` 现在检查 `deleted_at`。
- ✅ 修复了查询参数转换问题：`is_active` 参数正确处理 `undefined` 值。
- ✅ 代码已通过 TypeScript 类型检查，无构建错误。
- ✅ 所有 API 使用统一的错误处理和响应格式。
- ✅ 前端界面响应式设计，支持移动端。

**注意事项**:
- **向后兼容**：不指定角色时默认为 'admin'，`createUser` 方法签名保持兼容。
- **安全性**：
  - 密码哈希使用 PBKDF2 + SHA-512，100,000 次迭代。
  - 所有用户管理 API 需要管理员权限（`requireAdmin()`）。
  - 密码重置后设置为 `NULL`，用户首次登录时设置新密码。
- **用户体验**：
  - 密码可选，首次登录时设置（`password_hash` 为 NULL）。
  - 用户列表支持搜索、筛选、分页。
- **数据完整性**：
  - 防止删除最后一个管理员账户（检查逻辑：`role='admin'` 且 `is_active=true` 且 `deleted_at IS NULL`）。
  - 使用软删除（设置 `deleted_at`），与相册删除保持一致。
  - 删除用户时检查关联数据（如修图任务中的 `retoucher_id`）。
- **代码一致性**：
  - API 响应格式使用 `createSuccessResponse()` 和 `handleError()`。
  - 错误处理使用 `ApiError.*` 系列方法。
  - 分页格式与相册列表 API 保持一致：`{ data: [...], pagination: { page, limit, total, totalPages } }`。

## ✅ 已完成功能

### FTP 集成前端管理（已完成 ✅）
**状态**: FTP 集成功能已完全实现，包括后端服务和前端管理界面。

**完成内容**: 见第一阶段 1.4 节（前端管理与 API 接口）。

**功能**: 用户现在可以在管理后台查看和配置 FTP 上传信息，相机可以使用 FTP 功能上传照片。

### 用户与角色管理（已完成 ✅）
**状态**: 用户管理功能已完全实现，包括 API、前端界面和权限控制。

**完成内容**: 见第六阶段（👥 用户与角色管理）。

**功能**: 
- 管理员可以创建、查看、编辑、删除用户账户。
- 支持创建不同角色的用户（admin、photographer、retoucher、guest）。
- 支持用户列表搜索、筛选和分页。
- 支持重置用户密码（用户首次登录时设置新密码）。
- 防止删除/修改/禁用最后一个管理员账户。
- 所有操作需要管理员权限。
