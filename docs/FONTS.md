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

### 问题 2: 服务器没有网络访问

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
   - 修改 `apps/web/src/app/layout.tsx`
   - 使用系统字体替代本地字体文件
   - 详见开发文档

### 问题 3: 字体文件下载失败

**可能原因**：
- 网络连接问题
- 字体下载网站不可用
- 防火墙阻止访问

**解决方案**：
1. 检查网络连接：`curl -I https://google-webfonts-helper.herokuapp.com/`
2. 使用代理（如果可用）
3. 手动下载字体文件（见上方手动下载方式）

---

## 📝 字体文件大小

- **单个字体文件**: 约 50-200 KB
- **总大小**: 约 1-2 MB（9 个文件）

---

## 🔗 相关文档

- [开发指南](./DEVELOPMENT.md) - 开发环境设置
- [部署指南](./i18n/zh-CN/DEPLOYMENT.md) - 生产环境部署

---

## 💡 提示

- 字体文件可以添加到 Git（约 1-2 MB），也可以不添加（使用 `.gitignore`）
- 如果使用 Git，建议使用 Git LFS 管理字体文件
- 生产环境部署时，确保字体文件已下载或使用系统字体
