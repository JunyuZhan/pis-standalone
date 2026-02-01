/**
 * @fileoverview 存储抽象层工厂
 *
 * 根据配置自动选择并创建存储适配器实例。
 * 支持 MinIO、阿里云 OSS、腾讯云 COS、AWS S3 等多种存储后端。
 *
 * @module lib/storage/index
 *
 * @example
 * ```typescript
 * import {
 *   getStorageAdapter,
 *   uploadFile,
 *   downloadFile,
 *   getPresignedPutUrl
 * } from '@/lib/storage'
 *
 * // 上传文件
 * await uploadFile('photos/image.jpg', buffer, { contentType: 'image/jpeg' })
 *
 * // 下载文件
 * const buffer = await downloadFile('photos/image.jpg')
 *
 * // 生成预签名 URL
 * const url = await getPresignedPutUrl('uploads/new.jpg', 3600)
 * ```
 */

import type { StorageAdapter, StorageConfig } from './types.js'
import { MinIOAdapter } from './minio-adapter.js'
import { OSSAdapter } from './oss-adapter.js'
import { COSAdapter } from './cos-adapter.js'

let storageAdapter: StorageAdapter | null = null

/**
 * 从环境变量创建存储配置
 *
 * @description
 * 读取以下环境变量构建配置：
 * - STORAGE_TYPE: 存储类型（默认 minio）
 * - STORAGE_ENDPOINT / MINIO_ENDPOINT_HOST: 服务端点
 * - STORAGE_PORT / MINIO_ENDPOINT_PORT: 服务端口
 * - STORAGE_USE_SSL / MINIO_USE_SSL: 是否使用 SSL
 * - STORAGE_ACCESS_KEY / MINIO_ACCESS_KEY: 访问密钥
 * - STORAGE_SECRET_KEY / MINIO_SECRET_KEY: 密钥
 * - STORAGE_BUCKET / MINIO_BUCKET: 存储桶名称
 * - STORAGE_PUBLIC_URL / MINIO_PUBLIC_URL: 公共访问 URL
 *
 * @returns {StorageConfig} 存储配置对象
 *
 * @example
 * ```typescript
 * const config = getStorageConfigFromEnv()
 * console.log('存储类型:', config.type)
 * ```
 */
function getStorageConfigFromEnv(): StorageConfig {
  const type = (process.env.STORAGE_TYPE || 'minio') as StorageConfig['type']

  return {
    type,
    endpoint:
      process.env.STORAGE_ENDPOINT || process.env.MINIO_ENDPOINT_HOST,
    port: process.env.STORAGE_PORT
      ? parseInt(process.env.STORAGE_PORT)
      : process.env.MINIO_ENDPOINT_PORT
        ? parseInt(process.env.MINIO_ENDPOINT_PORT)
        : undefined,
    useSSL:
      process.env.STORAGE_USE_SSL === 'true' ||
      process.env.MINIO_USE_SSL === 'true',
    accessKey:
      process.env.STORAGE_ACCESS_KEY ||
      process.env.MINIO_ACCESS_KEY ||
      '',
    secretKey:
      process.env.STORAGE_SECRET_KEY ||
      process.env.MINIO_SECRET_KEY ||
      '',
    bucket:
      process.env.STORAGE_BUCKET || process.env.MINIO_BUCKET || 'pis-photos',
    region: process.env.STORAGE_REGION,
    customConfig: {
      // 优先使用 MINIO_PUBLIC_URL（用于 presigned URL，客户端直接上传）
      // 如果没有配置，才使用 STORAGE_PUBLIC_URL（用于读取文件，通过代理）
      publicUrl:
        process.env.MINIO_PUBLIC_URL || process.env.STORAGE_PUBLIC_URL,
    },
  }
}

