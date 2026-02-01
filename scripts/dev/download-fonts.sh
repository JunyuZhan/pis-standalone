#!/bin/bash

# ============================================
# 下载字体文件脚本
# 
# 使用 Fontsource CDN 下载字体文件（WOFF2 格式）
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 字体目录
FONT_DIR="apps/web/src/app/fonts"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}下载字体文件${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查目录是否存在
if [ ! -d "$FONT_DIR" ]; then
    echo -e "${YELLOW}创建字体目录: $FONT_DIR${NC}"
    mkdir -p "$FONT_DIR"
fi

cd "$FONT_DIR"

# 检查文件是否为有效的 WOFF2
check_woff2() {
    local file=$1
    if [ -f "$file" ]; then
        local file_type=$(file -b "$file" | head -c 20)
        if [[ "$file_type" == *"Web Open Font Format"* ]] || [[ "$file_type" == *"WOFF"* ]]; then
            return 0  # 有效
        else
            return 1  # 无效
        fi
    else
        return 1  # 不存在
    fi
}

# 下载函数
download_font() {
    local url=$1
    local output=$2
    local name=$3
    
    echo -e "${BLUE}下载 $name...${NC}"
    if curl -L -f -o "$output" "$url" 2>/dev/null; then
        if check_woff2 "$output"; then
            echo -e "${GREEN}✓ $name 下载成功${NC}"
            return 0
        else
            echo -e "${RED}✗ $name 下载的文件格式不正确${NC}"
            rm -f "$output"
            return 1
        fi
    else
        echo -e "${RED}✗ $name 下载失败${NC}"
        return 1
    fi
}

# Inter 字体（使用 Fontsource CDN）
echo -e "${BLUE}下载 Inter 字体...${NC}"
if ! check_woff2 "Inter-Regular.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-400-normal.woff2" "Inter-Regular.woff2" "Inter-Regular"
fi
if ! check_woff2 "Inter-SemiBold.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-600-normal.woff2" "Inter-SemiBold.woff2" "Inter-SemiBold"
fi
if ! check_woff2 "Inter-Bold.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-700-normal.woff2" "Inter-Bold.woff2" "Inter-Bold"
fi

# NotoSerifSC 字体（使用 Fontsource CDN）
echo -e "${BLUE}下载 NotoSerifSC 字体...${NC}"
if ! check_woff2 "NotoSerifSC-Regular.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.0/files/noto-serif-sc-chinese-simplified-400-normal.woff2" "NotoSerifSC-Regular.woff2" "NotoSerifSC-Regular"
fi
if ! check_woff2 "NotoSerifSC-SemiBold.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.0/files/noto-serif-sc-chinese-simplified-600-normal.woff2" "NotoSerifSC-SemiBold.woff2" "NotoSerifSC-SemiBold"
fi
if ! check_woff2 "NotoSerifSC-Bold.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.0/files/noto-serif-sc-chinese-simplified-700-normal.woff2" "NotoSerifSC-Bold.woff2" "NotoSerifSC-Bold"
fi

# PlayfairDisplay 字体（使用 Fontsource CDN）
echo -e "${BLUE}下载 PlayfairDisplay 字体...${NC}"
if ! check_woff2 "PlayfairDisplay-Regular.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.0/files/playfair-display-latin-400-normal.woff2" "PlayfairDisplay-Regular.woff2" "PlayfairDisplay-Regular"
fi
if ! check_woff2 "PlayfairDisplay-SemiBold.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.0/files/playfair-display-latin-600-normal.woff2" "PlayfairDisplay-SemiBold.woff2" "PlayfairDisplay-SemiBold"
fi
if ! check_woff2 "PlayfairDisplay-Bold.woff2"; then
    download_font "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.0/files/playfair-display-latin-700-normal.woff2" "PlayfairDisplay-Bold.woff2" "PlayfairDisplay-Bold"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}字体文件下载完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 验证所有文件
echo -e "${BLUE}验证字体文件...${NC}"
all_valid=true
for font in Inter-Regular.woff2 Inter-SemiBold.woff2 Inter-Bold.woff2 \
           NotoSerifSC-Regular.woff2 NotoSerifSC-SemiBold.woff2 NotoSerifSC-Bold.woff2 \
           PlayfairDisplay-Regular.woff2 PlayfairDisplay-SemiBold.woff2 PlayfairDisplay-Bold.woff2; do
    if check_woff2 "$font"; then
        echo -e "${GREEN}✓ $font${NC}"
    else
        echo -e "${RED}✗ $font (无效或缺失)${NC}"
        all_valid=false
    fi
done

if [ "$all_valid" = false ]; then
    echo ""
    echo -e "${YELLOW}部分字体文件下载失败，请手动下载：${NC}"
    echo -e "  1. 访问 https://fonts.google.com/"
    echo -e "  2. 搜索字体名称并下载"
    echo -e "  3. 使用工具转换为 WOFF2 格式"
    echo -e "  4. 放置到 $FONT_DIR 目录"
    exit 1
fi
