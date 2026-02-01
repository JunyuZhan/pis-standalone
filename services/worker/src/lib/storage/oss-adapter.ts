/**
 * 阿里云 OSS 存储适配器
 * OSS 兼容 S3 API，使用 MinIO SDK（S3 兼容模式）
 */
import * as Minio from 'minio';
import type { StorageAdapter, StorageConfig, UploadResult, StorageObject } from './types.js';

export class OSSAdapter implements StorageAdapter {
  private client: Minio.Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.customConfig?.publicUrl;

    // 阿里云 OSS 使用 S3 兼容 API
    // endpoint 格式: oss-cn-hangzhou.aliyuncs.com
    const endpoint = config.endpoint || '';
    const isCustomDomain = endpoint.includes('.aliyuncs.com') || endpoint.includes('.oss-');

    this.client = new Minio.Client({
      endPoint: isCustomDomain ? endpoint : `oss-${config.region || 'cn-hangzhou'}.aliyuncs.com`,
      port: config.port || (config.useSSL ? 443 : 80),
      useSSL: config.useSSL ?? true, // OSS 默认使用 HTTPS
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region || 'cn-hangzhou',
    });
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }

  async upload(
    key: string,
    buffer: Buffer,
    metadata: Record<string, string> = {}
  ): Promise<UploadResult> {
    const result = await this.client.putObject(
      this.bucket,
      key,
      buffer,
      buffer.length,
      metadata
    );
    return {
      etag: result.etag,
      versionId: result.versionId,
      url: this.publicUrl ? `${this.publicUrl}/${key}` : undefined,
    };
  }

  async getPresignedPutUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    const url = await this.client.presignedPutObject(
      this.bucket,
      key,
      expirySeconds
    );
    return this.toPublicUrl(url);
  }

  async getPresignedGetUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    const url = await this.client.presignedGetObject(
      this.bucket,
      key,
      expirySeconds
    );
    return this.toPublicUrl(url);
  }

  async initMultipartUpload(key: string): Promise<string> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.initiateNewMultipartUpload(
        this.bucket,
        key,
        {},
        (err: Error, uploadId: string) => {
          if (err) reject(err);
          else resolve(uploadId);
        }
      );
    });
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer
  ): Promise<{ etag: string }> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.uploadPart(
        {
          bucketName: this.bucket,
          objectName: key,
          uploadId,
          partNumber,
          headers: {},
        },
        buffer,
        (err: Error, etag: string) => {
          if (err) reject(err);
          else resolve({ etag });
        }
      );
    });
  }

  async getPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expirySeconds = 3600
  ): Promise<string> {
    // OSS 使用 MinIO SDK（S3 兼容），但 MinIO SDK 不直接支持分片上传的 presigned URL
    // 需要使用 AWS SDK 的方式，但 OSS 适配器目前使用 MinIO SDK
    // 暂时抛出错误，提示使用 MinIO 存储或通过 Worker 上传
    throw new Error('OSS adapter does not support presigned part URLs. Please use MinIO storage or upload through Worker API.');
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.completeMultipartUpload(
        this.bucket,
        key,
        uploadId,
        parts,
        (err: Error) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const client = this.client as any;
    return new Promise((resolve, reject) => {
      client.abortMultipartUpload(
        this.bucket,
        key,
        uploadId,
        (err: Error) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async listObjects(prefix: string): Promise<StorageObject[]> {
    const objects: StorageObject[] = [];
    const stream = this.client.listObjectsV2(this.bucket, prefix, true);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          objects.push({
            key: obj.name,
            size: obj.size || 0,
            lastModified: obj.lastModified || new Date(),
            etag: obj.etag || '',
          });
        }
      });
      stream.on('end', () => resolve(objects));
      stream.on('error', (err) => reject(err));
    });
  }

  async copy(srcKey: string, destKey: string): Promise<void> {
    try {
      const source = `/${this.bucket}/${srcKey}`;
      await this.client.copyObject(
        this.bucket,
        destKey,
        source
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[OSS] Error copying ${srcKey} to ${destKey}:`, errorMessage);
      throw new Error(`Failed to copy object: ${errorMessage}`);
    }
  }

  private toPublicUrl(url: string): string {
    if (!this.publicUrl) return url;
    const match = url.match(/https?:\/\/([^\/]+)/);
    if (match) {
      return url.replace(match[0], this.publicUrl);
    }
    return url;
  }
}
