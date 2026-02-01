/**
 * 数据一致性检查模块
 *
 * 功能：
 * 1. 检查数据库记录与存储文件的一致性
 * 2. 修复不一致的记录
 * 3. 清理孤儿文件和记录
 *
 * 使用方式：
 * - 手动执行：node scripts/check-consistency.js
 * - API 触发：POST /api/admin/consistency/check
 * - 定时任务：在 Worker 中定期执行
 */

import { getStorageAdapter } from './storage/index.js';
import { getDatabaseAdapter } from './database/index.js';
import { alertService } from './alert.js';

interface PhotoRecord {
  id: string;
  album_id: string;
  filename: string;
  original_key: string | null | undefined;
  thumb_key: string | null | undefined;
  preview_key: string | null | undefined;
  status: string;
}

export interface ConsistencyCheckResult {
  timestamp: string;
  duration: number;
  summary: {
    totalPhotos: number;
    consistentPhotos: number;
    inconsistentRecords: number;
    orphanedFiles: number;
    orphanedRecords: number;
  };
  details: {
    inconsistentPhotos: Array<{
      photoId: string;
      albumId: string;
      filename: string;
      issue: string;
      action: string;
    }>;
    orphanedFiles: Array<{
      key: string;
      size: number;
      lastModified: Date;
    }>;
  };
  errors?: string[];
}

export interface ConsistencyCheckOptions {
  /**
   * 是否自动修复不一致的记录
   */
  autoFix?: boolean;
  /**
   * 是否删除孤儿文件（数据库中没有记录的文件）
   */
  deleteOrphanedFiles?: boolean;
  /**
   * 是否删除孤儿记录（存储中没有文件的记录）
   */
  deleteOrphanedRecords?: boolean;
  /**
   * 每批检查的照片数量
   */
  batchSize?: number;
  /**
   * 是否在发现问题时发送告警
   */
  sendAlerts?: boolean;
}

/**
 * 数据一致性检查类
 */
export class ConsistencyChecker {
  private db = getDatabaseAdapter();
  private storage = getStorageAdapter();
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  /**
   * 执行一致性检查
   */
  async check(options: ConsistencyCheckOptions = {}): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    const {
      autoFix = false,
      deleteOrphanedFiles = false,
      deleteOrphanedRecords = false,
      batchSize = 100,
      sendAlerts = true,
    } = options;

    const result: ConsistencyCheckResult = {
      timestamp: new Date().toISOString(),
      duration: 0,
      summary: {
        totalPhotos: 0,
        consistentPhotos: 0,
        inconsistentRecords: 0,
        orphanedFiles: 0,
        orphanedRecords: 0,
      },
      details: {
        inconsistentPhotos: [],
        orphanedFiles: [],
      },
      errors: [],
    };

