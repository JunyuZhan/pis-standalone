#!/bin/bash

# PIS 构建问题修复脚本
# 解决 Google Fonts SSL 证书问题

set -e

echo "🔧 PIS 构建问题修复脚本"
echo "=========================="
echo ""

# 检查当前问题
echo "📋 检查构建问题..."
if pnpm build --filter=@pis/web 2>&1 | grep -q "unable to get local issuer certificate"; then
    echo "✅ 检测到 SSL 证书问题"
    echo ""
    echo "解决方案："
    echo "1. 临时方案：跳过 SSL 验证（仅用于构建）"
    echo "2. 推荐方案：使用本地字体文件"
    echo ""
    read -p "选择方案 (1=临时, 2=推荐) [默认: 1]: " choice
    choice=${choice:-1}
    
    if [ "$choice" = "1" ]; then
        echo ""
        echo "🚀 使用临时方案：跳过 SSL 验证"
        echo "⚠️  注意：这仅用于构建，不影响运行时"
        echo ""
        export NODE_TLS_REJECT_UNAUTHORIZED=0
        echo "✅ 环境变量已设置"
        echo ""
        echo "现在可以运行构建："
        echo "  pnpm build"
        echo ""
        echo "或直接运行："
        echo "  NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm build"
    elif [ "$choice" = "2" ]; then
        echo ""
        echo "🚀 使用推荐方案：本地字体文件"
        echo ""
        echo "需要手动执行以下步骤："
        echo ""
        echo "1. 下载字体文件到 apps/web/public/fonts/"
        echo "2. 修改 apps/web/src/app/layout.tsx 使用 localFont"
        echo ""
        echo "详细步骤请查看：docs/BUILD_FIX_GUIDE.md"
        echo ""
    else
        echo "❌ 无效选择"
        exit 1
    fi
else
    echo "✅ 未检测到 SSL 证书问题"
    echo "构建应该可以正常进行"
fi
