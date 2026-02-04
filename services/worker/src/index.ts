/**
 * PIS Worker - Image Processing Service
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// 从根目录加载 .env（monorepo 统一配置）
// 支持多种路径：容器内挂载路径 /app/.env，或项目根目录
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '../../../');

// 优先尝试容器内挂载路径，然后尝试项目根目录
const envPaths = [
  '/app/.env', // Docker 容器挂载路径
  resolve(rootDir, '.env'), // 项目根目录
];

let envLoaded = false;
let loadedEnvPath: string | null = null;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    envLoaded = true;
    loadedEnvPath = envPath;
    break;
  }
}

// 加载 .env.local（如果存在，会覆盖 .env 中的配置）
// 支持容器内挂载路径和项目根目录
const envLocalPaths = [
  '/app/.env.local', // Docker 容器挂载路径
  resolve(rootDir, '.env.local'), // 项目根目录
];

for (const envLocalPath of envLocalPaths) {
  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath, override: true });
    break;
  }
}

// 初始化 logger（需要在加载环境变量之后）
// 使用动态导入确保环境变量已加载
let logger: any;
try {
  const loggerModule = await import('./lib/logger.js');
  logger = loggerModule.default;
  
  if (envLoaded && loadedEnvPath) {
    logger.info({ path: loadedEnvPath }, '✅ Loaded environment variables');
  } else {
    logger.warn({ paths: envPaths }, '⚠️  No .env file found. Environment variables will be read from system environment');
  }
} catch (err) {
  // 如果 logger 初始化失败，回退到 console
  console.warn('Failed to initialize logger, falling back to console:', err);
  logger = {
    info: (...args: any[]) => console.log(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args),
    fatal: (...args: any[]) => console.error(...args),
    debug: (...args: any[]) => console.debug(...args),
  };
  if (!envLoaded || !loadedEnvPath) {
    console.warn('⚠️  No .env file found. Tried paths:', envPaths.join(', '));
  }
}

import http from 'http';
import { Worker, Job, Queue } from 'bullmq';
import { connection, QUEUE_NAME, photoQueue } from './lib/redis.js';
import { 
  downloadFile, 
  uploadFile, 
  uploadBuffer,
  initMultipartUpload,
  uploadPart,
  getPresignedPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  getPresignedGetUrl,
  getPresignedPutUrl,
  listObjects,
  copyFile,
  deleteFile,
  bucketName,
  getStorageAdapter
} from './lib/storage/index.js';
import { PhotoProcessor } from './processor.js';
import { PackageCreator } from './package-creator.js';
import { getAlbumCache, destroyAlbumCache } from './lib/album-cache.js';
import { purgePhotoCache } from './lib/cloudflare-purge.js';
import sharp from 'sharp';
import { extractFaces } from './lib/face-recognition.js';
import { alertService } from './lib/alert.js';
import { db as supabase } from './lib/database/client.js';
import { ftpServerService } from './ftp-server.js';
// logger 已在上面通过动态导入初始化

// 移除原有的数据库初始化代码
// const dbType = ...

interface PhotoJobData {
  photoId: string;
  albumId: string;
  originalKey: string;
  isRetouch?: boolean;
}

interface PackageJobData {
  packageId: string;
  albumId: string;
  photoIds: string[];
  includeWatermarked: boolean;
  includeOriginal: boolean;
}

// ============================================
// 配置常量（需要先定义，因为后面会用到）
// ============================================
const CONFIG = {
  // 请求大小限制
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB for JSON requests
  MAX_UPLOAD_SIZE: 100 * 1024 * 1024, // 100MB for file uploads
  MAX_PART_SIZE: 100 * 1024 * 1024, // 100MB per part (S3 standard)
  
  // 队列配置
  PHOTO_PROCESSING_CONCURRENCY: parseInt(process.env.PHOTO_PROCESSING_CONCURRENCY || '5'),
  PHOTO_PROCESSING_LIMIT_MAX: parseInt(process.env.PHOTO_PROCESSING_LIMIT_MAX || '10'),
  PHOTO_PROCESSING_LIMIT_DURATION: parseInt(process.env.PHOTO_PROCESSING_LIMIT_DURATION || '1000'),
  PACKAGE_PROCESSING_CONCURRENCY: parseInt(process.env.PACKAGE_PROCESSING_CONCURRENCY || '2'),
  
  // 恢复配置
  STUCK_PHOTO_THRESHOLD_HOURS: parseInt(process.env.STUCK_PHOTO_THRESHOLD_HOURS || '1'),
  
  // 回收站配置
  DELETED_PHOTO_RETENTION_DAYS: parseInt(process.env.DELETED_PHOTO_RETENTION_DAYS || '30'), // 保留 30 天
  DELETED_PHOTO_CLEANUP_INTERVAL_MS: parseInt(process.env.DELETED_PHOTO_CLEANUP_INTERVAL_MS || '3600000'), // 每小时检查一次
  
  
  // 打包下载配置
  PACKAGE_DOWNLOAD_EXPIRY_DAYS: parseInt(process.env.PACKAGE_DOWNLOAD_EXPIRY_DAYS || '15'),
  
  // 扫描配置
  MAX_SCAN_BATCH_SIZE: parseInt(process.env.MAX_SCAN_BATCH_SIZE || '1000'),
  SCAN_BATCH_SIZE: parseInt(process.env.SCAN_BATCH_SIZE || '10'),
  
  // 打包配置
  MAX_PACKAGE_PHOTOS: parseInt(process.env.MAX_PACKAGE_PHOTOS || '500'),
  
  // 性能优化配置
  ENABLE_ALBUM_CACHE: process.env.ENABLE_ALBUM_CACHE !== 'false', // 默认启用缓存
  ALBUM_CACHE_TTL_MS: parseInt(process.env.ALBUM_CACHE_TTL_MS || '300000'), // 5分钟缓存
  
  // 优雅退出配置
  SHUTDOWN_TIMEOUT_MS: parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000'),
  
  // 开发模式
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_DEVELOPMENT: (process.env.NODE_ENV || 'development') === 'development',
} as const;

// ============================================
// API 认证配置
// ============================================
const WORKER_API_KEY = process.env.WORKER_API_KEY;
if (!WORKER_API_KEY) {
  console.warn('⚠️  WORKER_API_KEY not set, API endpoints are unprotected!');
  console.warn('   Please set WORKER_API_KEY in .env for production use');
}

// CORS 配置
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

/**
 * 验证 API Key
 */
function authenticateRequest(req: http.IncomingMessage): boolean {
  if (!WORKER_API_KEY) {
    // 开发环境：允许访问但记录警告
    if (CONFIG.IS_DEVELOPMENT) {
      // 开发环境允许访问，但建议设置 API Key
      return true;
    }
    // 生产环境：如果没有配置 API Key，拒绝访问
    console.error('❌ WORKER_API_KEY not set in production! Denying access.');
    return false;
  }
  
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
  const apiKey = Array.isArray(apiKeyHeader) 
    ? apiKeyHeader[0]?.replace(/^Bearer\s+/i, '') || apiKeyHeader[0]
    : apiKeyHeader?.replace(/^Bearer\s+/i, '') || apiKeyHeader;
  
  const isValid = apiKey === WORKER_API_KEY;
  
  return isValid;
}

/**
 * 验证 UUID 格式
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 验证输入参数
 */
function validateInput(data: any, requiredFields: string[]): { valid: boolean; error?: string } {
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  return { valid: true };
}

/**
 * 设置 CORS 头
 */
function setCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse) {
  const origin = req.headers.origin;
  
  if (CORS_ORIGINS.length > 0 && origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (CORS_ORIGINS.length === 0) {
    // 开发环境允许所有来源
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
}

/**
 * 解析请求体（带大小限制）
 */
function parseRequestBody(
  req: http.IncomingMessage,
  maxSize: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bodySize = 0;
    
    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > maxSize) {
        req.destroy();
        reject(new Error(`Request body too large (max: ${maxSize} bytes, received: ${bodySize} bytes)`));
        return;
      }
      body += chunk.toString('utf8');
    });
    
    req.on('end', () => {
      resolve(body);
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    // 设置超时（防止慢速攻击）
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * 解析 JSON 请求体（带错误处理）
 */
async function parseJsonBody(
  req: http.IncomingMessage,
  maxSize: number
): Promise<any> {
  const body = await parseRequestBody(req, maxSize);
  
  if (!body || body.trim().length === 0) {
    throw new Error('Request body is empty');
  }
  
  try {
    return JSON.parse(body);
  } catch (parseError) {
    throw new Error(`Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }
}

const worker = new Worker<PhotoJobData>(
  QUEUE_NAME,
  async (job: Job<PhotoJobData>) => {
    const { photoId, albumId, originalKey } = job.data;

    try {
      // 0. 使用条件更新（状态机锁）避免竞态条件
      // 注意：这不是标准的乐观锁（需要版本号字段），而是基于状态的条件更新
      // Supabase 的 UPDATE ... WHERE 是原子操作，可以安全地防止竞态条件
      // 同时排除已删除的照片（deleted_at IS NULL）
      let { data: updatedPhoto, error: updateError } = await supabase
        .from('photos')
        .update({ status: 'processing' })
        .eq('id', photoId)
        .eq('status', 'pending') // 条件更新：只更新 pending 状态的照片（原子操作）
        .is('deleted_at', null) // 排除已删除的照片
        .select('id, status, rotation')
        .single();
      
      // 如果更新失败或没有影响行数，说明照片已被其他 worker 处理或不存在
      if (updateError || !updatedPhoto) {
        // 检查照片是否存在以及当前状态
        const { data: existingPhoto, error: queryError } = await supabase
          .from('photos')
          .select('id, status, deleted_at, updated_at, rotation')
          .eq('id', photoId)
          .single();
        
        if (!existingPhoto) {
          return;
        }
        
        if (existingPhoto.status === 'completed') {
          return;
        }

        let shouldProceed = false;

        if (existingPhoto.status === 'pending') {
          // 如果状态仍然是 pending，说明更新失败可能是数据库连接问题或其他原因
          // 重试一次更新，如果还是失败则抛出错误
          const { data: retryUpdatedPhoto, error: retryError } = await supabase
            .from('photos')
            .update({ status: 'processing' })
            .eq('id', photoId)
            .eq('status', 'pending')
            .is('deleted_at', null)
            .select('id, status, rotation')
            .single();
          
          if (retryError || !retryUpdatedPhoto) {
            // 重试失败，可能是被其他 worker 处理了，检查当前状态
            const { data: currentPhoto } = await supabase
              .from('photos')
              .select('id, status')
              .eq('id', photoId)
              .single();
            
            if (currentPhoto?.status === 'completed' || currentPhoto?.status === 'processing') {
              // 已被其他 worker 处理，直接返回
              return;
            }
            
            // 如果还是 pending，说明有问题，抛出错误让 BullMQ 重试
            console.error(`[${job.id}] Failed to update photo status from pending to processing:`, retryError?.message || 'Unknown error');
            throw retryError || new Error('Failed to update photo status');
          }
          
          // 重试成功，继续处理
          updatedPhoto = retryUpdatedPhoto;
          shouldProceed = true;
        } else if (existingPhoto.status === 'failed') {
          // 如果是 failed 状态，重新开始处理（更新状态为 processing）
          const { error: retryError } = await supabase
            .from('photos')
            .update({ status: 'processing' })
            .eq('id', photoId);
            
          if (retryError) {
            console.error(`[${job.id}] Failed to retry photo:`, retryError.message);
            throw retryError;
          }
          shouldProceed = true;
        } else if (existingPhoto.status === 'processing') {
          // 如果状态是 processing，检查是否超时（例如 5 分钟无更新）
          const updatedTime = new Date(existingPhoto.updated_at).getTime();
          const now = Date.now();
          const timeoutMs = 5 * 60 * 1000; // 5分钟超时

          if (now - updatedTime > timeoutMs) {
            // 强制接管任务
            const { error: takeoverError } = await supabase
              .from('photos')
              .update({ 
                status: 'processing',
                updated_at: new Date().toISOString() // 更新时间戳，防止其他 worker 再次接管
              })
              .eq('id', photoId);

            if (takeoverError) {
              console.error(`[${job.id}] Failed to takeover stuck photo:`, takeoverError.message);
              throw takeoverError;
            }
            shouldProceed = true;
          } else {
            return;
          }
        }
        
        // 如果 deleted_at 不为 null，说明照片已被删除
        if (existingPhoto.deleted_at) {
          return;
        }
        
        // 如果上面处理了 pending/failed 或接管了 processing，则不返回，继续执行
        if (shouldProceed) {
          // 如果 updatedPhoto 还没有设置（failed 或 processing 的情况），使用 existingPhoto
          if (!updatedPhoto) {
            // @ts-ignore
            updatedPhoto = existingPhoto;
          }
        } else {
          return;
        }
      }
      
      // 获取照片的旋转角度（已在更新时查询）
      const photoRotation = updatedPhoto.rotation ?? null;

      // 2. 并行执行：下载原图 + 获取相册配置（减少等待时间）
      // 优化：使用缓存减少数据库查询
      console.time(`[${job.id}] Download+Config`);
      let originalBuffer: Buffer;
      let album: any;
      
      try {
        // 先检查缓存
        const albumCache = getAlbumCache();
        let cachedAlbum = CONFIG.ENABLE_ALBUM_CACHE ? albumCache.get(albumId) : null;
        
        const [downloadResult, albumResult] = await Promise.all([
          // 下载原图
          downloadFile(originalKey).catch(async (downloadErr: any) => {
            // 改进的错误检测：支持更多错误格式
            const isFileNotFound = downloadErr?.code === 'NoSuchKey' || 
                                  downloadErr?.code === 'NotFound' ||
                                  downloadErr?.statusCode === 404 ||
                                  downloadErr?.message?.includes('does not exist') ||
                                  downloadErr?.message?.includes('NoSuchKey') ||
                                  downloadErr?.message?.includes('not found') ||
                                  downloadErr?.message?.includes('NotFound') ||
                                  downloadErr?.message?.includes('Unable to stat') ||
                                  downloadErr?.message?.includes('Object does not exist');
            
            if (isFileNotFound) {
              // 文件不存在，但可能是 MinIO 最终一致性问题（文件刚上传但还没完全写入）
              // 查询照片的创建时间，如果是最近创建的，等待后重试一次
              const { data: photoRecord } = await supabase
                .from('photos')
                .select('created_at')
                .eq('id', photoId)
                .single();
              
              if (photoRecord?.created_at) {
                const createdAt = new Date(photoRecord.created_at);
                const now = new Date();
                const ageSeconds = (now.getTime() - createdAt.getTime()) / 1000;
                
                // 如果照片是最近创建的（30秒内），等待5秒后重试一次
                if (ageSeconds < 30) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
                  
                  // 重试下载
                  try {
                    return await downloadFile(originalKey);
                  } catch (retryErr: any) {
                    // 改进的错误检测：支持更多错误格式
                    const retryIsFileNotFound = retryErr?.code === 'NoSuchKey' || 
                                              retryErr?.code === 'NotFound' ||
                                              retryErr?.statusCode === 404 ||
                                              retryErr?.message?.includes('does not exist') ||
                                              retryErr?.message?.includes('NoSuchKey') ||
                                              retryErr?.message?.includes('not found') ||
                                              retryErr?.message?.includes('NotFound') ||
                                              retryErr?.message?.includes('Unable to stat') ||
                                              retryErr?.message?.includes('Object does not exist');
                    if (retryIsFileNotFound) {
                      try {
                        await supabase
                          .from('photos')
                          .delete()
                          .eq('id', photoId);
                      } catch {
                      }
                      throw new Error('FILE_NOT_FOUND');
                    }
                    throw retryErr;
                  }
                }
              }
              
              try {
                await supabase
                  .from('photos')
                  .delete()
                  .eq('id', photoId);
              } catch {
              }
              throw new Error('FILE_NOT_FOUND');
            }
            throw downloadErr;
          }),
          // 获取相册配置（如果缓存未命中）
          cachedAlbum 
            ? Promise.resolve({ data: cachedAlbum, error: null })
            : supabase
                .from('albums')
                .select('id, watermark_enabled, watermark_type, watermark_config, color_grading, enable_human_retouch, enable_ai_retouch, ai_retouch_config')
                .eq('id', albumId)
                .single()
        ]);
        
        // 确保 Buffer 完全独立（防止潜在的引用共享问题）
        // 创建新的 Buffer 副本，确保每个 job 都有完全独立的内存空间
        originalBuffer = Buffer.from(downloadResult);
        const { data: albumData, error: albumError } = albumResult;
        
        if (albumError || !albumData) {
          throw new Error(`Album not found: ${albumId}`);
        }
        
        album = albumData;
        
        // 更新缓存（如果是从数据库查询的）
        if (!cachedAlbum && CONFIG.ENABLE_ALBUM_CACHE) {
          albumCache.set(albumId, {
            id: albumData.id,
            watermark_enabled: albumData.watermark_enabled,
            watermark_type: albumData.watermark_type,
            watermark_config: albumData.watermark_config,
            color_grading: albumData.color_grading,
          });
        }
      } catch (err: any) {
        if (err.message === 'FILE_NOT_FOUND') {
          return; // 文件不存在，已清理，不重试
        }
        throw err;
      }
      console.timeEnd(`[${job.id}] Download+Config`);

      // 构建水印配置（支持新旧格式）
      const watermarkConfigRaw = (album?.watermark_config as any) || {};
      const watermarkConfig = {
        enabled: album?.watermark_enabled ?? false,
        // 如果包含 watermarks 数组，使用新格式
        watermarks: watermarkConfigRaw.watermarks || undefined,
        // 兼容旧格式
        type: album?.watermark_type ?? watermarkConfigRaw.type ?? 'text',
        text: watermarkConfigRaw.text,
        logoUrl: watermarkConfigRaw.logoUrl,
        opacity: watermarkConfigRaw.opacity ?? 0.5,
        position: watermarkConfigRaw.position ?? 'center',
      };

      // 4. 读取风格预设 ID
      const colorGrading = album?.color_grading as { preset?: string } | null;
      const stylePresetId = colorGrading?.preset || null;

      // 5. 处理图片 (Sharp)
      // 安全措施：再次确保 Buffer 独立（防御性编程）
      // 虽然理论上不需要，但可以防止任何潜在的 Buffer 引用问题
      const processingBuffer = Buffer.from(originalBuffer);
      console.time(`[${job.id}] Process`);
      const processor = new PhotoProcessor(processingBuffer);
      const result = await processor.process(
        watermarkConfig, 
        photoRotation, 
        stylePresetId,
        {
          enabled: album?.enable_ai_retouch ?? false,
          config: album?.ai_retouch_config
        }
      );
      console.timeEnd(`[${job.id}] Process`);

      // 6. 上传处理后的图片到存储
      const thumbKey = `processed/thumbs/${albumId}/${photoId}.jpg`;
      const previewKey = `processed/previews/${albumId}/${photoId}.jpg`;

      // 防御性措施：如果是重新处理（照片状态可能是 completed/failed），先删除旧文件
      // 这确保了不会有部分更新的文件，避免显示混乱的图片
      // 注意：即使删除失败也继续（文件可能不存在，这是正常的）
      try {
        const { data: existingPhoto } = await supabase
          .from('photos')
          .select('thumb_key, preview_key')
          .eq('id', photoId)
          .single();
        
        if (existingPhoto) {
          const filesToDelete: string[] = [];
          if (existingPhoto.thumb_key && existingPhoto.thumb_key !== thumbKey) {
            filesToDelete.push(existingPhoto.thumb_key);
          }
          if (existingPhoto.preview_key && existingPhoto.preview_key !== previewKey) {
            filesToDelete.push(existingPhoto.preview_key);
          }
          
          // 并行删除旧文件（如果存在）
          if (filesToDelete.length > 0) {
            await Promise.all(
              filesToDelete.map(key => 
                deleteFile(key).catch(err => {
                  // 文件不存在时忽略错误（这是正常的）
                  if (err?.code !== 'NoSuchKey' && !err?.message?.includes('does not exist')) {
                    console.warn(`[${job.id}] Failed to delete old file ${key}:`, err.message);
                  }
                })
              )
            );
          }
        }
      } catch (cleanupError) {
        // 清理失败不影响主流程，只记录警告
        console.warn(`[${job.id}] Failed to cleanup old files (non-critical):`, cleanupError);
      }

      console.time(`[${job.id}] Upload`);
      await Promise.all([
        uploadFile(thumbKey, result.thumbBuffer, { 'Content-Type': 'image/jpeg' }),
        uploadFile(previewKey, result.previewBuffer, { 'Content-Type': 'image/jpeg' }),
      ]);
      console.timeEnd(`[${job.id}] Upload`);

      // 7. 解析 EXIF DateTimeOriginal 为 ISO 格式
      // EXIF 标准格式通常是 "YYYY:MM:DD HH:MM:SS"，需要转换为 ISO 8601
      const parseExifDateTime = (dateTimeStr: string | undefined | null): string | null => {
        if (!dateTimeStr || typeof dateTimeStr !== 'string') {
          return null;
        }
        
        try {
          // 如果已经是 ISO 格式，直接返回
          if (dateTimeStr.includes('T') || dateTimeStr.includes('Z')) {
            const date = new Date(dateTimeStr);
            return isNaN(date.getTime()) ? null : date.toISOString();
          }
          
          // EXIF 格式: "YYYY:MM:DD HH:MM:SS" 或 "YYYY:MM:DD HH:MM:SS.SSS"
          // 替换冒号为连字符，空格为 T，添加时区
          const exifPattern = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/;
          const match = dateTimeStr.match(exifPattern);
          
          if (match) {
            const [, year, month, day, hour, minute, second, millisecond] = match;
            const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${millisecond || ''}Z`;
            const date = new Date(isoString);
            return isNaN(date.getTime()) ? null : date.toISOString();
          }
          
          // 尝试直接解析
          const date = new Date(dateTimeStr);
          return isNaN(date.getTime()) ? null : date.toISOString();
        } catch {
          return null;
        }
      };

      const exifDateTime = (result.exif as any)?.exif?.DateTimeOriginal;
      const capturedAt = parseExifDateTime(exifDateTime) || new Date().toISOString();

      // 决定最终状态：如果开启了人工修图且不是精修图上传，则状态为 pending_retouch，否则为 completed
      const isRetouch = job.data.isRetouch;
      const finalStatus = (album.enable_human_retouch && !isRetouch) ? 'pending_retouch' : 'completed';

      // 7. 更新数据库
      const { error } = await supabase
        .from('photos')
        .update({
          status: finalStatus,
          thumb_key: thumbKey,
          preview_key: previewKey,
          width: result.metadata.width,
          height: result.metadata.height,
          blur_data: result.blurHash,
          exif: result.exif,
          file_size: processingBuffer.length, // 使用处理时的 Buffer 长度
          mime_type: result.metadata.format,
          // 使用解析后的拍摄时间
          captured_at: capturedAt,
          // 更新时间戳（用于前端缓存破坏）
          updated_at: new Date().toISOString(),
        })
        .eq('id', photoId);

      if (error) throw error;

      // 8. 人脸识别 (异步执行，不阻塞)
      if (finalStatus === 'completed') {
        try {
          // 创建旋转 pipeline
          let facePipeline = sharp(processingBuffer);
          if (photoRotation !== null && photoRotation !== undefined) {
             facePipeline = facePipeline.rotate().rotate(photoRotation);
          } else {
             facePipeline = facePipeline.rotate();
          }
          
          const faceImageBuffer = await facePipeline
            .resize(800, null, { withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
            
          const faces = await extractFaces(faceImageBuffer);
          
          if (faces.length > 0) {
            const faceRecords = faces.map(face => ({
              photo_id: photoId,
              album_id: albumId,
              embedding: `[${face.embedding.join(',')}]`,
              face_location: {
                x: face.bbox[0],
                y: face.bbox[1],
                w: face.bbox[2] - face.bbox[0],
                h: face.bbox[3] - face.bbox[1]
              }
            }));
            
            const { error: faceError } = await supabase
              .from('face_embeddings')
              .insert(faceRecords);
              
            if (faceError) {
              console.error(`[${job.id}] Failed to save face embeddings:`, faceError);
            } else {
              console.log(`[${job.id}] Saved ${faces.length} faces`);
            }
          }
        } catch (faceErr) {
          // 不阻塞主流程
          console.error(`[${job.id}] Face recognition failed:`, faceErr);
        }
      }

      // 7. 优化：使用数据库函数增量更新相册照片数量，避免每次 COUNT 查询
      // 这样可以减少数据库负载，特别是在批量上传时
      // 注意：increment_photo_count 函数需要更新以排除 deleted_at
      const { error: countError } = await supabase.rpc('increment_photo_count', {
        album_id: albumId
      });
      
      if (countError) {
        // 如果函数调用失败，回退到 COUNT 查询（兼容性处理）
        console.warn(`[${job.id}] Failed to use increment_photo_count, falling back to COUNT query:`, countError);
        const { count } = await supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', albumId)
          .eq('status', 'completed')
          .is('deleted_at', null); // 排除已删除的照片
        
        await supabase
          .from('albums')
          .update({ photo_count: count || 0 })
          .eq('id', albumId);
      }

      // 8. 清除 Cloudflare CDN 缓存（如果配置了）
      // 这可以防止 Cloudflare 缓存了 404 响应后，即使图片已生成也无法访问
      const mediaUrl = process.env.STORAGE_PUBLIC_URL || process.env.MINIO_PUBLIC_URL || process.env.NEXT_PUBLIC_MEDIA_URL;
      const zoneId = process.env.CLOUDFLARE_ZONE_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      
      if (mediaUrl && zoneId && apiToken) {
        try {
          await purgePhotoCache(mediaUrl, {
            thumb_key: thumbKey,
            preview_key: previewKey,
            original_key: job.data.originalKey, // 使用原始上传的 key
          }, zoneId, apiToken).catch((purgeError) => {
            // 记录错误但不抛出（不影响处理流程）
            console.warn(`[${job.id}] Failed to purge CDN cache:`, purgeError);
          });
        } catch (purgeError) {
          console.warn(`[${job.id}] Error purging CDN cache:`, purgeError);
        }
      } else if (mediaUrl) {
        console.warn(`[${job.id}] Cloudflare API not configured (missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN), skipping cache purge`);
      }
    } catch (err: any) {
      console.error(`[${job.id}] Failed:`, err);
      
      // 检查是否是文件不存在的错误（上传失败但数据库记录已创建）
      // 改进的错误检测：支持更多错误格式（MinIO、S3、OSS、COS 等）
      const isFileNotFound = err?.code === 'NoSuchKey' || 
                            err?.code === 'NotFound' ||
                            err?.statusCode === 404 ||
                            err?.message?.includes('does not exist') ||
                            err?.message?.includes('NoSuchKey') ||
                            err?.message?.includes('not found') ||
                            err?.message?.includes('NotFound') ||
                            err?.message?.includes('Unable to stat') ||
                            err?.message?.includes('Object does not exist') ||
                            err?.message === 'FILE_NOT_FOUND';
      
      if (isFileNotFound) {
        // 文件不存在，但可能是 MinIO 最终一致性问题（文件刚上传但还没完全写入）
        // 查询照片的创建时间，如果是最近创建的，等待后重试一次
        const { data: photoRecord } = await supabase
          .from('photos')
          .select('created_at')
          .eq('id', photoId)
          .single();
        
        if (photoRecord?.created_at) {
          const createdAt = new Date(photoRecord.created_at);
          const now = new Date();
          const ageSeconds = (now.getTime() - createdAt.getTime()) / 1000;
          
          // 如果照片是最近创建的（30秒内），等待5秒后重试一次
          if (ageSeconds < 30) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // 重试检查文件是否存在
            const adapter = getStorageAdapter();
            const retryFileExists = await adapter.exists(originalKey);
            
            if (retryFileExists) {
              // 文件现在存在了，重新抛出错误让 BullMQ 重试处理
              throw err;
            }
          }
        }
        
        // 文件不存在（或重试后仍然不存在），说明上传失败，尝试删除数据库记录（如果还存在）
        const { error: deleteError } = await supabase
          .from('photos')
          .delete()
          .eq('id', photoId);
        
        // 不抛出错误，避免重试（文件不存在时重试也没用）
        return;
      }
      
      // 其他错误，更新状态为 failed（尝试更新，但不阻塞）
      try {
        const { error: updateError } = await supabase
          .from('photos')
          .update({ status: 'failed' })
          .eq('id', photoId);
        
        if (updateError) {
          console.warn(`[${job.id}] Failed to update status to failed:`, updateError.message);
        }
      } catch (updateErr) {
        console.warn(`[${job.id}] Error updating status to failed:`, updateErr);
        // 不抛出错误，继续抛出原始错误
      }
      
      throw err; // 让 BullMQ 知道任务失败 (以便重试)
    }
  },
  {
    connection,
    concurrency: CONFIG.PHOTO_PROCESSING_CONCURRENCY,
    limiter: {
      max: CONFIG.PHOTO_PROCESSING_LIMIT_MAX,
      duration: CONFIG.PHOTO_PROCESSING_LIMIT_DURATION,
    },
  }
);

