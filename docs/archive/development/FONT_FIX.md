# 字体文件修复指南

> 最后更新: 2026-01-31

## 🚨 问题：字体文件损坏

如果遇到以下错误：
- `Failed to decode downloaded font`
- `OTS parsing error: invalid sfntVersion`

这通常表示字体文件损坏或格式不正确。

---

## ✅ 解决方案

### 方法 1：重新下载字体文件（推荐）

```bash
# 删除损坏的字体文件
rm apps/web/src/app/fonts/NotoSerifSC-Regular.woff2
rm apps/web/src/app/fonts/NotoSerifSC-SemiBold.woff2
rm apps/web/src/app/fonts/NotoSerifSC-Bold.woff2
rm apps/web/src/app/fonts/PlayfairDisplay-Regular.woff2
rm apps/web/src/app/fonts/PlayfairDisplay-SemiBold.woff2
rm apps/web/src/app/fonts/PlayfairDisplay-Bold.woff2

# 重新运行字体设置脚本
bash scripts/setup-fonts.sh
```

### 方法 2：手动下载（如果脚本失败）

1. **访问 Google Fonts Helper**：
   - https://google-webfonts-helper.herokuapp.com/

2. **下载字体**：
   - **Inter**: 选择 "Inter"，权重选择 400, 600, 700，格式选择 "woff2"
   - **Noto Serif SC**: 选择 "Noto Serif SC"，权重选择 400, 600, 700，格式选择 "woff2"
   - **Playfair Display**: 选择 "Playfair Display"，权重选择 400, 600, 700，格式选择 "woff2"

3. **放置文件**：
   ```bash
   # 确保目录存在
   mkdir -p apps/web/src/app/fonts
   
   # 将下载的文件重命名并放置到正确位置
   # Inter-Regular.woff2
   # Inter-SemiBold.woff2
   # Inter-Bold.woff2
   # NotoSerifSC-Regular.woff2
   # NotoSerifSC-SemiBold.woff2
   # NotoSerifSC-Bold.woff2
   # PlayfairDisplay-Regular.woff2
   # PlayfairDisplay-SemiBold.woff2
   # PlayfairDisplay-Bold.woff2
   ```

### 方法 3：验证字体文件

```bash
# 检查文件类型（应该是 WOFF2 字体文件）
file apps/web/src/app/fonts/*.woff2

# 应该显示类似：
# Inter-Regular.woff2: Web Open Font Format version 2.0
# NotoSerifSC-Regular.woff2: Web Open Font Format version 2.0
# PlayfairDisplay-Regular.woff2: Web Open Font Format version 2.0

# 如果显示 "ASCII text" 或 "HTML document"，说明文件损坏
```

---

## 🔍 验证修复

修复后，重新构建项目：

```bash
cd apps/web
pnpm build
```

如果构建成功，字体文件已修复。

---

## 📝 临时方案（如果无法下载字体）

如果暂时无法下载字体文件，可以临时使用系统字体：

修改 `apps/web/src/app/layout.tsx`，注释掉字体加载，使用系统字体回退：

```typescript
// 临时使用系统字体（如果字体文件损坏）
// const inter = localFont({ ... })
// const notoSerifSC = localFont({ ... })
// const playfairDisplay = localFont({ ... })

// 使用系统字体
const inter = { variable: '', className: '' }
const notoSerifSC = { variable: '', className: '' }
const playfairDisplay = { variable: '', className: '' }
```

---

## 🎯 预防措施

1. **使用正确的下载源**：使用 Google Fonts Helper 或官方源
2. **验证文件完整性**：下载后检查文件类型
3. **版本控制**：将字体文件添加到 Git（如果项目允许）

---

## 📚 相关文档

- [字体配置指南](./FONTS.md) - 完整的字体配置说明
- [故障排查](./README.md) - 其他故障排查指南
