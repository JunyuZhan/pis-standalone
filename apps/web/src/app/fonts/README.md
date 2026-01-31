# 字体文件目录

此目录用于存放本地字体文件，避免构建时依赖 Google Fonts。

## 需要的字体文件

### Inter 字体
- `Inter-Regular.woff2` (400 weight)
- `Inter-SemiBold.woff2` (600 weight)
- `Inter-Bold.woff2` (700 weight)

### Noto Serif SC 字体（中文）
- `NotoSerifSC-Regular.woff2` (400 weight)
- `NotoSerifSC-SemiBold.woff2` (600 weight)
- `NotoSerifSC-Bold.woff2` (700 weight)

### Playfair Display 字体
- `PlayfairDisplay-Regular.woff2` (400 weight)
- `PlayfairDisplay-SemiBold.woff2` (600 weight)
- `PlayfairDisplay-Bold.woff2` (700 weight)

## 下载方式

### 方式 1: 从 Google Fonts 下载（推荐）

1. 访问 https://fonts.google.com/
2. 搜索并选择字体
3. 点击 "Download family" 下载完整字体包
4. 使用字体转换工具（如 https://cloudconvert.com/）将 TTF/OTF 转换为 WOFF2

### 方式 2: 使用 Google Fonts Helper

访问 https://google-webfonts-helper.herokuapp.com/ 下载优化后的字体文件

### 方式 3: 使用脚本下载（需要网络）

```bash
# 安装工具
npm install -g google-fonts-downloader

# 下载字体
google-fonts-downloader "Inter:400,600,700" --output-dir ./fonts
google-fonts-downloader "Noto Serif SC:400,600,700" --output-dir ./fonts
google-fonts-downloader "Playfair Display:400,600,700" --output-dir ./fonts
```

### 方式 4: 手动下载链接

**Inter**:
- Regular: https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2
- SemiBold: https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2
- Bold: https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2

**Noto Serif SC**:
- Regular: https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2
- SemiBold: https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2
- Bold: https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2

**Playfair Display**:
- Regular: https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2
- SemiBold: https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2
- Bold: https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2

## 文件命名规范

确保文件名与 `layout.tsx` 中的路径匹配：
- `Inter-Regular.woff2`
- `Inter-SemiBold.woff2`
- `Inter-Bold.woff2`
- `NotoSerifSC-Regular.woff2`
- `NotoSerifSC-SemiBold.woff2`
- `NotoSerifSC-Bold.woff2`
- `PlayfairDisplay-Regular.woff2`
- `PlayfairDisplay-SemiBold.woff2`
- `PlayfairDisplay-Bold.woff2`

## 验证

下载完成后，运行构建验证：

```bash
cd apps/web
pnpm build
```

如果字体文件缺失，构建会失败并提示文件不存在。

## 临时方案（字体文件缺失时）

如果暂时无法下载字体文件，可以临时使用系统字体：

1. 修改 `layout.tsx` 使用系统字体回退
2. 或使用 `docs/QUICK_FIX.md` 中的系统字体方案
