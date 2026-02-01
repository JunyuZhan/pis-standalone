/**
 * @fileoverview 存储抽象层类型定义
 *
 * 定义了对象存储适配器的统一接口，支持多种对象存储后端：
 * MinIO、阿里云 OSS、腾讯云 COS、AWS S3 等。
 *
 * @module lib/storage/types
 *
 * @example
 * ```typescript
 * import { createStorageAdapter, type StorageAdapter } from './storage'
 *
 * const storage: StorageAdapter = createStorageAdapter({
 *   type: 'minio',
 *   endpoint: 'localhost',
 *   port: 9000,
 *   accessKey: 'minioadmin',
 *   secretKey: 'minioadmin',
 *   bucket: 'photos'
 * })
 *
 * await storage.upload('photo.jpg', buffer)
 * ```
 */

/**
 * 存储配置接口
 *
 * @interface
 * @description
 * 定义对象存储的连接配置。
 * 不同存储类型可能需要不同的配置项。
 *
 * @property {'minio' | 'oss' | 'cos' | 's3' | 'custom'} type - 存储类型
 * @property {string} [endpoint] - 服务端点（域名或 IP）
 * @property {number} [port] - 服务端口
 * @property {boolean} [useSSL] - 是否使用 SSL (HTTPS)
 * @property {string} accessKey - 访问密钥 ID
 * @property {string} secretKey - 访问密钥 Secret
 * @property {string} bucket - 存储桶名称
 * @property {string} [region] - 区域（如 oss-cn-hangzhou）
 * @property {Object} [customConfig] - 自定义配置
 * @property {string} [customConfig.publicUrl] - 公共访问 URL
 *
 * @example
 * ```typescript
 * const minioConfig: StorageConfig = {
 *   type: 'minio',
 *   endpoint: 'localhost',
 *   port: 9000,
 *   useSSL: false,
 *   accessKey: 'minioadmin',
 *   secretKey: 'minioadmin',
 *   bucket: 'pis-photos'
 * }
 * ```
 */
export interface StorageConfig {
  /** 存储类型 */
  type: 'minio' | 'oss' | 'cos' | 's3' | 'custom'
  /** 服务端点（域名或IP） */
  endpoint?: string
  /** 服务端口 */
  port?: number
  /** 是否使用 SSL (HTTPS) */
  useSSL?: boolean
  /** 访问密钥 ID */
  accessKey: string
  /** 访问密钥 Secret */
  secretKey: string
  /** 存储桶名称 */
  bucket: string
  /** 区域（Region，如 oss-cn-hangzhou） */
  region?: string
  /** 自定义配置（适配器特定） */
  customConfig?: {
    /** 公共访问 URL */
    publicUrl?: string
    [key: string]: unknown
  }
}

/**
 * 文件上传结果接口
 *
 * @interface
 * @property {string} etag - 文件的 ETag (通常是 MD5)
 * @property {string|null} [versionId] - 版本 ID (版本控制开启时)
 * @property {string} [url] - 文件的访问 URL
 */
export interface UploadResult {
  /** 文件的 ETag (通常是 MD5) */
  etag: string
  /** 版本 ID (如果开启了版本控制) */
  versionId?: string | null
  /** 文件的访问 URL (可选) */
  url?: string
}

/**
 * 存储对象元数据接口
 *
 * @interface
 * @property {string} key - 对象键值 (路径)
 * @property {number} size - 文件大小 (字节)
 * @property {Date} lastModified - 最后修改时间
 * @property {string} etag - 对象的 ETag
 */
export interface StorageObject {
  /** 对象键值 (路径) */
  key: string
  /** 文件大小 (字节) */
  size: number
  /** 最后修改时间 */
  lastModified: Date
  /** 对象的 ETag */
  etag: string
}

/**
 * 存储适配器接口
 *
 * @interface
 * @description
 * 定义所有存储后端必须实现的统一方法。
 * 实现此接口以支持新的对象存储服务。
 */
