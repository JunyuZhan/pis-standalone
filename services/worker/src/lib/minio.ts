/**
 * @fileoverview MinIO 客户端配置
 *
 * 配置 MinIO/S3 兼容存储客户端，提供文件上传、下载和预签名 URL 功能。
 * 支持内网和外网双客户端，确保预签名 URL 正确。
 *
 * @module lib/minio
 *
 * @example
 * ```typescript
 * import {
 *   downloadFile,
 *   uploadFile,
 *   getPresignedPutUrl,
 *   getPresignedGetUrl
 * } from '@/lib/minio'
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

import * as Minio from 'minio'

/**
 * 内网 MinIO 客户端
 *
 * @description
 * 用于实际上传/下载操作。
 *
 * 环境变量：
 * - MINIO_ENDPOINT_HOST: MinIO 主机（默认 localhost）
 * - MINIO_ENDPOINT_PORT: MinIO 端口（默认 9000）
 * - MINIO_USE_SSL: 是否使用 SSL
 * - MINIO_ACCESS_KEY: 访问密钥
 * - MINIO_SECRET_KEY: 密钥
 */
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT_HOST || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'password123',
})

/**
 * 创建公网 MinIO 客户端
 *
 * @description
 * 从 MINIO_PUBLIC_URL 环境变量解析公网地址。
 * 用于生成预签名 URL，确保签名匹配公网地址。
 *
 * @returns {Minio.Client | null} MinIO 客户端实例，未配置返回 null
 */
function createPublicMinioClient(): Minio.Client | null {
  const publicUrl = process.env.MINIO_PUBLIC_URL
  if (!publicUrl) return null

  try {
    const url = new URL(publicUrl)
    return new Minio.Client({
      endPoint: url.hostname,
      port: url.port
        ? parseInt(url.port)
        : (url.protocol === 'https:' ? 443 : 80),
      useSSL: url.protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
      secretKey: process.env.MINIO_SECRET_KEY || 'password123',
    })
  } catch (e) {
    console.warn('Failed to create public MinIO client:', e)
    return null
  }
}

/** 公网 MinIO 客户端（用于生成预签名 URL） */
const publicMinioClient = createPublicMinioClient()

/** 存储桶名称（从环境变量读取，默认 pis-photos） */
export const bucketName =
  process.env.MINIO_BUCKET || 'pis-photos'

/**
 * 获取 MinIO 客户端实例
 *
 * @returns {Minio.Client} 内网 MinIO 客户端
 */
export function getMinioClient(): Minio.Client {
  return minioClient
}

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
  const stream = await minioClient.getObject(bucketName, key)
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', (err) => reject(err))
  })
}

/**
 * 上传文件
 *
 * @param {string} key - 文件键值
 * @param {Buffer} buffer - 文件内容
 * @param {Record<string, string>} [metaData={}] - 元数据
 * @returns {Promise<{ etag: string; versionId: string | null }>} 上传结果
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
): Promise<{ etag: string; versionId: string | null }> {
  return minioClient.putObject(bucketName, key, buffer, buffer.length, metaData)
}

/** uploadBuffer 是 uploadFile 的别名 */
export const uploadBuffer = uploadFile

/**
 * 生成预签名上传 URL
 *
 * @description
 * 使用公网客户端生成签名，确保 URL 可从公网访问。
 *
 * @param {string} key - 文件键值
 * @param {number} [expirySeconds=3600] - 过期时间（秒）
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
  // 优先使用公网客户端（签名会基于公网地址生成）
  const client = publicMinioClient || minioClient
  return client.presignedPutObject(bucketName, key, expirySeconds)
}

/**
 * 生成预签名下载 URL
 *
 * @description
 * 使用公网客户端生成签名，确保 URL 可从公网访问。
 *
 * @param {string} key - 文件键值
 * @param {number} [expirySeconds=3600] - 过期时间（秒）
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
  const client = publicMinioClient || minioClient
  return client.presignedGetObject(bucketName, key, expirySeconds)
}

// ============================================
// 分片上传 API
// ============================================

/**
 * 初始化分片上传
 *
 * @param {string} key - 文件键值
 * @returns {Promise<string>} 上传 ID
 *
 * @example
 * ```typescript
 * const uploadId = await initMultipartUpload('large-file.jpg')
 * ```
 */
export async function initMultipartUpload(key: string): Promise<string> {
  // MinIO SDK 不直接暴露 initiateMultipartUpload，使用底层 API
  const client = minioClient as any
  return new Promise((resolve, reject) => {
    client.initiateNewMultipartUpload(
      bucketName,
      key,
      {},
      (err: Error, uploadId: string) => {
        if (err) reject(err)
        else resolve(uploadId)
      }
    )
  })
}

/**
 * 上传单个分片
 *
 * @param {string} key - 文件键值
 * @param {string} uploadId - 上传 ID
 * @param {number} partNumber - 分片编号（从 1 开始）
 * @param {Buffer} buffer - 分片内容
 * @returns {Promise<{ etag: string }>} 分片 ETag
 *
 * @example
 * ```typescript
 * const part = await uploadPart(key, uploadId, 1, chunk)
 * console.log('Part ETag:', part.etag)
 * ```
 */
export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  buffer: Buffer
): Promise<{ etag: string }> {
  const client = minioClient as any
  return new Promise((resolve, reject) => {
    client.uploadPart(
      { bucketName, objectName: key, uploadId, partNumber, headers: {} },
      buffer,
      (err: Error, etag: string) => {
        if (err) reject(err)
        else resolve({ etag })
      }
    )
  })
}

/**
 * 完成分片上传
 *
 * @param {string} key - 文件键值
 * @param {string} uploadId - 上传 ID
 * @param {Array<{ partNumber: number; etag: string }>} parts - 所有分片列表
 * @returns {Promise<void>}
 *
 * @example
 * ```typescript
 * await completeMultipartUpload(key, uploadId, [
 *   { partNumber: 1, etag: 'etag1' },
 *   { partNumber: 2, etag: 'etag2' }
 * ])
 * ```
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<void> {
  const client = minioClient as any
  return new Promise((resolve, reject) => {
    client.completeMultipartUpload(
      bucketName,
      key,
      uploadId,
      parts,
      (err: Error) => {
        if (err) reject(err)
        else resolve()
      }
    )
  })
}

/**
 * 取消分片上传
 *
 * @param {string} key - 文件键值
 * @param {string} uploadId - 上传 ID
 * @returns {Promise<void>}
 *
 * @example
 * ```typescript
 * await abortMultipartUpload(key, uploadId)
 * ```
 */
export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const client = minioClient as any
  return new Promise((resolve, reject) => {
    client.abortMultipartUpload(
      bucketName,
      key,
      uploadId,
      (err: Error) => {
        if (err) reject(err)
        else resolve()
      }
    )
  })
}

/** 默认导出内网 MinIO 客户端 */
export default minioClient