/**
 * 创建存储适配器实例
 *
 * @description
 * 根据配置的类型返回相应的存储适配器实例。
 *
 * @param {StorageConfig} [config] - 可选的存储配置，默认从环境变量读取
 * @returns {StorageAdapter} 存储适配器实例
 * @throws {Error} 如果存储类型不支持则抛出错误
 *
 * @example
 * ```typescript
 * // 使用环境变量配置
 * const storage = createStorageAdapter()
 *
 * // 使用自定义配置
 * const storage = createStorageAdapter({
 *   type: 'minio',
 *   endpoint: 'localhost',
 *   port: 9000,
 *   accessKey: 'key',
 *   secretKey: 'secret',
 *   bucket: 'photos'
 * })
 * ```
 */
export function createStorageAdapter(config?: StorageConfig): StorageAdapter {
  const finalConfig = config || getStorageConfigFromEnv()

  switch (finalConfig.type) {
    case 'minio':
      return new MinIOAdapter(finalConfig)
    case 'oss':
      return new OSSAdapter(finalConfig)
    case 'cos':
      return new COSAdapter(finalConfig)
    case 's3':
      // AWS S3 也使用 MinIO SDK（S3 兼容）
      return new MinIOAdapter({
        ...finalConfig,
        endpoint:
          finalConfig.endpoint ||
          `s3.${finalConfig.region || 'us-east-1'}.amazonaws.com`,
      })
    default:
      throw new Error(`Unsupported storage type: ${finalConfig.type}`)
  }
}

/**
 * 获取单例存储适配器
 *
 * @description
 * 返回全局唯一的存储适配器实例，首次调用时创建。
 *
 * @returns {StorageAdapter} 存储适配器实例
 *
 * @example
 * ```typescript
 * const storage = getStorageAdapter()
 * await storage.upload('file.jpg', buffer)
 * ```
 */
export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    storageAdapter = createStorageAdapter()
  }
  return storageAdapter
}

// ============================================
// 便捷函数
// ============================================

/** 存储桶名称（从环境变量读取） */
export const bucketName =
  process.env.STORAGE_BUCKET || process.env.MINIO_BUCKET || 'pis-photos'

/**
 * 下载文件
 *
 * @param {string} key - 文件键值
 * @returns {Promise<Buffer>} 文件内容 Buffer
 *
 * @example
 * ```typescript
 * const buffer = await downloadFile('photos/image.jpg')
 * ```
 */
export async function downloadFile(key: string): Promise<Buffer> {
  return getStorageAdapter().download(key)
}

/**
 * 上传文件
 *
 * @param {string} key - 文件键值
 * @param {Buffer} buffer - 文件内容 Buffer
 * @param {Record<string, string>} [metaData] - 元数据
 * @returns {Promise<UploadResult>} 上传结果
 *
 * @example
 * ```typescript
 * const result = await uploadFile(
 *   'photos/image.jpg',
 *   buffer,
 *   { contentType: 'image/jpeg' }
 * )
 * console.log('ETag:', result.etag)
 * ```
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  metaData: Record<string, string> = {}
) {
  return getStorageAdapter().upload(key, buffer, metaData)
}

/** uploadBuffer 是 uploadFile 的别名 */
export const uploadBuffer = uploadFile

/**
 * 获取预签名上传 URL
 *
 * @param {string} key - 文件键值
 * @param {number} [expirySeconds=3600] - 过期时间（秒），默认 3600
 * @returns {Promise<string>} 预签名上传 URL
 *
 * @example
 * ```typescript
 * const url = await getPresignedPutUrl('uploads/new.jpg', 1800)
 * // 客户端使用此 URL 直接上传
 * ```
 */
export async function getPresignedPutUrl(
  key: string,
  expirySeconds = 3600
): Promise<string> {
  return getStorageAdapter().getPresignedPutUrl(key, expirySeconds)
}