worker.on('failed', async (job, err) => {
  const jobId = job?.id;
  const errorMessage = err?.message || 'Unknown error';
  console.error(`❌ Job ${jobId} failed:`, errorMessage);

  // 发送告警（仅在非临时错误时）
  // 临时错误：网络超时、连接重置、服务暂时不可用
  // 非临时错误：文件损坏、格式不支持、配置错误等
  const isTemporaryError =
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests');

  // 只在非临时错误且不是第一次失败时发送告警
  // 第一次失败可能是偶发的，重试后成功就不需要告警
  if (!isTemporaryError && job?.attemptsMade && job.attemptsMade >= 2) {
    await alertService.photoProcessingFailed(
      jobId || 'unknown',
      job.data?.albumId || 'unknown',
      errorMessage
    );
  }
});

// ============================================
// 打包下载 Worker
// ============================================
const packageQueue = new Queue('package-downloads', { connection });

const packageWorker = new Worker<PackageJobData>(
  'package-downloads',
  async (job: Job<PackageJobData>) => {
    const { packageId, albumId, photoIds, includeWatermarked, includeOriginal } = job.data;

    try {
      // 1. 更新状态为 processing
      await supabase
        .from('package_downloads')
        .update({ status: 'processing' })
        .eq('id', packageId);

      // 2. 获取相册水印配置和标题（验证相册存在）
      const { data: album, error: albumError } = await supabase
        .from('albums')
        .select('id, title, watermark_enabled, watermark_type, watermark_config')
        .eq('id', albumId)
        .single();
      
      if (albumError || !album) {
        throw new Error(`Album not found: ${albumId}`);
      }

      // 构建水印配置（与照片处理逻辑保持一致，支持新旧格式）
      const watermarkConfigRaw = (album?.watermark_config as any) || {};
      const watermarkConfig = album?.watermark_enabled
        ? {
            enabled: true,
            // 如果包含 watermarks 数组，使用新格式
            watermarks: watermarkConfigRaw.watermarks || undefined,
            // 兼容旧格式
            type: album.watermark_type ?? watermarkConfigRaw.type ?? 'text',
            text: watermarkConfigRaw.text,
            logoUrl: watermarkConfigRaw.logoUrl,
            opacity: watermarkConfigRaw.opacity ?? 0.5,
            position: watermarkConfigRaw.position ?? 'center',
          }
        : undefined;

      // 3. 获取照片信息
      const { data: photos } = await supabase
        .from('photos')
        .select('id, filename, original_key, preview_key')
        .in('id', photoIds)
        .eq('status', 'completed');

      if (!photos || photos.length === 0) {
        throw new Error('No photos found');
      }

      // 4. 创建 ZIP 包
      console.time(`[Package ${job.id}] Create ZIP`);
      const zipBuffer = await PackageCreator.createPackage({
        photos: photos.map((p: { id: string; filename: string; original_key: string; preview_key: string }) => ({
          id: p.id,
          filename: p.filename,
          originalKey: p.original_key,
          previewKey: p.preview_key,
        })),
        albumId,
        watermarkConfig,
        includeWatermarked,
        includeOriginal,
      });
      console.timeEnd(`[Package ${job.id}] Create ZIP`);

      // 5. 上传 ZIP 到存储
      const zipKey = `packages/${albumId}/${packageId}.zip`;
      const albumTitle = (album as any)?.title || 'photos';
      console.time(`[Package ${job.id}] Upload ZIP`);
      await uploadFile(zipKey, zipBuffer, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${albumTitle}.zip"`,
      });
      console.timeEnd(`[Package ${job.id}] Upload ZIP`);

      // 6. 生成下载链接
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CONFIG.PACKAGE_DOWNLOAD_EXPIRY_DAYS);
      const downloadUrl = await getPresignedGetUrl(zipKey, CONFIG.PACKAGE_DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60);

      // 7. 更新数据库
      await supabase
        .from('package_downloads')
        .update({
          status: 'completed',
          zip_key: zipKey,
          file_size: zipBuffer.length,
          download_url: downloadUrl,
          expires_at: expiresAt.toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', packageId);
    } catch (err: any) {
      console.error(`[Package ${job.id}] Failed:`, err);

      // 更新状态为 failed
      await supabase
        .from('package_downloads')
        .update({ status: 'failed' })
        .eq('id', packageId);

      throw err;
    }
  },
  {
    connection,
    concurrency: CONFIG.PACKAGE_PROCESSING_CONCURRENCY,
  }
);