export interface StorageAdapter {
  /**
   * 下载文件
   *
   * @param {string} key - 文件键值
   * @returns {Promise<Buffer>} 文件内容 Buffer
   */
  download(key: string): Promise<Buffer>

  /**
   * 上传文件
   *
   * @param {string} key - 文件键值
   * @param {Buffer} buffer - 文件内容 Buffer
   * @param {Record<string, string>} [metadata] - 自定义元数据
   * @returns {Promise<UploadResult>} 上传结果
   */
  upload(
    key: string,
    buffer: Buffer,
    metadata?: Record<string, string>
  ): Promise<UploadResult>

  /**
   * 生成预签名上传 URL
   *
   * @param {string} key - 文件键值
   * @param {number} [expirySeconds] - 过期时间（秒）
   * @returns {Promise<string>} 预签名 URL
   */
  getPresignedPutUrl(key: string, expirySeconds?: number): Promise<string>

  /**
   * 生成预签名下载 URL
   *
   * @param {string} key - 文件键值
   * @param {number} [expirySeconds] - 过期时间（秒）
   * @returns {Promise<string>} 预签名 URL
   */
  getPresignedGetUrl(key: string, expirySeconds?: number): Promise<string>

  /**
   * 初始化分片上传
   *
   * @param {string} key - 文件键值
   * @returns {Promise<string>} 上传 ID (UploadId)
   */
  initMultipartUpload(key: string): Promise<string>

  /**
   * 上传分片
   *
   * @param {string} key - 文件键值
   * @param {string} uploadId - 上传 ID
   * @param {number} partNumber - 分片编号 (从 1 开始)
   * @param {Buffer} buffer - 分片内容
   * @returns {Promise<{ etag: string }>} 分片 ETag
   */
  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer
  ): Promise<{ etag: string }>

  /**
   * 生成分片的预签名上传 URL
   *
   * @description
   * 用于客户端直接上传分片到存储服务。
   *
   * @param {string} key - 文件键值
   * @param {string} uploadId - 上传 ID
   * @param {number} partNumber - 分片编号
   * @param {number} [expirySeconds] - 过期时间
   * @returns {Promise<string>} 预签名 URL
   */
  getPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expirySeconds?: number
  ): Promise<string>

  /**
   * 完成分片上传
   *
   * @param {string} key - 文件键值
   * @param {string} uploadId - 上传 ID
   * @param {Array<{ partNumber: number; etag: string }>} parts - 所有分片列表
   * @returns {Promise<void>}
   */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void>

  /**
   * 取消分片上传
   *
   * @param {string} key - 文件键值
   * @param {string} uploadId - 上传 ID
   * @returns {Promise<void>}
   */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>

  /**
   * 删除文件
   *
   * @param {string} key - 文件键值
   * @returns {Promise<void>}
   */
  delete(key: string): Promise<void>

  /**
   * 检查文件是否存在
   *
   * @param {string} key - 文件键值
   * @returns {Promise<boolean>} 文件存在返回 true
   */
  exists(key: string): Promise<boolean>

  /**
   * 列出指定前缀下的所有对象
   *
   * @param {string} prefix - 前缀路径，如 "sync/album-uuid/"
   * @returns {Promise<StorageObject[]>} 对象列表
   */
  listObjects(prefix: string): Promise<StorageObject[]>

  /**
   * 确保 bucket 存在，如果不存在则创建（可选方法）
   *
   * @description
   * 某些存储适配器（如 MinIO）支持在启动时自动创建 bucket。
   * 如果适配器不支持此功能，可以忽略此方法。
   *
   * @returns {Promise<void>}
   */
  ensureBucket?(): Promise<void>

  /**
   * 复制对象
   *
   * @description
   * 用于移动文件到新路径。
   *
   * @param {string} srcKey - 源路径
   * @param {string} destKey - 目标路径
   * @returns {Promise<void>}
   */
  copy(srcKey: string, destKey: string): Promise<void>
}
