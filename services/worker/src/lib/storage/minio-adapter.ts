/**
 * MinIO 存储适配器
 * 
 * 使用 MinIO SDK 进行常规操作，使用 AWS SDK 进行分片上传（S3 兼容）
 */
import * as Minio from 'minio';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageAdapter, StorageConfig, UploadResult, StorageObject } from './types.js';

export class MinIOAdapter implements StorageAdapter {
  private client: Minio.Client;
  private presignClient: Minio.Client; // 专门用于生成 presigned URL 的客户端
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl?: string;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;
  private accessKey: string;
  private secretKey: string;
  private region?: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.customConfig?.publicUrl;
    this.endpoint = config.endpoint || 'localhost';
    this.port = config.port || 9000;
    this.useSSL = config.useSSL ?? false;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.region = config.region;

    // MinIO 客户端用于常规操作（使用内网地址以提高性能）
    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: this.accessKey,
      secretKey: this.secretKey,
      region: this.region,
    });

    // 用于生成 presigned URL 的客户端
    // 始终使用内部 MinIO 客户端生成签名，然后替换 URL 中的主机部分
    // 这样可以避免连接公开 URL 的问题（公开 URL 可能是 Nginx 反向代理）
    this.presignClient = this.client;

    // AWS S3 客户端用于分片上传（MinIO 兼容 S3）
    const s3Endpoint = this.useSSL 
      ? `https://${this.endpoint}:${this.port}`
      : `http://${this.endpoint}:${this.port}`;
    
    this.s3Client = new S3Client({
      endpoint: s3Endpoint,
      region: this.region || 'us-east-1',
      credentials: {
        accessKeyId: this.accessKey,
        secretAccessKey: this.secretKey,
      },
      forcePathStyle: true, // MinIO 需要路径样式
    });
  }

  /**
   * 确保 bucket 存在，如果不存在则创建
   */
  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, this.region || 'us-east-1');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error ensuring bucket ${this.bucket}:`, errorMessage);
      throw new Error(`Failed to ensure bucket: ${errorMessage}`);
    }
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
    };
  }

  async getPresignedPutUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    // 使用 presignClient 生成 URL（如果配置了 publicUrl，签名会基于公网地址）
    const url = await this.presignClient.presignedPutObject(
      this.bucket,
      key,
      expirySeconds
    );
    // 如果 presignClient 已经使用公网地址，就不需要再替换了
    // 但为了兼容性，仍然检查是否需要替换
    return this.toPublicUrl(url);
  }

  async getPresignedGetUrl(
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    // 使用 presignClient 生成 URL（如果配置了 publicUrl，签名会基于公网地址）
    const url = await this.presignClient.presignedGetObject(
      this.bucket,
      key,
      expirySeconds
    );
    // 如果 presignClient 已经使用公网地址，就不需要再替换了
    // 但为了兼容性，仍然检查是否需要替换
    return this.toPublicUrl(url);
  }

  async initMultipartUpload(key: string): Promise<string> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.UploadId) {
        throw new Error('Failed to get upload ID from MinIO');
      }
      
      return response.UploadId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error initiating multipart upload for ${key}:`, errorMessage);
      throw new Error(`Failed to initiate multipart upload: ${errorMessage}`);
    }
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer
  ): Promise<{ etag: string }> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.ETag) {
        throw new Error('Failed to get ETag from MinIO');
      }
      
      // AWS SDK 返回的 ETag 包含引号（如 "abc123"），保留原样用于 completeMultipartUpload
      // 但在返回时移除引号以保持接口一致性
      const etag = response.ETag.replace(/"/g, '');
      
      return { etag };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error uploading part ${partNumber} for ${key}:`, errorMessage);
      throw new Error(`Failed to upload part: ${errorMessage}`);
    }
  }

  async getPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expirySeconds = 3600
  ): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      
      const url = await getSignedUrl(this.s3Client as any, command, { expiresIn: expirySeconds });
      
      // 如果配置了 publicUrl，替换为公网地址
      return this.toPublicUrl(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error generating presigned URL for part ${partNumber} of ${key}:`, errorMessage);
      throw new Error(`Failed to generate presigned URL for part: ${errorMessage}`);
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    try {
      // AWS SDK 需要 Parts 数组格式，ETag 需要包含引号
      const partsArray = parts.map(part => ({
        PartNumber: part.partNumber,
        // 确保 ETag 包含引号（如果还没有的话）
        ETag: part.etag.startsWith('"') ? part.etag : `"${part.etag}"`,
      }));
      
      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: partsArray,
        },
      });
      
      const result = await this.s3Client.send(command);
      
      // 验证文件是否真的存在（等待1秒后检查，因为 MinIO 可能有最终一致性）
      await new Promise(resolve => setTimeout(resolve, 1000));
      const fileExists = await this.exists(key);
      if (!fileExists) {
        console.warn(`[MinIO] ⚠️  Warning: File ${key} does not exist after completeMultipartUpload!`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error completing multipart upload for ${key}:`, errorMessage);
      throw new Error(`Failed to complete multipart upload: ${errorMessage}`);
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      });
      
      await this.s3Client.send(command);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error aborting multipart upload for ${key}:`, errorMessage);
      throw new Error(`Failed to abort multipart upload: ${errorMessage}`);
    }
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
      // MinIO 的 copyObject 需要源对象路径格式为 /bucket/key
      const source = `/${this.bucket}/${srcKey}`;
      await this.client.copyObject(
        this.bucket,
        destKey,
        source
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[MinIO] Error copying ${srcKey} to ${destKey}:`, errorMessage);
      throw new Error(`Failed to copy object: ${errorMessage}`);
    }
  }

  private toPublicUrl(url: string): string {
    if (!this.publicUrl) return url;
    
    try {
      const publicUrlObj = new URL(this.publicUrl);
      const urlObj = new URL(url);
      
      // 替换协议和主机
      urlObj.protocol = publicUrlObj.protocol;
      urlObj.hostname = publicUrlObj.hostname;
      urlObj.port = publicUrlObj.port || '';
      
      // 如果 publicUrl 有路径（例如 /media），则替换 bucket 路径
      // 如果 publicUrl 没有路径（直接指向 MinIO），则保留 bucket 路径
      const bucketPath = `/${this.bucket}/`;
      const publicPath = publicUrlObj.pathname.endsWith('/') 
        ? publicUrlObj.pathname 
        : publicUrlObj.pathname 
          ? `${publicUrlObj.pathname}/`
          : '/';
      
      if (urlObj.pathname.startsWith(bucketPath)) {
        // 如果 publicUrl 有自定义路径（如 /media），替换 bucket 路径
        if (publicPath !== '/') {
          urlObj.pathname = urlObj.pathname.replace(bucketPath, publicPath);
        }
        // 如果 publicUrl 没有路径（直接指向 MinIO），保留 bucket 路径（不做替换）
        // 这样 presigned URL 会保持 /pis-photos/raw/... 格式
      }
      
      return urlObj.toString();
    } catch (e) {
      console.warn('[MinIO] Failed to convert to public URL:', e);
      return url;
    }
  }
}
