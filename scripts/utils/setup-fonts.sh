#!/bin/bash
set -e

FONTS_DIR="apps/web/src/app/fonts"
cd "$(dirname "$0")/.."
FONTS_DIR_FULL="$(pwd)/$FONTS_DIR"

echo "PIS 字体文件自动设置"
echo "===================="
echo "目标目录: $FONTS_DIR_FULL"
echo ""

mkdir -p "$FONTS_DIR_FULL"

if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    echo "错误: 需要 curl 或 wget"
    exit 1
fi

download() {
    local filename=$1
    local url=$2
    if [ -f "$FONTS_DIR_FULL/$filename" ]; then
        echo "已存在: $filename"
        return 0
    fi
    echo "下载: $filename..."
    if command -v curl &> /dev/null; then
        curl -L -o "$FONTS_DIR_FULL/$filename" "$url" 2>/dev/null && echo "成功" || echo "失败"
    else
        wget -q -O "$FONTS_DIR_FULL/$filename" "$url" 2>&1 && echo "成功" || echo "失败"
    fi
}

echo "注意: URL 可能需要更新，建议手动下载"
echo "访问: https://google-webfonts-helper.herokuapp.com/"
echo ""

download "Inter-Regular.woff2" "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" || true
download "Inter-SemiBold.woff2" "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" || true
download "Inter-Bold.woff2" "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" || true

download "NotoSerifSC-Regular.woff2" "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" || true
download "NotoSerifSC-SemiBold.woff2" "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" || true
download "NotoSerifSC-Bold.woff2" "https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.woff2" || true

download "PlayfairDisplay-Regular.woff2" "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" || true
download "PlayfairDisplay-SemiBold.woff2" "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" || true
download "PlayfairDisplay-Bold.woff2" "https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2" || true

echo ""
echo "检查完成"
missing=0
for f in Inter-Regular.woff2 Inter-SemiBold.woff2 Inter-Bold.woff2 NotoSerifSC-Regular.woff2 NotoSerifSC-SemiBold.woff2 NotoSerifSC-Bold.woff2 PlayfairDisplay-Regular.woff2 PlayfairDisplay-SemiBold.woff2 PlayfairDisplay-Bold.woff2; do
    [ ! -f "$FONTS_DIR_FULL/$f" ] && echo "缺失: $f" && missing=1
done
[ $missing -eq 0 ] && echo "所有字体文件已就绪！" || echo "请手动下载到: $FONTS_DIR_FULL"