packageWorker.on('failed', (job, err) => {
  console.error(`❌ Package job ${job?.id} failed:`, err.message);
});

// ============================================
// HTTP API 服务器 (用于接收上传请求)
// ============================================

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3001');

const server = http.createServer(async (req, res) => {
  // 设置 CORS
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${HTTP_PORT}`);

  // 健康检查端点不需要认证
  if (url.pathname === '/health') {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // 检查 Redis 连接（通过队列测试）
    try {
      const testQueue = new Queue('health-check', { connection });
      await testQueue.getWaitingCount(); // 轻量级操作测试连接
      await testQueue.close();
      health.services.redis = { status: 'ok' };
    } catch (err: any) {
      health.services.redis = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    // 检查数据库连接
    try {
      const dbHealth = await supabase.healthCheck();
      if (!dbHealth.ok) throw new Error(dbHealth.error || 'Database health check failed');
      health.services.database = { status: 'ok', type: 'supabase' };
    } catch (err: any) {
      health.services.database = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    // 检查存储连接
    try {
      const storageModule = await import('./lib/storage/index.js');
      const testKey = `health-check-${Date.now()}.txt`;
      // 尝试列出 bucket（轻量级操作）
      health.services.storage = { 
        status: 'ok', 
        bucket: storageModule.bucketName,
        type: process.env.STORAGE_TYPE || 'minio'
      };
    } catch (err: any) {
      health.services.storage = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  // API 认证检查（除了 health 端点）
  if (!authenticateRequest(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing API key' }));
    return;
  }

  // 获取预签名上传 URL (保留兼容)
  if (url.pathname === '/api/presign' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key } = body;
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key' }));
          return;
        }

      const presignedUrl = await getPresignedPutUrl(key);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: presignedUrl }));
    } catch (err: any) {
      console.error('Presign error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // 获取预签名下载 URL
  if (url.pathname === '/api/presign/get' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key, expirySeconds = 300, responseContentDisposition } = body;
      
      if (!key) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing key' }));
        return;
      }

      // 生成 presigned URL
      let presignedUrl = await getPresignedGetUrl(key, expirySeconds);
      
      // 如果指定了 Content-Disposition，添加到 URL 参数中
      if (responseContentDisposition) {
        const urlObj = new URL(presignedUrl);
        urlObj.searchParams.set('response-content-disposition', responseContentDisposition);
        presignedUrl = urlObj.toString();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: presignedUrl }));
    } catch (err: any) {
      console.error('[Presign Get] Error:', err);
      const statusCode = err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // 直接上传文件到 MinIO (代理模式)
  if (url.pathname === '/api/upload' && req.method === 'PUT') {
    const key = url.searchParams.get('key');
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    
    if (!key) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing key parameter' }));
      return;
    }

    const chunks: Buffer[] = [];
    let uploadSize = 0;
    let isAborted = false;
    
    // 设置请求超时（防止慢速攻击）
    req.setTimeout(300000, () => { // 5分钟超时
      if (!isAborted) {
        isAborted = true;
        req.destroy();
        res.writeHead(408, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upload timeout' }));
      }
    });
    
    req.on('data', (chunk: Buffer) => {
      if (isAborted) return;
      
      uploadSize += chunk.length;
      if (uploadSize > CONFIG.MAX_UPLOAD_SIZE) {
        isAborted = true;
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `File too large (max: ${CONFIG.MAX_UPLOAD_SIZE} bytes)` }));
        return;
      }
      chunks.push(chunk);
    });
    
    req.on('aborted', () => {
      isAborted = true;
    });
    
    req.on('end', async () => {
      if (isAborted) return;
      try {
        const buffer = Buffer.concat(chunks);
        await uploadFile(key, buffer, { 'Content-Type': contentType });
        
        if (!isAborted) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, key }));
        }
      } catch (err: any) {
        if (!isAborted) {
          console.error('Upload error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    
    req.on('error', (err) => {
      if (!isAborted) {
        isAborted = true;
        console.error('Upload request error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request error' }));
      }
    });
    
    return;
  }

  // 触发照片处理
  if (url.pathname === '/api/process' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { photoId, albumId, originalKey } = body;
      
      // 输入验证
      const validation = validateInput(body, ['photoId', 'albumId', 'originalKey']);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validation.error }));
        return;
      }
      
      // UUID 格式验证
      if (!isValidUUID(photoId) || !isValidUUID(albumId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid UUID format for photoId or albumId' }));
        return;
      }
      
      // Key 格式验证（基本检查）
      if (typeof originalKey !== 'string' || originalKey.length === 0 || originalKey.length > 500) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid originalKey format' }));
        return;
      }

      // 添加到处理队列
      await photoQueue.add('process-photo', { photoId, albumId, originalKey });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Job queued' }));
    } catch (err: any) {
      console.error('Process queue error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // 清除相册缓存（用于缓存失效）
  if (url.pathname === '/api/clear-album-cache' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { albumId } = body;
      
      if (!albumId || typeof albumId !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid albumId' }));
        return;
      }

      const albumCache = getAlbumCache();
      albumCache.delete(albumId);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Album cache cleared' }));
    } catch (err: any) {
      console.error('[Clear Cache] Error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // 清理文件（用于 cleanup API）
  if (url.pathname === '/api/cleanup-file' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key, keys } = body;
      
      const keysToDelete = keys && Array.isArray(keys) ? keys : (key ? [key] : []);
      
      if (keysToDelete.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing key or keys' }));
        return;
      }
      
      // 批量删除（并发执行）
      const results = await Promise.allSettled(keysToDelete.map(async (k: string) => {
        if (typeof k !== 'string' || k.length === 0 || k.length > 500) {
           throw new Error(`Invalid key format: ${k}`);
        }
        try {
          await deleteFile(k);
          return k;
        } catch (deleteErr: any) {
          // 文件不存在时也视为成功
          if (deleteErr?.code === 'NoSuchKey' || deleteErr?.message?.includes('does not exist')) {
            return k;
          }
          throw deleteErr;
        }
      }));

      const failed = results.filter(r => r.status === 'rejected');
      
      if (failed.length > 0) {
         console.error(`[Cleanup] Failed to delete ${failed.length} files`);
         // 即使部分失败，也返回 200，但在 message 中说明？
         // 或者返回 207 Multi-Status？
         // 为了简单起见，如果只有部分失败，我们记录日志但返回成功，或者返回失败列表
         // 但通常 cleanup 是后台任务，尽力而为。
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: `Processed ${keysToDelete.length} files`,
        failedCount: failed.length
      }));

    } catch (err: any) {
      console.error('[Cleanup] File cleanup error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // ============================================
  // 分片上传 API
  // ============================================

  // 初始化分片上传
  if (url.pathname === '/api/multipart/init' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key } = body;
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key' }));
          return;
        }

        const uploadId = await initMultipartUpload(key);
        
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ uploadId, key }));
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error';
      const errorStack = err?.stack || '';
      console.error('[Multipart] Init error:', errorMessage);
      console.error('[Multipart] Error stack:', errorStack);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') ? 400 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      }));
    }
    return;
  }

  // 获取分片的预签名上传 URL（用于客户端直接上传到 MinIO）
  if (url.pathname === '/api/multipart/presign-part' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key, uploadId, partNumber, expirySeconds = 3600 } = body;
      
      if (!key || !uploadId || !partNumber) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing key, uploadId, or partNumber' }));
          return;
        }

      const presignedUrl = await getPresignedPartUrl(key, uploadId, partNumber, expirySeconds);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: presignedUrl, partNumber }));
    } catch (err: any) {
      console.error('[Multipart] Presign part error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') ? 400 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Failed to generate presigned URL',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }));
    }
    return;
  }

  // 上传单个分片（保留兼容性，但推荐使用 presigned URL 直接上传）
  if (url.pathname === '/api/multipart/upload' && req.method === 'PUT') {
    const key = url.searchParams.get('key');
    const uploadId = url.searchParams.get('uploadId');
    const partNumber = parseInt(url.searchParams.get('partNumber') || '0');

    if (!key || !uploadId || !partNumber) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing key, uploadId, or partNumber' }));
      return;
    }

    const chunks: Buffer[] = [];
    let partSize = 0;
    let isAborted = false;
    
    // 设置请求超时
    req.setTimeout(300000, () => { // 5分钟超时
      if (!isAborted) {
        isAborted = true;
        req.destroy();
        res.writeHead(408, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Part upload timeout' }));
      }
    });
    
    req.on('data', (chunk: Buffer) => {
      if (isAborted) return;
      
      partSize += chunk.length;
      // 单个分片限制（S3 标准）
      if (partSize > CONFIG.MAX_PART_SIZE) {
        isAborted = true;
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Part too large (max: ${CONFIG.MAX_PART_SIZE} bytes)` }));
        return;
      }
      chunks.push(chunk);
    });
    
    req.on('aborted', () => {
      isAborted = true;
    });
    
    req.on('end', async () => {
      if (isAborted) return;
      
      // 检查连接是否仍然有效
      if (res.destroyed || res.writableEnded) {
        console.warn(`[Multipart] Response already closed for part ${partNumber}`);
        return;
      }
      
      try {
        const buffer = Buffer.concat(chunks);
        
        const { etag } = await uploadPart(key, uploadId, partNumber, buffer);
        
        // 再次检查连接状态
        if (!isAborted && !res.destroyed && !res.writableEnded) {
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Connection': 'keep-alive', // 保持连接
          });
          res.end(JSON.stringify({ etag, partNumber }));
        } else {
          console.warn(`[Multipart] Response closed before sending result for part ${partNumber}`);
        }
      } catch (err: any) {
        if (!isAborted && !res.destroyed && !res.writableEnded) {
          console.error(`[Multipart] Upload error for part ${partNumber}:`, err);
          res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Connection': 'keep-alive',
          });
          res.end(JSON.stringify({ error: err.message || 'Upload failed' }));
        }
      }
    });
    
    req.on('error', (err) => {
      if (!isAborted) {
        isAborted = true;
        console.error(`[Multipart] Request error for part ${partNumber}:`, err);
        if (!res.destroyed && !res.writableEnded) {
          res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Connection': 'close',
          });
          res.end(JSON.stringify({ error: 'Request error' }));
        }
      }
    });
    
    // 监听响应关闭事件
    res.on('close', () => {
      if (!isAborted) {
        isAborted = true;
        console.warn(`[Multipart] Response closed unexpectedly for part ${partNumber}`);
      }
    });
    
    return;
  }

  // 完成分片上传
  if (url.pathname === '/api/multipart/complete' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key, uploadId, parts } = body;
        if (!key || !uploadId || !parts || !Array.isArray(parts)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key, uploadId, or parts' }));
          return;
        }

        await completeMultipartUpload(key, uploadId, parts);
        
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, key }));
    } catch (err: any) {
      console.error('Multipart complete error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // 取消分片上传
  if (url.pathname === '/api/multipart/abort' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key, uploadId } = body;
        if (!key || !uploadId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing key or uploadId' }));
          return;
        }

        await abortMultipartUpload(key, uploadId);
        
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err: any) {
      console.error('Multipart abort error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // ============================================
  // 打包下载 API
  // ============================================

  // 创建打包下载任务
  if (url.pathname === '/api/package' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { packageId, albumId, photoIds, includeWatermarked, includeOriginal } = body;
      
      if (!packageId || !albumId || !photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: packageId, albumId, photoIds (non-empty array)' }));
        return;
      }

      // 验证UUID格式
      if (!isValidUUID(packageId) || !isValidUUID(albumId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid UUID format for packageId or albumId' }));
        return;
      }

      // 验证photoIds数组中的每个ID都是有效的UUID
      const invalidPhotoIds = photoIds.filter(id => typeof id !== 'string' || !isValidUUID(id));
      if (invalidPhotoIds.length > 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Invalid UUID format in photoIds array (${invalidPhotoIds.length} invalid IDs)` }));
        return;
      }

      // 限制打包数量（与前端保持一致）
      if (photoIds.length > CONFIG.MAX_PACKAGE_PHOTOS) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Too many photos (${photoIds.length} > ${CONFIG.MAX_PACKAGE_PHOTOS}). Maximum ${CONFIG.MAX_PACKAGE_PHOTOS} photos per package.` }));
        return;
      }

      if (typeof includeWatermarked !== 'boolean' || typeof includeOriginal !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'includeWatermarked and includeOriginal must be boolean' }));
        return;
      }

      // 添加到打包队列
      await packageQueue.add('create-package', {
        packageId,
        albumId,
        photoIds,
        includeWatermarked,
        includeOriginal,
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Package job queued' }));
    } catch (err: any) {
      console.error('Package queue error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // ============================================
  // 检查 pending 照片 API（事件驱动）
  // ============================================
  if (url.pathname === '/api/check-pending' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { albumId } = body;
      
      // albumId 是可选的，如果不提供则检查所有相册
      if (albumId && !isValidUUID(albumId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid albumId format' }));
        return;
      }
      
      const result = await checkPendingPhotos(albumId);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        processed: result?.processed || 0,
        requeued: result?.requeued || 0,
        cleaned: result?.cleaned || 0,
        stuckReset: result?.stuckReset || 0,
        orphaned: result?.orphaned || 0,
        message: `检查完成：${result?.processed || 0} 张照片，${result?.requeued || 0} 张重新加入队列，${result?.cleaned || 0} 张已清理${result?.stuckReset ? `，${result.stuckReset} 张卡住的照片已重置` : ''}${result?.orphaned ? `，${result.orphaned} 张孤立文件已恢复` : ''}`,
      }));
    } catch (err: any) {
      console.error('Check pending error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: err.message || 'Internal server error',
      }));
    }
    return;
  }

  // ============================================
  // 列出文件 API（用于诊断）
  // ============================================

  // 列出指定前缀下的文件
  if (url.pathname === '/api/list-files' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { prefix } = body;
      
      if (!prefix || typeof prefix !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'prefix is required and must be a string' }));
        return;
      }

      const objects = await listObjects(prefix);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true,
        prefix,
        files: objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          lastModified: obj.lastModified.toISOString(),
        })),
        count: objects.length,
      }));
    } catch (err: any) {
      console.error('List files error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
      }));
    }
    return;
  }

  // ============================================
  // 扫描同步 API
  // ============================================

  // 扫描同步
  if (url.pathname === '/api/scan' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { albumId } = body;
      
      const validation = validateInput(body, ['albumId']);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validation.error }));
        return;
      }
      
      if (!isValidUUID(albumId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid UUID format for albumId' }));
        return;
      }

        // 1. 列出 sync/{albumId}/ 下的所有文件
        const prefix = `sync/${albumId}/`;
        const objects = await listObjects(prefix);
        
        // 2. 过滤出图片文件
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif', '.tiff', '.tif'];
        const imageObjects = objects.filter(obj => {
          const keyLower = obj.key.toLowerCase();
          const lastDotIndex = keyLower.lastIndexOf('.');
          // 检查是否有扩展名（. 不在开头或结尾）
          if (lastDotIndex === -1 || lastDotIndex === 0 || lastDotIndex === keyLower.length - 1) {
            return false;
          }
          const ext = keyLower.slice(lastDotIndex);
          return imageExtensions.includes(ext);
        });

        // 限制批量处理大小，避免超时
        if (imageObjects.length > CONFIG.MAX_SCAN_BATCH_SIZE) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: `Too many images to process (${imageObjects.length} > ${CONFIG.MAX_SCAN_BATCH_SIZE}). Please reduce the number of files or increase MAX_SCAN_BATCH_SIZE.`,
            found: imageObjects.length,
            maxBatchSize: CONFIG.MAX_SCAN_BATCH_SIZE
          }));
          return;
        }

        if (imageObjects.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            found: 0, 
            added: 0,
            skipped: 0,
            message: '未找到新图片' 
          }));
          return;
        }

        // 3. 查询数据库已有的文件（通过 filename 比对）
        const { data: existingPhotos } = await supabase
          .from('photos')
          .select('filename')
          .eq('album_id', albumId);
        
        const existingFilenames = new Set(
          (existingPhotos || []).map((p: { filename: string }) => p.filename)
        );

        // 4. 处理新图片（批量并行处理，提高性能）
        let addedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < imageObjects.length; i += CONFIG.SCAN_BATCH_SIZE) {
          const batch = imageObjects.slice(i, i + CONFIG.SCAN_BATCH_SIZE);
          
          // 并行处理一批文件
          await Promise.all(
            batch.map(async (obj) => {
              const filename = obj.key.split('/').pop() || '';
              
              // 跳过已存在的文件
              if (existingFilenames.has(filename)) {
                skippedCount++;
                return;
              }

              // 生成新的 photo_id
              const photoId = crypto.randomUUID();
              const lastDotIndex = filename.lastIndexOf('.');
              const ext = lastDotIndex !== -1 && lastDotIndex < filename.length - 1
                ? filename.slice(lastDotIndex + 1).toLowerCase()
                : 'jpg'; // 默认扩展名
              const newKey = `raw/${albumId}/${photoId}.${ext}`;

              try {
                // 复制文件到标准路径
                await copyFile(obj.key, newKey);

                // 创建数据库记录
                const { error: insertError } = await supabase
                  .from('photos')
                  .insert({
                    id: photoId,
                    album_id: albumId,
                    original_key: newKey,
                    filename: filename,
                    file_size: obj.size,
                    status: 'pending',
                  });

                if (insertError) {
                  console.error(`[Scan] Failed to insert photo: ${insertError.message}`);
                  // 如果数据库插入失败，删除已复制的文件
                  try {
                    await deleteFile(newKey);
                  } catch (deleteErr) {
                    console.error(`[Scan] Failed to cleanup copied file: ${deleteErr}`);
                  }
                  return;
                }

                // 添加到处理队列
                await photoQueue.add('process-photo', { 
                  photoId, 
                  albumId, 
                  originalKey: newKey 
                });

                // 删除原始文件（可选，或保留备份）
                try {
                  await deleteFile(obj.key);
                } catch (deleteErr) {
                  console.warn(`[Scan] Failed to delete source file ${obj.key}: ${deleteErr}`);
                  // 不阻止流程继续
                }
                
                addedCount++;
              } catch (err: any) {
                console.error(`[Scan] Error processing ${filename}:`, err.message);
                // 继续处理下一个文件
              }
            })
          );
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          found: imageObjects.length,
          skipped: skippedCount,
          added: addedCount,
          message: addedCount > 0 
            ? `成功导入 ${addedCount} 张新图片${skippedCount > 0 ? `，跳过 ${skippedCount} 张已存在图片` : ''}`
            : `未找到新图片${skippedCount > 0 ? `，跳过 ${skippedCount} 张已存在图片` : ''}`
        }));
    } catch (err: any) {
      console.error('[Scan] Error:', err);
      const statusCode = err.message?.includes('too large') ? 413 : 
                        err.message?.includes('Invalid JSON') || err.message?.includes('Invalid') ? 400 :
                        err.message?.includes('timeout') ? 408 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: err.message || 'Internal server error',
        ...(CONFIG.IS_DEVELOPMENT && err.stack ? { stack: err.stack } : {})
      }));
    }
    return;
  }

  // ============================================
  // 数据一致性检查 API
  // ============================================

  // 执行一致性检查
  // 支持两种路径：/api/consistency/check (通过代理) 和 /api/worker/consistency/check (直接调用)
  if ((url.pathname === '/api/consistency/check' || url.pathname === '/api/worker/consistency/check') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const {
        autoFix = false,
        deleteOrphanedFiles = false,
        deleteOrphanedRecords = false,
        batchSize = 100,
      } = body;

      // 动态导入一致性检查模块
      const { createConsistencyChecker } = await import('./lib/consistency.js');
      
      // 创建一致性检查器（使用数据库适配器，支持 PostgreSQL 和 Supabase）
      const checker = createConsistencyChecker(bucketName);

      const result = await checker.check({
        autoFix,
        deleteOrphanedFiles,
        deleteOrphanedRecords,
        batchSize,
        sendAlerts: true,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result,
      }));
    } catch (err: any) {
      console.error('[Consistency] Check error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: err.message || 'Internal server error',
      }));
    }
    return;
  }

  // 修复单个照片
  if (url.pathname.match(/^\/api\/worker\/consistency\/repair\/[^/]+$/) && req.method === 'POST') {
    try {
      const photoId = url.pathname.split('/').pop();
      if (!photoId || !isValidUUID(photoId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid photo ID' }));
        return;
      }

      const { createConsistencyChecker } = await import('./lib/consistency.js');
      
      // 创建一致性检查器（使用数据库适配器，支持 PostgreSQL 和 Supabase）
      const checker = createConsistencyChecker(bucketName);

      const result = await checker.repairPhoto(photoId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: result.success,
        message: result.message,
      }));
    } catch (err: any) {
      console.error('[Consistency] Repair error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: err.message || 'Internal server error',
      }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================
// 启动时恢复卡住的 processing 状态
// ============================================
async function recoverStuckProcessingPhotos() {
  try {
    // 1. 查询所有状态为 processing 且超过阈值时间的照片
    const thresholdMs = CONFIG.STUCK_PHOTO_THRESHOLD_HOURS * 60 * 60 * 1000;
    const thresholdTime = new Date(Date.now() - thresholdMs).toISOString();
    const { data: stuckPhotos, error } = await supabase
      .from('photos')
      .select('id, album_id, original_key, thumb_key, preview_key, status, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', thresholdTime);
    
    if (error) {
      console.error('❌ Failed to query stuck photos:', error);
      return;
    }
    
    if (!stuckPhotos || stuckPhotos.length === 0) {
      return;
    }
    
    // 2. 检查队列中是否有对应的任务
    let waitingPhotoIds = new Set<string>();
    try {
      const waitingJobs = await photoQueue.getWaiting();
      const activeJobs = await photoQueue.getActive();
      waitingPhotoIds = new Set(
        [...waitingJobs, ...activeJobs].map(job => job.data.photoId)
      );
    } catch (queueError: any) {
      console.warn('⚠️ Failed to query queue jobs, proceeding with recovery:', queueError.message);
      // 继续执行恢复，即使无法查询队列状态
    }
    
    let recoveredCount = 0;
    let alreadyCompletedCount = 0;
    let requeuedCount = 0;
    
    // 3. 处理每个卡住的照片
    for (const photo of stuckPhotos) {
      // 如果队列中有对应任务，跳过（说明任务还在处理中）
      if (waitingPhotoIds.has(photo.id)) {
        continue;
      }
      
      // 检查照片是否已经处理完成（有 thumb_key 和 preview_key）
      if (photo.thumb_key && photo.preview_key) {
        // 照片已经处理完成，但状态没有更新，修复状态
        const { error: updateError } = await supabase
          .from('photos')
          .update({ status: 'completed' })
          .eq('id', photo.id);
        
        if (updateError) {
          console.error(`❌ Failed to update photo ${photo.id}:`, updateError);
        } else {
          alreadyCompletedCount++;
        }
      } else {
        // 照片未处理完成，重置为 pending 并重新加入队列
        const { error: updateError } = await supabase
          .from('photos')
          .update({ status: 'pending' })
          .eq('id', photo.id);
        
        if (updateError) {
          console.error(`❌ Failed to reset photo ${photo.id}:`, updateError);
        } else {
          // 重新加入队列
          try {
            await photoQueue.add('process-photo', {
              photoId: photo.id,
              albumId: photo.album_id,
              originalKey: photo.original_key,
            });
            requeuedCount++;
          } catch (queueError) {
            console.error(`❌ Failed to requeue photo ${photo.id}:`, queueError);
          }
        }
      }
      recoveredCount++;
    }
  } catch (err: any) {
    console.error('❌ Error during recovery:', err);
  }
}

// ============================================
// 检查并修复 pending 状态的照片（事件驱动，按需调用）
// 同时检测两种不一致情况：
// 1. 数据库有记录，但文件不在 MinIO（清理数据库记录）
// 2. 文件在 MinIO，但数据库没有记录（创建数据库记录并加入队列）
// ============================================
async function checkPendingPhotos(albumId?: string) {
  try {
    // 1. 查询 pending 状态的照片（可选：指定相册）
    let pendingQuery = supabase
      .from('photos')
      .select('id, album_id, original_key, created_at, updated_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100); // 限制每次最多检查 100 张
    
    if (albumId) {
      pendingQuery = pendingQuery.eq('album_id', albumId);
    }
    
    const { data: pendingPhotos, error: pendingError } = await pendingQuery;
    
    if (pendingError) {
      console.error('❌ Failed to query pending photos:', pendingError);
    }
    
    // 1b. 查询长时间处于 processing 状态的照片（可能卡住了）
    // 如果 updated_at 超过 10 分钟没有更新，说明可能卡住了
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let processingQuery = supabase
      .from('photos')
      .select('id, album_id, original_key, created_at, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', tenMinutesAgo) // updated_at 超过 10 分钟
      .order('updated_at', { ascending: true })
      .limit(100);
    
    if (albumId) {
      processingQuery = processingQuery.eq('album_id', albumId);
    }
    
    const { data: stuckProcessingPhotos, error: processingError } = await processingQuery;
    
    if (processingError) {
      console.error('❌ Failed to query stuck processing photos:', processingError);
    }
    
    // 2. 检查队列中是否有对应的任务（避免重复添加）
    let queuedPhotoIds = new Set<string>();
    try {
      const waitingJobs = await photoQueue.getWaiting();
      const activeJobs = await photoQueue.getActive();
      queuedPhotoIds = new Set(
        [...waitingJobs, ...activeJobs].map(job => job.data.photoId)
      );
    } catch (queueError: any) {
      console.warn('⚠️ Failed to query queue jobs:', queueError.message);
    }
    
    let processedCount = 0;
    let requeuedCount = 0;
    let cleanedCount = 0;
    let stuckResetCount = 0;
    let orphanedFilesCount = 0;
    
    // 3. 检查每个 pending 照片的文件是否存在
    const allPhotosToCheck = [
      ...(pendingPhotos || []).map((p: { id: string; album_id: string; original_key: string; created_at: string | null; updated_at: string | null }) => ({ ...p, isPending: true })),
      ...(stuckProcessingPhotos || []).map((p: { id: string; album_id: string; original_key: string; created_at: string | null; updated_at: string | null }) => ({ ...p, isPending: false }))
    ];
    
    if (allPhotosToCheck.length > 0) {
      for (const photo of allPhotosToCheck) {
        // 如果已经在队列中，跳过
        if (queuedPhotoIds.has(photo.id)) {
          continue;
        }
        
        try {
          // 检查文件是否存在
          const fileExists = await checkFileExists(photo.original_key);
          
          if (fileExists) {
            // 文件存在，但状态是 pending 或长时间 processing，说明处理未完成或卡住了
            // 重置为 pending 并重新加入处理队列
            if (!photo.isPending) {
              // 如果是卡住的 processing 状态，先重置为 pending
              await supabase
                .from('photos')
                .update({ status: 'pending' })
                .eq('id', photo.id);
              stuckResetCount++;
            }
            
            // 重新加入处理队列
            try {
              await photoQueue.add('process-photo', {
                photoId: photo.id,
                albumId: photo.album_id,
                originalKey: photo.original_key,
              });
              requeuedCount++;
            } catch (queueError) {
              console.error(`❌ Failed to requeue photo ${photo.id}:`, queueError);
            }
          } else {
            // 文件不存在，但可能是 MinIO 最终一致性问题（文件刚上传但还没完全写入）
            // 检查照片创建时间，如果是最近创建的（30秒内），等待后重试一次
            const createdAt = photo.created_at ? new Date(photo.created_at) : null;
            const now = new Date();
            const ageSeconds = createdAt ? (now.getTime() - createdAt.getTime()) / 1000 : Infinity;
            
            // 如果照片是最近创建的（30秒内），等待5秒后重试一次
            if (ageSeconds < 30) {
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // 重试检查文件是否存在
              const retryFileExists = await checkFileExists(photo.original_key);
              if (retryFileExists) {
                // 文件现在存在了，重新加入处理队列
                try {
                  await photoQueue.add('process-photo', {
                    photoId: photo.id,
                    albumId: photo.album_id,
                    originalKey: photo.original_key,
                  });
                  requeuedCount++;
                } catch (queueError) {
                  console.error(`❌ Failed to requeue photo ${photo.id} after retry:`, queueError);
                }
              } else {
                // 重试后文件仍然不存在，且照片创建时间超过30秒，清理数据库记录
                const { error: deleteError } = await supabase
                  .from('photos')
                  .delete()
                  .eq('id', photo.id);
                
                if (deleteError) {
                  console.error(`❌ Failed to cleanup pending photo ${photo.id}:`, deleteError);
                } else {
                  cleanedCount++;
                }
              }
            } else {
              // 照片创建时间超过30秒，文件不存在，说明上传失败，清理数据库记录
              const { error: deleteError } = await supabase
                .from('photos')
                .delete()
                .eq('id', photo.id);
              
              if (deleteError) {
                console.error(`❌ Failed to cleanup pending photo ${photo.id}:`, deleteError);
              } else {
                cleanedCount++;
              }
            }
          }
          
          processedCount++;
        } catch (err: any) {
          console.error(`❌ Error checking photo ${photo.id}:`, err.message);
          // 继续处理下一个
        }
      }
    }
    
    // 4. 如果指定了相册，检查 MinIO 中是否有孤立文件（文件存在但数据库没有记录）
    if (albumId) {
      try {
        const rawPrefix = `raw/${albumId}/`;
        const rawFiles = await listObjects(rawPrefix);
        
        if (rawFiles.length > 0) {
          // 查询该相册的所有照片记录（包括所有状态，但排除已删除的）
          const { data: allPhotos } = await supabase
            .from('photos')
            .select('id, original_key')
            .eq('album_id', albumId)
            .is('deleted_at', null); // 排除已删除的照片
          
          const dbPhotoKeys = new Set(
            (allPhotos || []).map((p: { original_key: string }) => p.original_key)
          );
          
          // 找出 MinIO 中存在但数据库中没有记录的文件
          const orphanedFiles = rawFiles.filter(file => !dbPhotoKeys.has(file.key));
          
          if (orphanedFiles.length > 0) {
            // 为每个孤立文件创建数据库记录并加入处理队列
            for (const file of orphanedFiles) {
              try {
                // 从文件路径提取 photoId（格式：raw/{albumId}/{photoId}.jpg）
                const filename = file.key.split('/').pop() || '';
                const photoIdMatch = filename.match(/^([a-f0-9-]+)\./);
                
                if (!photoIdMatch) {
                  console.warn(`⚠️ Cannot extract photoId from filename: ${filename}`);
                  continue;
                }
                
                const photoId = photoIdMatch[1];
                
                // 检查该 photoId 是否已存在（可能在其他状态，包括已删除的）
                const { data: existingPhoto } = await supabase
                  .from('photos')
                  .select('id, status, deleted_at')
                  .eq('id', photoId)
                  .single();
                
                // 如果照片已删除，跳过（不恢复已删除的照片）
                if (existingPhoto && existingPhoto.deleted_at) {
                  continue;
                }
                
                if (existingPhoto) {
                  // 如果记录存在但 original_key 不匹配，更新它
                  if (existingPhoto.status !== 'pending' && existingPhoto.status !== 'processing') {
                    // 更新为 pending 并重新处理
                    await supabase
                      .from('photos')
                      .update({ 
                        status: 'pending',
                        original_key: file.key,
                      })
                      .eq('id', photoId);
                    
                    await photoQueue.add('process-photo', {
                      photoId,
                      albumId,
                    originalKey: file.key,
                  });
                  orphanedFilesCount++;
                  }
                  continue;
                }
                
                // 创建新的数据库记录
                const { error: insertError } = await supabase
                  .from('photos')
                  .insert({
                    id: photoId,
                    album_id: albumId,
                    original_key: file.key,
                    filename: filename,
                    file_size: file.size,
                    status: 'pending',
                  });
                
                if (insertError) {
                  console.error(`❌ Failed to insert orphaned file ${file.key}:`, insertError);
                  continue;
                }
                
                // 加入处理队列
                await photoQueue.add('process-photo', {
                  photoId,
                  albumId,
                  originalKey: file.key,
                });
                
                orphanedFilesCount++;
              } catch (err: any) {
                console.error(`❌ Error recovering orphaned file ${file.key}:`, err.message);
              }
            }
          }
        }
      } catch (err: any) {
        console.error('❌ Error checking orphaned files:', err.message);
        // 不抛出错误，继续返回其他结果
      }
    }
    
    return {
      processed: processedCount,
      requeued: requeuedCount,
      cleaned: cleanedCount,
      stuckReset: stuckResetCount,
      orphaned: orphanedFilesCount,
    };
  } catch (err: any) {
    console.error('❌ Error during pending photo check:', err);
    throw err;
  }
}

/**
 * 检查文件是否存在于存储中
 */
async function checkFileExists(key: string): Promise<boolean> {
  try {
    const adapter = getStorageAdapter();
    return await adapter.exists(key);
  } catch (err: any) {
    // 如果检查出错，保守地返回 false
    console.warn(`⚠️ Error checking file existence for ${key}:`, err.message);
    return false;
  }
}

// ============================================
// 回收站清理：删除超过保留期的已删除照片的 MinIO 文件
// ============================================
async function cleanupDeletedPhotos() {
  try {
    // 1. 查询所有 deleted_at 不为空且超过保留期的照片
    const retentionDays = CONFIG.DELETED_PHOTO_RETENTION_DAYS;
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - retentionDays);
    const retentionDateISO = retentionDate.toISOString();
    
    const { data: deletedPhotos, error } = await supabase
      .from('photos')
      .select('id, album_id, original_key, thumb_key, preview_key, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', retentionDateISO)
      .limit(100); // 每次最多处理 100 张
    
    if (error) {
      console.error('❌ Failed to query deleted photos:', error);
      return;
    }
    
    if (!deletedPhotos || deletedPhotos.length === 0) {
      return;
    }
    
    let filesDeletedCount = 0;
    let recordsDeletedCount = 0;
    let errorCount = 0;
    
    // 获取媒体服务器 URL（用于构建图片 URL）
    const mediaUrl = process.env.STORAGE_PUBLIC_URL || process.env.MINIO_PUBLIC_URL || process.env.NEXT_PUBLIC_MEDIA_URL;
    
    // 2. 删除每张照片的 MinIO 文件，然后删除数据库记录
    for (const photo of deletedPhotos) {
      try {
        const filesToDelete: string[] = [];
        if (photo.original_key) filesToDelete.push(photo.original_key);
        if (photo.thumb_key) filesToDelete.push(photo.thumb_key);
        if (photo.preview_key) filesToDelete.push(photo.preview_key);
        
        // 删除 MinIO 文件
        for (const key of filesToDelete) {
          try {
            await deleteFile(key);
            filesDeletedCount++;
          } catch (deleteErr: any) {
            // 文件不存在时也继续（可能已经被清理）
            if (deleteErr?.code !== 'NoSuchKey' && !deleteErr?.message?.includes('does not exist')) {
              console.warn(`⚠️ Failed to delete file ${key}:`, deleteErr.message);
            }
          }
        }
        
        // 清除 Cloudflare CDN 缓存（如果配置了）
        // 注意：即使清除失败也不阻止删除操作
        if (mediaUrl) {
          try {
            await purgePhotoCache(mediaUrl, {
              original_key: photo.original_key,
              thumb_key: photo.thumb_key,
              preview_key: photo.preview_key,
            }).catch((purgeError) => {
              // 记录错误但不抛出（不影响删除操作）
              console.warn(`[Cleanup Deleted Photos] Failed to purge CDN cache for photo ${photo.id}:`, purgeError);
            });
          } catch (purgeError) {
            console.warn(`[Cleanup Deleted Photos] Error purging CDN cache for photo ${photo.id}:`, purgeError);
          }
        }
        
        // 删除数据库记录
        const { error: deleteError } = await supabase
          .from('photos')
          .delete()
          .eq('id', photo.id);
        
        if (deleteError) {
          console.error(`❌ Failed to delete record for photo ${photo.id}:`, deleteError);
          errorCount++;
        } else {
          recordsDeletedCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error cleaning up photo ${photo.id}:`, err.message);
        errorCount++;
      }
    }
  } catch (err: any) {
    console.error('❌ Error during deleted photo cleanup:', err);
  }
}

let recoveryTimeout: NodeJS.Timeout | null = null;
let deletedPhotoCleanupInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// 优雅退出函数
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  // 清理恢复定时器
  if (recoveryTimeout) {
    clearTimeout(recoveryTimeout);
    recoveryTimeout = null;
  }
  
  // 清理回收站定时器
  if (deletedPhotoCleanupInterval) {
    clearInterval(deletedPhotoCleanupInterval);
    deletedPhotoCleanupInterval = null;
  }
  
  // 停止接受新请求
  server.close(() => {
    // HTTP server closed
  });
  
  // 清理缓存定时器
  destroyAlbumCache();
  
  // 等待正在处理的任务完成（设置超时，避免无限等待）
  const shutdownPromise = Promise.all([
    worker.close(),
    packageWorker.close(),
    photoQueue.close(),
    packageQueue.close(),
    ftpServerService.stop(),
  ]);
  
  try {
    await Promise.race([
      shutdownPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Shutdown timeout')), CONFIG.SHUTDOWN_TIMEOUT_MS)
      )
    ]);
  } catch (err: any) {
    if (err.message === 'Shutdown timeout') {
      console.warn('⚠️ Shutdown timeout, forcing exit');
    } else {
      console.error('❌ Error closing workers:', err);
    }
  }
  
  process.exit(0);
}

// 监听退出信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 处理未捕获异常
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // 不立即退出，记录错误即可
});

// 配置服务器 keep-alive
server.keepAliveTimeout = 65000; // 65秒（略大于 Cloudflare 的 60 秒）
server.headersTimeout = 66000; // 66秒（略大于 keepAliveTimeout）

server.listen(HTTP_PORT, async () => {
  // 确保 MinIO bucket 存在（仅在 MinIO 存储类型时）
  try {
    const storageType = process.env.STORAGE_TYPE || 'minio';
    if (storageType === 'minio') {
      const storage = getStorageAdapter();
      if (typeof (storage as any).ensureBucket === 'function') {
        await (storage as any).ensureBucket();
      }
    }
  } catch (err: any) {
    console.error('❌ Failed to ensure storage bucket:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    // 不阻止服务启动，但记录错误
  }
  
  // 启动 FTP 服务
  try {
    await ftpServerService.start();
  } catch (err: any) {
    console.error('❌ Failed to start FTP server:', err.message);
  }

  // 启动后延迟5秒执行恢复（等待服务完全启动）
  recoveryTimeout = setTimeout(() => {
    recoverStuckProcessingPhotos();
    recoveryTimeout = null;
  }, 5000);
  
  // 启动回收站清理定时任务（首次延迟10秒，之后每小时执行一次）
  setTimeout(() => {
    cleanupDeletedPhotos(); // 立即执行一次
    deletedPhotoCleanupInterval = setInterval(() => {
      cleanupDeletedPhotos();
    }, CONFIG.DELETED_PHOTO_CLEANUP_INTERVAL_MS);
  }, 10000);
});
