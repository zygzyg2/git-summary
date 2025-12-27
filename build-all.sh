#!/bin/bash

# Git Summary 多平台打包脚本
# 支持打包 Linux、Windows、macOS 三个平台

set -e

echo "=========================================="
echo "  Git Summary 多平台打包脚本"
echo "=========================================="

# 进入项目目录
cd "$(dirname "$0")"

# 从 package.json 读取版本号
VERSION=$(node -p "require('./package.json').version")
echo "版本号: $VERSION"

# 清理旧的构建文件
echo ""
echo "[1/4] 清理旧的构建文件..."
rm -rf release/
rm -rf dist/

# 构建前端资源
echo ""
echo "[2/4] 构建前端资源..."
npm run build

# 打包 Linux
echo ""
echo "[3/4] 打包 Linux (AppImage)..."
npx electron-builder --linux 2>&1 || echo "⚠️  Linux 打包出现问题"

# 打包 macOS
echo ""
echo "[4/4] 打包 macOS (zip)..."
npx electron-builder --mac 2>&1 || echo "⚠️  macOS 打包出现问题"

# 打包 Windows (需要 Wine)
echo ""
echo "[5/5] 打包 Windows..."
if command -v wine &> /dev/null; then
    npx electron-builder --win 2>&1 || echo "⚠️  Windows 打包出现问题"
else
    echo "⚠️  Wine 未安装，手动打包 Windows zip..."
    if [ -d "release/win-unpacked" ]; then
        cd release
        zip -r "GitSummary-${VERSION}-win-x64.zip" win-unpacked/
        cd ..
        echo "✅ Windows zip 打包完成"
    else
        echo "❌ win-unpacked 目录不存在，尝试生成..."
        npx electron-builder --win --dir 2>&1 || true
        if [ -d "release/win-unpacked" ]; then
            cd release
            zip -r "GitSummary-${VERSION}-win-x64.zip" win-unpacked/
            cd ..
            echo "✅ Windows zip 打包完成"
        else
            echo "❌ Windows 打包失败，请安装 Wine 后重试"
        fi
    fi
fi

# 显示结果
echo ""
echo "=========================================="
echo "  打包完成！"
echo "=========================================="
echo ""
echo "生成的安装包："
ls -lh release/*.AppImage release/*.zip 2>/dev/null || echo "没有找到打包文件"
echo ""
echo "文件位置: $(pwd)/release/"
