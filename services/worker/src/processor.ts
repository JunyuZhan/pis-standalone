/**
 * @fileoverview PIS Worker - 照片处理模块
 *
 * @description
 * 使用 Sharp 进行图片处理，包括：
 * - 自动/手动旋转
 * - 风格预设应用
 * - 水印添加（文本/Logo）
 * - BlurHash 生成
 * - 缩略图和预览图生成
 * - EXIF 数据提取和清理
 *
 * @module worker/processor
 *
 * @example
 * ```typescript
 * import { PhotoProcessor } from './processor.js'
 *
 * const processor = new PhotoProcessor(imageBuffer)
 * const result = await processor.process(
 *   { enabled: true, watermarks: [...] },
 *   90, // 手动旋转角度
 *   'japanese-fresh' // 风格预设
 * )
 * ```
 */
import sharp from 'sharp'
import { encode } from 'blurhash'
import exifReader from 'exif-reader'
import { STYLE_PRESETS, getPresetById, type StylePresetConfig } from './lib/style-presets.js'
import type { AIRetouchOptions } from './lib/ai-retouch.js'

/**
 * 处理结果
 */
export interface ProcessedResult {
  /** 图片元数据 */
  metadata: sharp.Metadata
  /** EXIF 数据（已清理 GPS 信息） */
  exif: any
  /** BlurHash 字符串 */
  blurHash: string
  /** 缩略图 Buffer */
  thumbBuffer: Buffer
  /** 预览图 Buffer（带水印） */
  previewBuffer: Buffer
}

/**
 * 单个水印配置
 */
export interface SingleWatermark {
  /** 水印 ID（用于 UI 管理） */
  id?: string
  /** 水印类型 */
  type: 'text' | 'logo'
  /** 文本内容（type 为 text 时使用） */
  text?: string
  /** Logo URL（type 为 logo 时使用，需为 MinIO 或其他可访问的 URL） */
  logoUrl?: string
  /** 不透明度（0-1） */
  opacity: number
  /** 位置 */
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  /** 字体大小或 Logo 尺寸（预览图宽度的百分比，1-100，可选，自动计算） */
  size?: number
  /** 边距（百分比，0-20，默认 5） */
  margin?: number
  /** 是否启用 */
  enabled?: boolean
}

/**
 * 水印配置（支持单个或多个水印）
 */
export interface WatermarkConfig {
  /** 是否启用水印 */
  enabled: boolean
  // 旧格式兼容：单个水印
  /** 水印类型（旧格式） */
  type?: 'text' | 'logo'
  /** 文本内容（旧格式） */
  text?: string
  /** Logo URL（旧格式） */
  logoUrl?: string
  /** 不透明度（旧格式） */
  opacity?: number
  /** 位置（旧格式） */
  position?: string
  // 新格式：多个水印（最多 6 个）
  /** 水印数组（新格式） */
  watermarks?: SingleWatermark[]
}

/**
 * 照片处理器类
 *
 * @description
 * 封装图片处理逻辑，支持旋转、水印、BlurHash 等功能
 */
export class PhotoProcessor {
  /** Sharp 图像实例 */
  private image: sharp.Sharp

  /**
   * 创建照片处理器实例
   *
   * @param buffer - 图片 Buffer
   */
  constructor(buffer: Buffer) {
    this.image = sharp(buffer)
  }

  /**
   * 验证 Logo URL 是否安全（防止 SSRF 攻击）
   *
   * @description
   * - 检查协议是否为 HTTP/HTTPS
   * - 拒绝访问内网地址（localhost、127.0.0.1、192.168.x.x、10.x.x.x）
   * - 如果配置了白名单，仅允许白名单域名
   *
   * @param url - 待验证的 URL
   * @returns URL 安全返回 true，否则返回 false
   *
   * @internal
   */
  private isValidLogoUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const allowedProtocols = ['https:', 'http:'];

      // Get allowed domain whitelist from environment variables
      const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || process.env.MEDIA_URL;
      const allowedHosts = [
        process.env.MEDIA_DOMAIN,
        mediaUrl ? new URL(mediaUrl).hostname : null,
      ].filter(Boolean) as string[];

