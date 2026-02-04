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

---

## 🗓️ 第四阶段：AI 智能 - 人脸识别（优先级：低/未来）
**目标**：允许访客通过上传自拍找到自己的照片。

### 4.1 向量数据库
- [ ] **基础设施**: 在 PostgreSQL 中启用 `pgvector` 扩展。
- [ ] **Schema**: 创建 `face_embeddings` 表 (photo_id, embedding_vector, face_location)。

### 4.2 人脸服务 (新建 `services/ai`)
- [ ] **搭建**: 使用 FastAPI + InsightFace 创建 Python 服务。
- [ ] **API**:
  - `POST /extract`: 从图片提取人脸 -> 返回向量。
  - `POST /search`: 在数据库中搜索向量。

### 4.3 Worker 集成
- [ ] **流程**: 照片处理完成后，发送缩略图给 人脸服务。
- [ ] **存储**: 将返回的向量保存到数据库。

### 4.4 用户界面 (`apps/web`)
- [ ] **C 端**: 在相册页添加“找我”按钮。
- [ ] **交互**: 上传自拍 -> 裁剪人脸 -> 搜索 API -> 显示匹配结果。

---

## 🛠 系统优化（已完成/进行中）