/**
 * 获取预签名下载 URL
 *
 * @param {string} key - 文件键值
 * @param {number} [expirySeconds=3600] - 过期时间（秒），默认 3600
 * @returns {Promise<string>} 预签名下载 URL
 *
 * @example
 * ```typescript
 * const url = await getPresignedGetUrl('private/photo.jpg', 600)
 * // 返回的 URL 可用于临时访问私有文件
 * ```
 */
export async function getPresignedGetUrl(
  key: string,
  expirySeconds = 3600
): Promise<string> {
  return getStorageAdapter().getPresignedGetUrl(key, expirySeconds)
}

/**
 * 初始化分片上传
 *
 * @param {string} key - 文件键值
 * @returns {Promise<string>} 上传 ID
 */
export async function initMultipartUpload(key: string): Promise<string> {
  return getStorageAdapter().initMultipartUpload(key)
}

/**
 * 上传分片
 *
 * @param {string} key - 文件键值
 * @param {string} uploadId - 上传 ID
 * @param {number} partNumber - 分片编号
 * @param {Buffer} buffer - 分片内容
 * @returns {Promise<{ etag: string }>} 分片 ETag
 */
export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  buffer: Buffer
): Promise<{ etag: string }> {
  return getStorageAdapter().uploadPart(key, uploadId, partNumber, buffer)
}

/**
 * 生成分片的预签名上传 URL
 *
 * @param {string} key - 文件键值
 * @param {string} uploadId - 上传 ID
 * @param {number} partNumber - 分片编号
 * @param {number} [expirySeconds=3600] - 过期时间
 * @returns {Promise<string>} 预签名 URL
 */
export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expirySeconds = 3600
): Promise<string> {
  return getStorageAdapter().getPresignedPartUrl(
    key,
    uploadId,
    partNumber,
    expirySeconds
  )
}

/**
 * 完成分片上传
 *
 * @param {string} key - 文件键值
 * @param {string} uploadId - 上传 ID
 * @param {Array<{ partNumber: number; etag: string }>} parts - 所有分片列表
 * @returns {Promise<void>}
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<void> {
  return getStorageAdapter().completeMultipartUpload(key, uploadId, parts)
}

/**
 * 取消分片上传
 *
 * @param {string} key - 文件键值
 * @param {string} uploadId - 上传 ID
 * @returns {Promise<void>}
 */
export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  return getStorageAdapter().abortMultipartUpload(key, uploadId)
}

/**
 * 列出指定前缀下的对象
 *
 * @param {string} prefix - 前缀路径
 * @returns {Promise<StorageObject[]>} 对象列表
 */
export async function listObjects(prefix: string) {
  return getStorageAdapter().listObjects(prefix)
}

/**
 * 复制文件
 *
 * @param {string} srcKey - 源路径
 * @param {string} destKey - 目标路径
 * @returns {Promise<void>}
 */
export async function copyFile(srcKey: string, destKey: string): Promise<void> {
  return getStorageAdapter().copy(srcKey, destKey)
}

/**
 * 删除文件
 *
 * @param {string} key - 文件键值
 * @returns {Promise<void>}
 */
export async function deleteFile(key: string): Promise<void> {
  return getStorageAdapter().delete(key)
}

// ============================================
// 导出类型和适配器类
// ============================================

/**
 * 导出类型和适配器类（供高级用法）
 */
export * from './types.js'
export { MinIOAdapter } from './minio-adapter.js'
export { OSSAdapter } from './oss-adapter.js'
export { COSAdapter } from './cos-adapter.js'

// ============================================
// 兼容旧 API
// ============================================

/**
 * 获取 MinIO 客户端（兼容函数）
 *
 * @description
 * 为了向后兼容保留的函数。
 * 新代码应该使用 `getStorageAdapter()`。
 *
 * @deprecated 使用 getStorageAdapter() 代替
 * @returns {StorageAdapter} 存储适配器实例
 */
export function getMinioClient() {
  // 为了向后兼容，返回存储适配器
  // 注意：新代码应该使用 getStorageAdapter()
  return getStorageAdapter()
}
