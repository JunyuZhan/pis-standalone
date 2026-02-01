# 字体配置指南

> 最后更新: 2026-01-31

## 🎨 设计字体

PIS 使用以下设计字体：
- **Inter** - 无衬线字体（英文、数字）
- **Noto Serif SC** - 衬线字体（中文）
- **Playfair Display** - 装饰字体（标题）

---

## ✅ 快速设置（推荐）

### 一键设置字体文件

```bash
bash scripts/setup-fonts.sh
```

这个脚本会：
1. ✅ 自动检查网络连接
2. ✅ 自动下载所有需要的字体文件
3. ✅ 将字体文件放到正确的位置（`apps/web/src/app/fonts/`）
4. ✅ 验证文件是否完整

---

## 📁 字体文件位置

**正确位置**: `apps/web/src/app/fonts/`

**需要的字体文件**（9 个文件）：
```
apps/web/src/app/fonts/
├── Inter-Regular.woff2
├── Inter-SemiBold.woff2
├── Inter-Bold.woff2
├── NotoSerifSC-Regular.woff2
├── NotoSerifSC-SemiBold.woff2
├── NotoSerifSC-Bold.woff2
├── PlayfairDisplay-Regular.woff2
├── PlayfairDisplay-SemiBold.woff2
└── PlayfairDisplay-Bold.woff2
```

---

## 🔧 手动下载方式

如果自动脚本失败，可以手动下载：

1. **访问字体下载网站**：
   - https://google-webfonts-helper.herokuapp.com/

2. **下载字体**（每个字体需要 3 个权重：400, 600, 700，格式：woff2）：
   - Inter
   - Noto Serif SC
   - Playfair Display

3. **重命名并放置文件**：
   ```bash
   mkdir -p apps/web/src/app/fonts
   # 将下载的文件重命名并放到 fonts 目录
   ```

---

## 🚨 故障排查

### 问题 1: 构建时找不到字体文件

**错误信息**：
```
Error: Cannot find module './fonts/Inter-Regular.woff2'
```

**解决方案**：
1. 检查字体文件是否存在：`ls apps/web/src/app/fonts/`
2. 如果文件不存在，运行：`bash scripts/setup-fonts.sh`
3. 如果脚本失败，手动下载字体文件（见上方手动下载方式）

### 问题 2: 字体文件解码错误

**错误信息**：
- `Failed to decode downloaded font` - 字体文件无法解码，通常是文件损坏或格式不正确
- `OTS parsing error: invalid sfntVersion` - OpenType Sanitizer 无法解析字体文件，文件格式无效

**解决方案**：
1. **重新下载字体文件**（推荐）：
   ```bash
   bash scripts/setup-fonts.sh
   ```

2. **验证字体文件大小**：
   ```bash
   ls -lh apps/web/src/app/fonts/*.woff2
   ```
   如果文件小于 5KB，说明文件损坏，需要重新下载。

3. **手动下载**（如果脚本失败）：
   - 访问 https://google-webfonts-helper.herokuapp.com/
   - 下载以下字体（每个字体需要 3 个权重：400, 600, 700，格式：woff2）：
     - **Inter** - 选择 "latin" subset
     - **Noto Serif SC** - 选择 "chinese-simplified" subset
     - **Playfair Display** - 选择 "latin" subset
   - 将文件放到 `apps/web/src/app/fonts/` 目录

### 问题 3: 服务器没有网络访问

**解决方案**：
1. **在本地下载字体文件**：
   ```bash
   # 在本地机器运行
   bash scripts/setup-fonts.sh
   ```

2. **上传字体文件到服务器**：
   ```bash
   # 使用 scp 上传
   scp -r apps/web/src/app/fonts/ user@server:/path/to/pis-standalone/apps/web/src/app/
   ```

3. **或使用系统字体**（临时方案）：
   - 应用会自动使用 fallback 字体：
     - **Inter** → 系统无衬线字体（-apple-system, BlinkMacSystemFont, Segoe UI, Roboto）
     - **Noto Serif SC** → 系统中文字体（PingFang SC, Hiragino Sans GB, Microsoft YaHei）
     - **Playfair Display** → 系统衬线字体（Georgia, Times New Roman）
   - 注意：使用系统字体会影响视觉效果，但不会影响功能

### 问题 4: 字体文件下载失败

**可能原因**：
- 网络连接问题
- 字体下载网站不可用
- 防火墙阻止访问

**解决方案**：
1. 检查网络连接：`curl -I https://google-webfonts-helper.herokuapp.com/`
2. 使用代理（如果可用）
3. 手动下载字体文件（见上方手动下载方式）

### 问题 5: 浏览器扩展错误（可忽略）

**错误信息**：
- `Could not establish connection. Receiving end does not exist`

**说明**：这是浏览器扩展相关的错误，**不是应用本身的问题**，可以忽略。

---

## 📝 字体文件大小参考

- **Inter**: ~20-30KB 每个文件
- **Noto Serif SC**: ~100-200KB 每个文件（中文字体较大）
- **Playfair Display**: ~20-30KB 每个文件
- **总大小**: 约 1-2 MB（9 个文件）

## 🔄 修复后重新构建

修复字体文件后，需要重新构建应用：

```bash
# 本地开发
cd apps/web
pnpm build

# Docker 部署
cd docker
docker compose -f docker-compose.standalone.yml build --no-cache web
docker compose -f docker-compose.standalone.yml up -d web
```

## 💡 其他提示

- **浏览器缓存**: 如果修复后仍有问题，清除浏览器缓存或使用硬刷新（Ctrl+Shift+R / Cmd+Shift+R）
- **字体文件大小验证**: 正常字体文件应该 > 5KB，如果小于 5KB 说明文件损坏

---

## 🔗 相关文档

- [开发指南](./DEVELOPMENT.md) - 开发环境设置
- [部署指南](./i18n/zh-CN/DEPLOYMENT.md) - 生产环境部署

---

## 💡 提示

- 字体文件可以添加到 Git（约 1-2 MB），也可以不添加（使用 `.gitignore`）
- 如果使用 Git，建议使用 Git LFS 管理字体文件
- 生产环境部署时，确保字体文件已下载或使用系统字体