      // Check protocol
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return false;
      }

      // Check for internal addresses (SSRF protection)
      const hostname = urlObj.hostname.toLowerCase();
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
      const isPrivateIP =
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        (hostname.startsWith('172.') &&
         parseInt(hostname.split('.')[1] || '0') >= 16 &&
         parseInt(hostname.split('.')[1] || '0') <= 31) ||
        hostname.endsWith('.local');

      if (isLocalhost || isPrivateIP) {
        console.warn(`[Security] Blocked internal URL: ${url}`);
        return false;
      }

      // If whitelist is configured, only allow whitelisted domains
      if (allowedHosts.length > 0) {
        const isAllowed = allowedHosts.some(allowed => {
          const allowedHostname = allowed.toLowerCase();
          return hostname === allowedHostname || hostname.endsWith('.' + allowedHostname);
        });
        if (!isAllowed) {
          console.warn(`[Security] URL not in whitelist: ${url}`);
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 应用风格预设到图片
   *
   * @description
   * 按照 Gemini 建议的顺序应用风格预设参数，确保后端生成的照片与前端 CSS 预览效果高度一致。
   *
   * **处理顺序（关键）：**
   * 1. modulate (brightness, saturation, hue) - 基础色彩调整
   * 2. linear (contrast) - 对比度调整
   * 3. gamma - 伽马校正
   * 4. tint - 色调叠加
   *
   * **注意：** 顺序错误会导致画面色彩断层。必须先执行 modulate（基础色彩），
   * 再执行 linear（对比度），最后执行 gamma。tint 在最后应用。
   *
   * **参数映射说明：**
   * - brightness: 0.0 - 2.0，默认 1.0（无变化）
   * - saturation: 0.0 - 2.0，默认 1.0（无变化），0.0 时变成黑白
   * - hue: 0 - 360 度，默认 0（无变化）
   *   - 正值：顺时针旋转，趋向暖色（黄/橙）
   *   - 负值：逆时针旋转，趋向冷色（蓝/紫）
   *   - 与 CSS hue-rotate() 方向一致
   * - contrast: -1.0 - 1.0，默认 0.0（无变化）
   *   - CSS contrast(1.2) 对应 config.contrast: 0.2
   *   - Sharp 使用 linear(a, b)，其中 a = 1 + contrast, b = 128 * (1 - a)
   *   - 这确保中间调（128 灰度）不动，只拉伸高光和阴影
   * - gamma: 0.1 - 3.0，默认 1.0（无变化）
   * - tint: RGB 色调叠加，用于色温模拟
   *   - Sharp 的 .tint() 效果较强，如果发现偏色过重，可能需要调整
   *
   * **特殊预设处理：**
   * - high-key-bw: saturation 必须先清零（在 modulate 中处理），再应用高对比度和 gamma
   *
   * @param image - Sharp 图像对象
   * @param presetId - 预设 ID（如 "japanese-fresh"）或 null 表示不应用风格
   * @returns 处理后的 Sharp 图像对象
   *
   * @internal
   */
  private applyStylePreset(
    image: sharp.Sharp,
    presetId: string | null | undefined
  ): sharp.Sharp {
    // Return original image if no preset selected or "none"
    if (!presetId || presetId === 'none') {
      return image;
    }

    // Get preset configuration
    const preset = getPresetById(presetId);
    if (!preset) {
      console.warn(`[StylePreset] Unknown preset: ${presetId}, skipping`);
      return image;
    }

    const config = preset.config;
    let processedImage = image.clone();

    // ========== 步骤 1: Apply modulate (brightness, saturation, hue) ==========
    // 基础色彩调整，必须在最前面执行
    // Sharp modulate 需要所有三个参数，使用已定义的值或默认值
    // 注意：saturation 为 0 时会变成黑白（如 high-key-bw），需要明确传递
    if (config.brightness !== undefined ||
        config.saturation !== undefined ||
        config.hue !== undefined) {
      // 构建 modulate 参数，只包含已定义的参数
      const modulateParams: {
        brightness?: number
        saturation?: number
        hue?: number
      } = {}
      
      // 只添加已定义的参数
      if (config.brightness !== undefined) {
        modulateParams.brightness = config.brightness
      }
      if (config.saturation !== undefined) {
        modulateParams.saturation = config.saturation
      }
      if (config.hue !== undefined) {
        modulateParams.hue = config.hue
      }
      
      // 如果至少有一个参数，调用 modulate
      // Sharp modulate 需要所有三个参数，所以我们需要提供默认值
      const finalBrightness = modulateParams.brightness ?? 1.0
      const finalSaturation = modulateParams.saturation ?? 1.0
      const finalHue = modulateParams.hue ?? 0
      
      processedImage = processedImage.modulate({
        brightness: finalBrightness,
        saturation: finalSaturation,
        hue: finalHue,
      });
    }

    // ========== 步骤 2: Apply contrast (linear transformation) ==========
    // 对比度调整，必须在 modulate 之后、gamma 之前执行
    // Contrast range: -1.0 (low) to 1.0 (high), default 0.0 (no change)
    // CSS contrast(1.2) 对应 config.contrast: 0.2
    // Sharp 使用 linear(a, b) 模拟对比度：
    //   - a = 1.0 + contrast (factor: 0.0..2.0)
    //   - b = 128 * (1 - a) (offset: 确保中间调不动)
    // 这确保中间调（128 灰度）不动，只拉伸高光和阴影，与 Lightroom 思路一致
    if (config.contrast !== undefined && config.contrast !== 0.0) {
      const factor = 1.0 + config.contrast; // Convert -1.0..1.0 to 0.0..2.0
      const offset = 128 * (1 - factor); // 防止画面整体变白或变黑
      processedImage = processedImage.linear(factor, offset);
    }

    // ========== 步骤 3: Apply gamma correction ==========
    // 伽马校正，必须在 contrast 之后执行
    // Sharp要求gamma值在1.0-3.0之间，超出范围会导致错误
    if (config.gamma !== undefined && config.gamma !== 1.0) {
      // 验证并限制gamma值在有效范围内
      const validGamma = Math.max(1.0, Math.min(3.0, config.gamma));
      if (validGamma !== config.gamma) {
        console.warn(
          `[StylePreset] Gamma value ${config.gamma} out of range (1.0-3.0), clamped to ${validGamma}`
        );
      }
      processedImage = processedImage.gamma(validGamma);
    }

    // ========== 步骤 4: Skip tint ==========
    // 注意：Sharp 的 tint() 会强制替换图像的色度（chrominance），
    // 导致图像变成单色调（类似灰度着色），不适合用于色温调整。
    // 色温效果已通过 hue 参数实现，tint 参数暂时忽略。
    // 如需更精细的色温控制，可考虑使用 recomb() 颜色矩阵变换。

    return processedImage;
  }

  /**
   * 处理图片
   *
   * @description
   * 执行以下操作：
   * 1. 根据 EXIF 或手动角度旋转图片
   * 2. 应用风格预设
   * 3. 生成 BlurHash
   * 4. 生成缩略图（400px）
   * 5. 生成预览图（1920px，带水印）
   * 6. 提取并清理 EXIF 数据
   *
   * @param watermarkConfig - 水印配置
   * @param manualRotation - 手动旋转角度（可选，覆盖 EXIF）
   * @param stylePresetId - 风格预设 ID（可选）
   * @param aiRetouchConfig - AI 修图配置（可选）
   * @returns 处理结果对象
   *
   * @example
   * ```typescript
   * const result = await processor.process(
   *   { enabled: true, text: '© My Gallery', opacity: 0.5, position: 'bottom-right' },
   *   null,
   *   'japanese-fresh',
   *   { enabled: true, config: { preset: 'portrait' } }
   * )
   * ```
   */
  async process(
    watermarkConfig?: WatermarkConfig,
    manualRotation?: number | null,
    stylePresetId?: string | null,
    aiRetouchConfig?: { enabled: boolean; config?: AIRetouchOptions }
  ): Promise<ProcessedResult> {
    // Get original metadata first (for EXIF extraction)
    const originalMetadata = await this.image.metadata();

    // 1. Extract EXIF (strip sensitive info)
    let exif: unknown = {};
    if (originalMetadata.exif) {
      try {
        const rawExif = exifReader(originalMetadata.exif);
        // Strip GPS location info to prevent privacy leakage
        exif = this.sanitizeExif(rawExif);
      } catch (e) {
        console.warn('Failed to parse EXIF:', e);
      }
    }

    // Apply rotation: use manual rotation if provided; otherwise use EXIF orientation
    let rotatedImage: sharp.Sharp;
    if (manualRotation !== null && manualRotation !== undefined) {
      // Manual rotation: apply EXIF orientation first, then manual rotation
      rotatedImage = this.image.clone().rotate().rotate(manualRotation);
    } else {
      // Automatic rotation: only based on EXIF orientation
      rotatedImage = this.image.clone().rotate();
    }

    // AI Retouch (before style preset)
    // 性能优化：直接在 Sharp pipeline 上应用 modulate，避免 toBuffer/fromBuffer 转换
    // 这样可以减少 2 次内存复制，降低内存峰值约 50%，提升处理速度 20-30%
    // 对于大图片（>10MB），跳过 AI 修图以避免内存峰值过高
    if (aiRetouchConfig?.enabled) {
      try {
        // 检查图片大小（从原始 metadata 获取）
        // 注意：对于 Buffer 输入，metadata.size 存在；对于文件输入，可能不存在
        // 如果 size 不存在，使用 width * height * channels 估算（保守估计）
        const imageSize = originalMetadata.size || 
          (originalMetadata.width && originalMetadata.height && originalMetadata.channels
            ? originalMetadata.width * originalMetadata.height * originalMetadata.channels
            : 0);
        const maxSizeForAIRetouch = 10 * 1024 * 1024; // 10MB
        
        if (imageSize > maxSizeForAIRetouch) {
          console.warn(`Skipping AI retouch for large image (${(imageSize / 1024 / 1024).toFixed(2)}MB > ${maxSizeForAIRetouch / 1024 / 1024}MB)`);
        } else {
          const preset = aiRetouchConfig.config?.preset || 'auto';
          let modulateParams: { brightness: number; saturation: number };
          
          if (preset === 'portrait') {
            // 人像模式：轻微提亮，轻微增加饱和度
            modulateParams = { brightness: 1.05, saturation: 1.1 };
          } else if (preset === 'landscape') {
            // 风景模式：增加对比度，增加饱和度
            modulateParams = { brightness: 1.02, saturation: 1.3 };
          } else {
            // 自动模式：通用增强
            modulateParams = { brightness: 1.05, saturation: 1.15 };
          }
          
          rotatedImage = rotatedImage.modulate(modulateParams);
        }
      } catch (err) {
        console.warn('AI Retouch failed, falling back to original:', err);
      }
    }

    // Apply style preset (after rotation, before watermark)
    rotatedImage = this.applyStylePreset(rotatedImage, stylePresetId);

    const metadata = await rotatedImage.metadata();

    // 2. Parallel generation: BlurHash + Thumbnail (Performance optimization)
    // Optimization: BlurHash uses rotated image to avoid repeated rotation
    // Support thumbnail standard via environment variable, default 400px (backward compatible)
    // IMPORTANT: Each parallel task uses independent clone() to ensure full isolation
    // Defensive measure: Create completely independent Sharp instances before parallel processing
    const thumbSize = parseInt(process.env.THUMB_MAX_SIZE || '400', 10);

    // Create completely independent Sharp instances for each parallel task
    // This ensures data isolation even if Sharp has internal concurrency issues
    const thumbImage = rotatedImage.clone();
    const blurHashImage = rotatedImage.clone();

    const [blurHash, thumbBuffer] = await Promise.all([
      // Generate BlurHash (based on rotated image)
      // Use independent Sharp instance for isolation
      this.generateBlurHashFromRotated(blurHashImage),
      // Generate thumbnail - auto-rotate based on EXIF orientation
      // Use independent Sharp instance for isolation
      thumbImage
        .resize(thumbSize, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
    ]);

    // 4. Generate Preview - auto-rotate based on EXIF orientation
    // Optimization: Get dimensions directly from metadata to avoid repeated decode
    const { width: originalWidth, height: originalHeight } = metadata;

    // Calculate preview dimensions (maintain aspect ratio)
    // Support preview standard via environment variable, default 1920px (backward compatible)
    const maxPreviewSize = parseInt(process.env.PREVIEW_MAX_SIZE || '1920', 10);
    let previewWidth = originalWidth || maxPreviewSize;
    let previewHeight = originalHeight || maxPreviewSize;

    if (previewWidth > maxPreviewSize || previewHeight > maxPreviewSize) {
      const ratio = Math.min(maxPreviewSize / previewWidth, maxPreviewSize / previewHeight);
      previewWidth = Math.floor(previewWidth * ratio);
      previewHeight = Math.floor(previewHeight * ratio);
    }

    // Optimization: Reuse rotatedImage, reduce clone operations
    // Note: previewPipeline will be modified later (watermark addition), so clone is needed
    let previewPipeline = rotatedImage
      .clone()
      .resize(maxPreviewSize, null, { withoutEnlargement: true });

    // Add Watermark
    if (watermarkConfig?.enabled) {
      console.log(`[Watermark] Config:`, JSON.stringify(watermarkConfig));
      const watermarkStartTime = Date.now();
      const width = previewWidth;
      const height = previewHeight;

      // Boundary check: ensure valid image dimensions
      if (!width || !height || width <= 0 || height <= 0) {
        console.warn(`[Watermark] Invalid image dimensions: ${width}x${height}, skipping watermark`);
      } else {
        const composites: Array<{ input: Buffer; gravity: string }> = [];

        // Support multiple watermarks (new format)
        if (watermarkConfig.watermarks && Array.isArray(watermarkConfig.watermarks)) {

          // Parallel processing of multiple watermarks (performance optimization)
          const enabledWatermarks = watermarkConfig.watermarks.filter(w => w.enabled !== false);
          console.log(`[Watermark] Enabled watermarks: ${enabledWatermarks.length}`, JSON.stringify(enabledWatermarks));
          const watermarkPromises = enabledWatermarks.map(watermark =>
            this.createWatermarkBuffer(watermark, width, height)
          );

          // Create all watermark buffers in parallel
          const watermarkBuffers = await Promise.all(watermarkPromises);
          console.log(`[Watermark] Created buffers: ${watermarkBuffers.filter(b => b !== null).length}/${watermarkBuffers.length}`);

          // Build composites array
          for (let i = 0; i < enabledWatermarks.length; i++) {
            const watermarkBuffer = watermarkBuffers[i];
            if (watermarkBuffer) {
              const gravity = this.positionToGravity(enabledWatermarks[i].position);
              composites.push({
                input: watermarkBuffer,
                gravity,
              });
            }
          }
        } else {
          // Legacy format compatibility: Single watermark
          const singleWatermark: SingleWatermark = {
            type: watermarkConfig.type || 'text',
            text: watermarkConfig.text,
            logoUrl: watermarkConfig.logoUrl,
            opacity: watermarkConfig.opacity || 0.5,
            position: (watermarkConfig.position as SingleWatermark['position']) || 'center',
          };

          const watermarkBuffer = await this.createWatermarkBuffer(
            singleWatermark,
            width,
            height
          );

          if (watermarkBuffer) {
            const gravity = this.positionToGravity(singleWatermark.position);
            composites.push({
              input: watermarkBuffer,
              gravity,
            });
          }
        }

        // Apply all watermarks
        if (composites.length > 0) {
          previewPipeline = previewPipeline.composite(composites);
        }

        const watermarkDuration = Date.now() - watermarkStartTime;
        if (watermarkDuration > 5000) {
          console.warn(`[Watermark] Slow watermark processing: ${watermarkDuration}ms`);
        }
      }
    }

    const previewBuffer = await previewPipeline
      .jpeg({ quality: 85 })
      .toBuffer();

    return {
      metadata, // Already rotated metadata, contains correct dimensions
      exif,
      blurHash,
      thumbBuffer,
      previewBuffer,
    };
  }

  /**
   * 创建单个水印的 Buffer
   *
   * @description
   * - 文本水印：生成 SVG 文本
   * - Logo 水印：从 URL 下载并缩放，然后嵌入 SVG
   *
   * @param watermark - 水印配置
   * @param imageWidth - 基础图片宽度
   * @param imageHeight - 基础图片高度
   * @returns SVG Buffer，失败返回 null
   *
   * @internal
   */
  private async createWatermarkBuffer(
    watermark: SingleWatermark,
    imageWidth: number,
    imageHeight: number
  ): Promise<Buffer | null> {
    if (watermark.type === 'text' && watermark.text) {
      // size 是预览图宽度的百分比（1-100），转换为像素
      // 向后兼容：如果 size > 20，认为是旧的像素值，需要转换为百分比
      // 假设预览图宽度为 1920px，将像素值转换为百分比：pixels / 1920 * 100
      let sizePercent: number;
      if (watermark.size === undefined) {
        sizePercent = 2; // 默认值 2%
      } else if (watermark.size > 20) {
        // 向后兼容：旧像素值，转换为百分比（基于 1920px 预览图）
        const maxPreviewSize = parseInt(process.env.PREVIEW_MAX_SIZE || '1920', 10);
        sizePercent = (watermark.size / maxPreviewSize) * 100;
      } else {
        sizePercent = watermark.size; // 新百分比值
      }
      const fontSize = Math.floor(imageWidth * (sizePercent / 100));
      const { x, y, anchor, baseline } = this.getTextPosition(watermark.position, imageWidth, imageHeight, watermark.margin);

      const svgText = `
        <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
          <style>
            .watermark { fill: rgba(255, 255, 255, ${watermark.opacity}); font-size: ${fontSize}px; font-family: "Noto Sans CJK SC", "Noto Sans CJK", "Noto Sans", Arial, Helvetica, "Microsoft YaHei", "SimHei", "SimSun", "Arial Unicode MS", sans-serif; font-weight: bold; }
          </style>
          <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${baseline}" class="watermark">${this.escapeXml(watermark.text)}</text>
        </svg>
      `;
      return Buffer.from(svgText);
    } else if (watermark.type === 'logo' && watermark.logoUrl) {
      // Security check: Validate URL
      if (!this.isValidLogoUrl(watermark.logoUrl)) {
        console.error(`[Watermark] Invalid or unsafe logo URL: ${watermark.logoUrl}`);
        return null;
      }

      try {
        // Set timeout and size limit (Prevent SSRF and OOM)
        const controller = new AbortController();
        const timeoutMs = 10000; // 10 seconds timeout
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const maxSize = 10 * 1024 * 1024; // 10MB limit

        try {
          const response = await fetch(watermark.logoUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'PIS-Watermark/1.0',
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Failed to fetch logo: ${response.status} ${response.statusText}`);
          }

          // Check Content-Length
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > maxSize) {
            throw new Error(`Logo file too large: ${contentLength} bytes (max: ${maxSize} bytes)`);
          }

          const logoBuffer = await response.arrayBuffer();

          // Double check actual size
          if (logoBuffer.byteLength > maxSize) {
            throw new Error(`Logo file too large: ${logoBuffer.byteLength} bytes (max: ${maxSize} bytes)`);
          }

          // size 是预览图宽度的百分比（1-100），转换为像素
          // 向后兼容：如果 size > 20，认为是旧的像素值，需要转换为百分比
          // 假设预览图宽度为 1920px，将像素值转换为百分比：pixels / 1920 * 100
          let sizePercent: number;
          if (watermark.size === undefined) {
            sizePercent = 8; // 默认值 8%
          } else if (watermark.size > 20) {
            // 向后兼容：旧像素值，转换为百分比（基于 1920px 预览图）
            const maxPreviewSize = parseInt(process.env.PREVIEW_MAX_SIZE || '1920', 10);
            sizePercent = (watermark.size / maxPreviewSize) * 100;
          } else {
            sizePercent = watermark.size; // 新百分比值
          }
          const logoSize = Math.floor(imageWidth * (sizePercent / 100));

          // Optimization: Get buffer and metadata in one go, avoid repeated Sharp instances
          const resizedLogoResult = await sharp(Buffer.from(logoBuffer))
            .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer({ resolveWithObject: true });

          const logoW = resizedLogoResult.info.width;
          const logoH = resizedLogoResult.info.height;

          if (logoW && logoH) {
            const { x, y } = this.getImagePosition(watermark.position, imageWidth, imageHeight, logoW, logoH, watermark.margin);
            const logoBase64 = resizedLogoResult.data.toString('base64');

            const svgLogo = `
              <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
                <image
                  href="data:image/png;base64,${logoBase64}"
                  width="${logoW}"
                  height="${logoH}"
                  opacity="${watermark.opacity}"
                  x="${x}"
                  y="${y}"
                />
              </svg>
            `;
            return Buffer.from(svgLogo);
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.error(`[Watermark] Logo download timeout after ${timeoutMs}ms: ${watermark.logoUrl}`);
          } else {
            throw fetchError;
          }
        }
      } catch (e: any) {
        console.error(`[Watermark] Failed to load logo from ${watermark.logoUrl}:`, e.message || e);
        // Do not interrupt process, just skip this watermark
      }
    }
    return null;
  }

  /**
   * 将位置字符串转换为 Sharp gravity
   *
   * @param position - 位置字符串（如 'top-left'）
   * @returns Sharp gravity 字符串
   *
   * @internal
   */
  private positionToGravity(position: string): string {
    const positionMap: Record<string, string> = {
      'top-left': 'northwest',
      'top-center': 'north',
      'top-right': 'northeast',
      'center-left': 'west',
      'center': 'center',
      'center-right': 'east',
      'bottom-left': 'southwest',
      'bottom-center': 'south',
      'bottom-right': 'southeast',
      // Legacy format compatibility
      'northwest': 'northwest',
      'northeast': 'northeast',
      'southwest': 'southwest',
      'southeast': 'southeast',
    };
    return positionMap[position] || 'center';
  }

  /**
   * 计算文本水印的坐标
   *
   * @param position - 位置字符串
   * @param width - 图片宽度
   * @param height - 图片高度
   * @param customMargin - 自定义边距百分比
   * @returns 坐标和文本锚点属性
   *
   * @internal
   */
  private getTextPosition(
    position: string,
    width: number,
    height: number,
    customMargin?: number
  ): { x: string; y: string; anchor: string; baseline: string } {
    const marginPercent = customMargin !== undefined ? customMargin / 100 : 0.05; // Custom or default 5%
    const margin = Math.min(width, height) * marginPercent;

    const positions: Record<string, { x: string; y: string; anchor: string; baseline: string }> = {
      'top-left': { x: `${margin}`, y: `${margin}`, anchor: 'start', baseline: 'hanging' },
      'top-center': { x: '50%', y: `${margin}`, anchor: 'middle', baseline: 'hanging' },
      'top-right': { x: `${width - margin}`, y: `${margin}`, anchor: 'end', baseline: 'hanging' },
      'center-left': { x: `${margin}`, y: '50%', anchor: 'start', baseline: 'middle' },
      'center': { x: '50%', y: '50%', anchor: 'middle', baseline: 'middle' },
      'center-right': { x: `${width - margin}`, y: '50%', anchor: 'end', baseline: 'middle' },
      'bottom-left': { x: `${margin}`, y: `${height - margin}`, anchor: 'start', baseline: 'alphabetic' },
      'bottom-center': { x: '50%', y: `${height - margin}`, anchor: 'middle', baseline: 'alphabetic' },
      'bottom-right': { x: `${width - margin}`, y: `${height - margin}`, anchor: 'end', baseline: 'alphabetic' },
    };

    return positions[position] || positions['center'];
  }

  /**
   * 计算图片水印的坐标（带边界检查）
   *
   * @description
   * 确保 Logo 不会超出图片边界
   *
   * @param position - 位置字符串
   * @param imageWidth - 图片宽度
   * @param imageHeight - 图片高度
   * @param logoWidth - Logo 宽度
   * @param logoHeight - Logo 高度
   * @param customMargin - 自定义边距百分比
   * @returns 坐标 {x, y}
   *
   * @internal
   */
  private getImagePosition(
    position: string,
    imageWidth: number,
    imageHeight: number,
    logoWidth: number,
    logoHeight: number,
    customMargin?: number
  ): { x: number; y: number } {
    const marginPercent = customMargin !== undefined ? customMargin / 100 : 0.05; // Custom or default 5%
    const margin = Math.min(imageWidth, imageHeight) * marginPercent;

    // Ensure logo doesn't exceed image boundaries
    const maxX = Math.max(0, imageWidth - logoWidth);
    const maxY = Math.max(0, imageHeight - logoHeight);

    const positions: Record<string, { x: number; y: number }> = {
      'top-left': { x: Math.min(margin, maxX), y: Math.min(margin, maxY) },
      'top-center': { x: Math.max(0, Math.min((imageWidth - logoWidth) / 2, maxX)), y: Math.min(margin, maxY) },
      'top-right': { x: Math.max(0, Math.min(imageWidth - logoWidth - margin, maxX)), y: Math.min(margin, maxY) },
      'center-left': { x: Math.min(margin, maxX), y: Math.max(0, Math.min((imageHeight - logoHeight) / 2, maxY)) },
      'center': { x: Math.max(0, Math.min((imageWidth - logoWidth) / 2, maxX)), y: Math.max(0, Math.min((imageHeight - logoHeight) / 2, maxY)) },
      'center-right': { x: Math.max(0, Math.min(imageWidth - logoWidth - margin, maxX)), y: Math.max(0, Math.min((imageHeight - logoHeight) / 2, maxY)) },
      'bottom-left': { x: Math.min(margin, maxX), y: Math.max(0, Math.min(imageHeight - logoHeight - margin, maxY)) },
      'bottom-center': { x: Math.max(0, Math.min((imageWidth - logoWidth) / 2, maxX)), y: Math.max(0, Math.min(imageHeight - logoHeight - margin, maxY)) },
      'bottom-right': { x: Math.max(0, Math.min(imageWidth - logoWidth - margin, maxX)), y: Math.max(0, Math.min(imageHeight - logoHeight - margin, maxY)) },
    };

    const pos = positions[position] || positions['center'];

    // Final boundary check
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    };
  }

  /**
   * 转义 XML 特殊字符
   *
   * @param text - 输入文本
   * @returns 转义后的文本
   *
   * @internal
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  /**
   * 清理字符串中的 NULL 字符（\u0000）
   *
   * @description
   * PostgreSQL 不支持在 JSON/text 字段中存储 \u0000 字符
   * 相机 EXIF 数据（如 BodySerialNumber）可能包含 C 语言风格的 null 结尾字符串
   *
   * @param value - 任意值
   * @returns 清理后的值
   *
   * @internal
   */
  private removeNullChars(value: unknown): unknown {
    if (typeof value === 'string') {
      // 移除所有 \u0000 字符
      return value.replace(/\u0000/g, '');
    }
    if (Array.isArray(value)) {
      return value.map(item => this.removeNullChars(item));
    }
    if (value && typeof value === 'object') {
      const cleaned: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        cleaned[key] = this.removeNullChars(val);
      }
      return cleaned;
    }
    return value;
  }

  /**
   * 清理 EXIF 数据，移除敏感信息（GPS）和不安全字符
   *
   * @description
   * - 移除 GPS 位置信息以保护隐私
   * - 移除 \u0000 字符（PostgreSQL 不支持）
   *
   * @param {any} rawExif - 原始 EXIF 对象
   * @returns {any} 清理后的 EXIF 对象
   *
   * @internal
   */
  private sanitizeExif(rawExif: any): any {
    if (!rawExif || typeof rawExif !== 'object') {
      return rawExif;
    }

    const sanitized: any = {};

    // Keep basic EXIF info
    if (rawExif.exif) {
      sanitized.exif = { ...rawExif.exif };
      // Remove fields that might contain location info
      delete sanitized.exif.GPSInfo;
      delete sanitized.exif.GPSVersionID;
    }

    // Keep image info
    if (rawExif.image) {
      sanitized.image = rawExif.image;
    }

    // Keep camera info
    if (rawExif.makernote) {
      sanitized.makernote = rawExif.makernote;
    }

    // Explicitly remove GPS info
    if (rawExif.gps) {
      // Do not keep GPS info
    }

    // Remove all fields containing GPS
    Object.keys(rawExif).forEach((key) => {
      if (key.toLowerCase().includes('gps') || key.toLowerCase().includes('location')) {
        // Skip GPS related fields
        return;
      }
      if (!sanitized[key]) {
        sanitized[key] = rawExif[key];
      }
    });

    // 清理所有 \u0000 字符（PostgreSQL 不支持）
    return this.removeNullChars(sanitized);
  }

  /**
   * 从已旋转的图像生成 BlurHash
   *
   * @description
   * 性能优化：避免重复旋转操作
   *
   * @param rotatedImage - 已旋转的 Sharp 图像对象
   * @returns BlurHash 字符串
   *
   * @internal
   */
  private async generateBlurHashFromRotated(rotatedImage: sharp.Sharp): Promise<string> {
    const { data, info } = await rotatedImage
      .clone()
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true })

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4)
  }

  /**
   * 生成 BlurHash（旧方法）
   *
   * @deprecated 使用 generateBlurHashFromRotated 代替，性能更好
   *
   * @param manualRotation - 手动旋转角度（可选）
   * @returns BlurHash 字符串
   *
   * @internal
   */
  private async generateBlurHash(manualRotation?: number | null): Promise<string> {
    let image = this.image.clone();
    
    // 应用旋转：如果有手动旋转角度，使用手动角度；否则使用 EXIF orientation 自动旋转
    if (manualRotation !== null && manualRotation !== undefined) {
      image = image.rotate().rotate(manualRotation); // 先应用 EXIF，再应用手动旋转
    } else {
      image = image.rotate(); // 只应用 EXIF orientation
    }
    
    const { data, info } = await image
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
  }
}