    try {
      // 1. 获取所有照片记录
      const photosResult = await this.db.findMany<PhotoRecord>('photos', {
        deleted_at: null,
      }, {
        select: ['id', 'album_id', 'filename', 'original_key', 'thumb_key', 'preview_key', 'status'],
        orderBy: [{ column: 'created_at', direction: 'desc' }],
      });

      if (photosResult.error) {
        throw new Error(`Failed to fetch photos: ${photosResult.error.message}`);
      }

      const photos = photosResult.data || [];

      result.summary.totalPhotos = photos?.length || 0;

      if (!photos || photos.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      // 2. 分批检查照片记录与存储文件的一致性
      const inconsistentPhotos: ConsistencyCheckResult['details']['inconsistentPhotos'] = [];

      for (let i = 0; i < photos.length; i += batchSize) {
        const batch = photos.slice(i, i + batchSize);

        // 并行检查批次中的照片
        const batchResults = await Promise.all(
          batch.map(async (photo) => {
            const issues: string[] = [];
            let action = 'none';

            // 检查原图是否存在
            if (photo.original_key) {
              const originalExists = await this.storage.exists(photo.original_key);
              if (!originalExists) {
                issues.push('original_missing');
              }
            }

            // 检查缩略图是否存在（仅对已完成状态的照片）
            if (photo.status === 'completed' && photo.thumb_key) {
              const thumbExists = await this.storage.exists(photo.thumb_key);
              if (!thumbExists) {
                issues.push('thumb_missing');
              }
            }

            // 检查预览图是否存在（仅对已完成状态的照片）
            if (photo.status === 'completed' && photo.preview_key) {
              const previewExists = await this.storage.exists(photo.preview_key);
              if (!previewExists) {
                issues.push('preview_missing');
              }
            }

            // 如果有问题，记录并尝试修复
            if (issues.length > 0) {
              const issueSummary = issues.join(', ');

              // 根据问题类型决定处理方式
              if (autoFix) {
                if (photo.status === 'pending' && issues.includes('original_missing')) {
                  // pending 状态但原图缺失 = 上传失败，删除记录
                  await this.db.delete('photos', { id: photo.id });
                  action = 'deleted_orphaned_record';
                  result.summary.orphanedRecords++;
                } else if (photo.status === 'completed') {
                  // completed 状态但文件缺失 = 标记为需要重新处理
                  await this.db.update('photos', { id: photo.id }, { status: 'pending' });
                  action = 'marked_for_reprocessing';
                  result.summary.inconsistentRecords++;
                }
              } else {
                result.summary.inconsistentRecords++;
              }

              return {
                photoId: photo.id,
                albumId: photo.album_id,
                filename: photo.filename,
                issue: issueSummary,
                action,
              };
            }

            result.summary.consistentPhotos++;
            return null;
          })
        );

        // 过滤掉 null 结果
        inconsistentPhotos.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
      }

      result.details.inconsistentPhotos = inconsistentPhotos;

      // 3. 检查孤儿文件（存储中有但数据库没有的文件）
      const orphanedFiles = await this.findOrphanedFiles(photos);
      result.details.orphanedFiles = orphanedFiles.map(f => ({
        key: f.key,
        size: f.size,
        lastModified: f.lastModified,
      }));
      result.summary.orphanedFiles = orphanedFiles.length;

      if (deleteOrphanedFiles && orphanedFiles.length > 0) {
        for (const file of orphanedFiles) {
          try {
            await this.storage.delete(file.key);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            result.errors?.push(`Failed to delete ${file.key}: ${errorMsg}`);
          }
        }
      }

      // 4. 清理孤儿记录（如果需要）
      if (deleteOrphanedRecords && result.details.inconsistentPhotos.length > 0) {
        const orphanedRecordIds = result.details.inconsistentPhotos
          .filter((p) => p.action === 'none' && p.issue.includes('original_missing'))
          .map((p) => p.photoId);

        if (orphanedRecordIds.length > 0) {
          // 批量删除孤儿记录
          for (const id of orphanedRecordIds) {
            const deleteResult = await this.db.delete('photos', { id });
            if (deleteResult.error) {
              result.errors?.push(`Failed to delete orphaned record ${id}: ${deleteResult.error.message}`);
            }
          }
          result.summary.orphanedRecords = orphanedRecordIds.length;
        }
      }

      result.duration = Date.now() - startTime;

      // 5. 发送告警（如果发现问题）
      if (sendAlerts && (result.summary.inconsistentRecords > 0 || result.summary.orphanedFiles > 0)) {
        await this.sendAlerts(result);
      }

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors = result.errors || [];
      result.errors.push(`Check failed: ${errorMsg}`);
      console.error('[Consistency] Check failed:', error);

      // 发送错误告警
      if (sendAlerts) {
        await alertService.workerServiceError('数据一致性检查失败', {
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    }
  }

  /**
   * 查找孤儿文件
   */
  private async findOrphanedFiles(photos: PhotoRecord[]) {
    const orphanedFiles: Array<{ key: string; size: number; lastModified: Date }> = [];

    try {
      // 获取存储中所有文件（检查 processed 目录）
      const processedFiles = await this.storage.listObjects('processed/');
      const rawFiles = await this.storage.listObjects('raw/');

      const allFiles = [...processedFiles, ...rawFiles];
      const storageKeys = new Set(allFiles.map((f) => f.key));

      // 收集数据库中的所有 key
      const databaseKeys = new Set<string>();
      for (const photo of photos) {
        if (photo.original_key) databaseKeys.add(photo.original_key);
        if (photo.thumb_key) databaseKeys.add(photo.thumb_key);
        if (photo.preview_key) databaseKeys.add(photo.preview_key);
      }

      // 找出孤儿文件（存储中有但数据库没有的）
      // 过滤掉目录（以 / 结尾的路径）和空文件
      for (const file of allFiles) {
        // 跳过目录（以 / 结尾）和空文件
        if (file.key.endsWith('/') || file.size === 0) {
          continue;
        }
        
        if (!databaseKeys.has(file.key)) {
          orphanedFiles.push({
            key: file.key,
            size: file.size,
            lastModified: file.lastModified,
          });
        }
      }

      return orphanedFiles;
    } catch (error) {
      console.error('[Consistency] Failed to find orphaned files:', error);
      return [];
    }
  }

  /**
   * 发送告警
   */
  private async sendAlerts(result: ConsistencyCheckResult) {
    const { summary, details } = result;

    let title = '数据一致性检查完成';
    let level: 'info' | 'warning' | 'error' | 'critical' = 'info';
    let message = `检查完成，未发现问题`;

    if (summary.inconsistentRecords > 0 || summary.orphanedFiles > 0) {
      title = '发现数据不一致';
      level = summary.inconsistentRecords > 10 || summary.orphanedFiles > 10 ? 'critical' : 'warning';
      message = `发现 ${summary.inconsistentRecords} 条不一致记录，${summary.orphanedFiles} 个孤儿文件`;
    }

    await alertService.send({
      title,
      message,
      level,
      metadata: {
        summary,
        inconsistentPhotos: details.inconsistentPhotos.slice(0, 10), // 最多显示 10 条
        orphanedFiles: details.orphanedFiles.slice(0, 10),
        timestamp: result.timestamp,
        duration: `${result.duration}ms`,
      },
    });
  }

  /**
   * 修复单个照片
   */
  async repairPhoto(photoId: string): Promise<{ success: boolean; message: string }> {
    try {
      const photoResult = await this.db.findOne<PhotoRecord>('photos', { id: photoId });

      if (photoResult.error || !photoResult.data) {
        return { success: false, message: '照片不存在' };
      }

      const photo = photoResult.data;

      const issues: string[] = [];

      // 检查原图
      if (photo.original_key) {
        const originalExists = await this.storage.exists(photo.original_key);
        if (!originalExists) {
          issues.push('原图缺失');
        }
      }

      // 检查缩略图和预览图
      if (photo.status === 'completed') {
        if (photo.thumb_key) {
          const thumbExists = await this.storage.exists(photo.thumb_key);
          if (!thumbExists) {
            issues.push('缩略图缺失');
          }
        }
        if (photo.preview_key) {
          const previewExists = await this.storage.exists(photo.preview_key);
          if (!previewExists) {
            issues.push('预览图缺失');
          }
        }
      }

      if (issues.length === 0) {
        return { success: true, message: '照片数据一致，无需修复' };
      }

      // 尝试修复
      if (photo.status === 'pending' && issues.includes('原图缺失')) {
        // pending 状态但原图缺失，删除记录
        await this.db.delete('photos', { id: photoId });
        return { success: true, message: '已删除无效记录' };
      }

      // completed 状态但文件缺失，标记为 pending 重新处理
      await this.db.update('photos', { id: photoId }, { status: 'pending' });
      return { success: true, message: '已标记为待处理' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `修复失败: ${errorMsg}` };
    }
  }
}

// 导出便捷函数
export function createConsistencyChecker(bucketName: string) {
  return new ConsistencyChecker(bucketName);
}
