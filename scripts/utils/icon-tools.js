#!/usr/bin/env node
/**
 * PWA 图标工具集
 * 
 * 功能：
 * 1. 生成 PWA 图标（各种尺寸）
 * 2. 去除图标水印
 * 
 * 使用方法：
 *   # 生成图标
 *   node scripts/icon-tools.js generate
 * 
 *   # 去除水印
 *   node scripts/icon-tools.js remove-watermark [source-png] [options]
 * 
 * 选项：
 *   --crop-x, --crop-y, --crop-width, --crop-height: 裁剪区域（去除边缘水印）
 */

const fs = require('fs');
const path = require('path');

// 从 apps/web 的 node_modules 加载 sharp
const sharp = require(path.join(__dirname, '../apps/web/node_modules/sharp'));

const ICONS_DIR = path.join(__dirname, '../apps/web/public/icons');
const PNG_SOURCE = path.join(ICONS_DIR, 'Gemini_Generated_Image_e28rwze28rwze28r.png');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

// 需要生成的尺寸
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('开始生成 PWA 图标...');

  // 确保图标目录存在
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  let sourceBuffer;
  let sourceType = '';

  // 优先使用 PNG 源文件
  if (fs.existsSync(PNG_SOURCE)) {
    console.log('使用 PNG 源文件:', PNG_SOURCE);
    sourceBuffer = fs.readFileSync(PNG_SOURCE);
    sourceType = 'png';
  } else if (fs.existsSync(SVG_PATH)) {
    console.log('使用 SVG 源文件:', SVG_PATH);
    sourceBuffer = fs.readFileSync(SVG_PATH);
    sourceType = 'svg';
  } else {
    console.error(`错误: 源文件不存在`);
    console.log('请确保以下文件之一存在:');
    console.log(`  - ${PNG_SOURCE}`);
    console.log(`  - ${SVG_PATH}`);
    process.exit(1);
  }

  // 生成各尺寸的 PNG
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    
    await sharp(sourceBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ 生成 ${size}x${size} 图标`);
  }

  // 生成 favicon (32x32)
  const faviconPath = path.join(__dirname, '../apps/web/public/favicon.ico');
  await sharp(sourceBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(faviconPath);
  console.log('✓ 生成 favicon.ico');

  // 如果源文件是 PNG，生成一个 SVG 版本用于某些场景
  if (sourceType === 'png') {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <image href="/icons/Gemini_Generated_Image_e28rwze28rwze28r.png" width="1024" height="1024"/>
</svg>`;
    fs.writeFileSync(SVG_PATH, svgContent);
    console.log('✓ 更新 icon.svg (引用 PNG)');
  }

  // 生成占位图（如果不存在）
  const placeholderPath = path.join(ICONS_DIR, 'placeholder.png');
  if (!fs.existsSync(placeholderPath)) {
    await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 30, g: 30, b: 30, alpha: 1 }
      }
    })
      .png()
      .toFile(placeholderPath);
    console.log('✓ 生成占位图');
  }

  console.log('\n✅ 所有图标生成完成！');
}

async function removeWatermark() {
  const args = process.argv.slice(3);
  const sourceFile = args.find(arg => !arg.startsWith('--')) || path.join(ICONS_DIR, 'icon-512x512.png');

  if (!fs.existsSync(sourceFile)) {
    console.error(`错误: 源文件不存在: ${sourceFile}`);
    console.log('\n可用的PNG文件:');
    if (fs.existsSync(ICONS_DIR)) {
      const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
      files.forEach(f => console.log(`  - ${path.join(ICONS_DIR, f)}`));
    }
    process.exit(1);
  }

  console.log(`正在处理: ${sourceFile}`);
  
  const image = sharp(sourceFile);
  const metadata = await image.metadata();
  console.log(`图像尺寸: ${metadata.width}x${metadata.height}`);

  // 获取裁剪参数
  const cropX = parseInt(args.find(arg => arg.startsWith('--crop-x='))?.split('=')[1] || '0');
  const cropY = parseInt(args.find(arg => arg.startsWith('--crop-y='))?.split('=')[1] || '0');
  const cropWidth = parseInt(args.find(arg => arg.startsWith('--crop-width='))?.split('=')[1] || metadata.width);
  const cropHeight = parseInt(args.find(arg => arg.startsWith('--crop-height='))?.split('=')[1] || metadata.height);

  let processed = image;

  // 如果有裁剪参数，进行裁剪（去除边缘水印）
  if (cropX > 0 || cropY > 0 || cropWidth < metadata.width || cropHeight < metadata.height) {
    console.log(`裁剪区域: x=${cropX}, y=${cropY}, width=${cropWidth}, height=${cropHeight}`);
    processed = processed.extract({
      left: cropX,
      top: cropY,
      width: cropWidth,
      height: cropHeight
    });
  }

  // 生成无水印的PNG
  const outputPng = path.join(ICONS_DIR, 'icon-no-watermark.png');
  await processed.png().toFile(outputPng);
  console.log(`✓ 生成无水印PNG: ${outputPng}`);

  // 生成SVG（通过PNG转SVG，但质量可能不如原始SVG）
  const outputSvg = path.join(ICONS_DIR, 'icon-from-png.svg');
  const svgBuffer = await processed
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  // 将PNG转换为base64嵌入的SVG
  const base64 = svgBuffer.toString('base64');
  const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,${base64}" width="512" height="512"/>
</svg>`;
  
  fs.writeFileSync(outputSvg, svgContent);
  console.log(`✓ 生成SVG: ${outputSvg}`);
  
  console.log('\n提示: 如果水印在边缘，可以使用裁剪参数去除:');
  console.log('  --crop-x=10 --crop-y=10 --crop-width=492 --crop-height=492');
  console.log('\n如果水印在中间，可能需要使用图像编辑软件手动处理。');
}

async function main() {
  const command = process.argv[2];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
PWA 图标工具集

用法:
  node scripts/icon-tools.js <command> [options]

命令:
  generate                   生成 PWA 图标（各种尺寸）
  remove-watermark [file]   去除图标水印

选项 (remove-watermark):
  --crop-x=<number>         裁剪起始 X 坐标
  --crop-y=<number>         裁剪起始 Y 坐标
  --crop-width=<number>     裁剪宽度
  --crop-height=<number>    裁剪高度

示例:
  # 生成图标
  node scripts/icon-tools.js generate

  # 去除水印（使用默认文件）
  node scripts/icon-tools.js remove-watermark

  # 去除水印（指定文件并裁剪）
  node scripts/icon-tools.js remove-watermark icon.png --crop-x=10 --crop-y=10 --crop-width=492 --crop-height=492
`);
    process.exit(0);
  }

  try {
    if (command === 'generate') {
      await generateIcons();
    } else if (command === 'remove-watermark') {
      await removeWatermark();
    } else {
      console.error(`错误: 未知命令 "${command}"`);
      console.log('使用 --help 查看帮助信息');
      process.exit(1);
    }
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
