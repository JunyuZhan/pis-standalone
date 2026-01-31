#!/bin/bash

# 下载 Google Fonts 字体文件脚本
# 用于长期方案：使用本地字体文件

set -e

FONTS_DIR="apps/web/src/app/fonts"

echo "📥 下载字体文件到本地"
echo "======================"
echo ""

# 创建字体目录
mkdir -p "$FONTS_DIR"

# 检查是否有 wget 或 curl
if command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget"
elif command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl"
else
    echo "❌ 错误：需要 wget 或 curl 来下载文件"
    echo "请手动下载字体文件，或安装 wget/curl"
    exit 1
fi

echo "使用工具: $DOWNLOAD_CMD"
echo ""

# 下载函数
download_font() {
    local url=$1
    local filename=$2
    
    if [ "$DOWNLOAD_CMD" = "wget" ]; then
        wget -q --show-progress -O "$FONTS_DIR/$filename" "$url" || {
            echo "⚠️  下载失败: $filename"
            echo "   请手动下载: $url"
            return 1
        }
    else
        curl -L --progress-bar -o "$FONTS_DIR/$filename" "$url" || {
            echo "⚠️  下载失败: $filename"
            echo "   请手动下载: $url"
            return 1
        }
    fi
    echo "✅ 已下载: $filename"
}

echo "📥 开始下载字体文件..."
echo ""

# Inter 字体
echo "下载 Inter 字体..."
# 注意：这些是示例 URL，实际 URL 可能不同
# 建议从 Google Fonts 网站获取最新 URL
download_font "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" "Inter-Regular.woff2" || true
download_font "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" "Inter-SemiBold.woff2" || true
download_font "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" "Inter-Bold.woff2" || true

# Noto Serif SC 字体
echo ""
echo "下载 Noto Serif SC 字体..."
download_font "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" "NotoSerifSC-Regular.woff2" || true
download_font "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" "NotoSerifSC-SemiBold.woff2" || true
download_font "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" "NotoSerifSC-Bold.woff2" || true

# Playfair Display 字体
echo ""
echo "下载 Playfair Display 字体..."
download_font "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" "PlayfairDisplay-Regular.woff2" || true
download_font "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" "PlayfairDisplay-SemiBold.woff2" || true
download_font "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" "PlayfairDisplay-Bold.woff2" || true

echo ""
echo "=========================="
echo "📋 下载完成"
echo ""
echo "⚠️  注意：上述 URL 可能不是最新的或正确的"
echo "   建议手动从以下网站下载："
echo ""
echo "   1. https://fonts.google.com/"
echo "   2. https://google-webfonts-helper.herokuapp.com/"
echo ""
echo "   详细说明请查看: apps/web/public/fonts/README.md"
echo ""
echo "✅ 字体文件应放在: $FONTS_DIR"
echo ""
echo "注意：字体文件现在应放在 src/app/fonts/ 而不是 public/fonts/"
echo "这是 Next.js localFont 的要求（路径相对于源文件）"
echo ""
