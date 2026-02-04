/**
 * PIS Web - 输入验证 Schema
 *
 * 使用 Zod 定义所有 API 输入验证规则
 *
 * @author PIS Contributors
 * @license MIT
 *
 * @description
 * 包含以下验证 Schema：
 * - 通用验证：UUID、Slug、Email、密码
 * - 认证相关：登录、修改密码
 * - 相册相关：创建、更新相册
 * - 照片相关：上传、旋转、重新处理
 * - 分组相关：创建、更新照片分组
 * - 模板相关：创建、更新模板
 * - 批量操作：批量删除、发布、更新
 *
 * @example
 * ```typescript
 * import { validate, safeValidate, loginSchema, createAlbumSchema } from '@/lib/validation/schemas'
 *
 * // 抛出错误的验证
 * const data = validate(loginSchema, { email: 'user@example.com', password: 'pass' })
 *
 * // 安全验证（不抛出错误）
 * const result = safeValidate(createAlbumSchema, requestBody)
 * if (!result.success) {
 *   return handleError(result.error, '输入验证失败')
 * }
 * ```
 */
import { z } from 'zod'

// ============================================
// 通用验证规则
// ============================================

export const uuidSchema = z.string().uuid('无效的 UUID 格式');
export const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug 只能包含小写字母、数字和连字符');
export const emailSchema = z.string().email('无效的邮箱格式');
export const passwordSchema = z.string().min(8, '密码至少 8 个字符').max(100, '密码最多 100 个字符');

// ============================================
// 认证相关
// ============================================

export const loginSchema = z.object({
  // 支持邮箱或用户名（admin）
  email: z.string().min(1, '请输入邮箱或用户名').refine(
    (val) => {
      // 允许邮箱格式或用户名 "admin"
      const isEmail = val.includes('@')
      const isAdminUsername = val.toLowerCase() === 'admin'
      return isEmail || isAdminUsername
    },
    { message: '请输入有效的邮箱地址或用户名 admin' }
  ),
  password: z.string().min(1, '密码不能为空'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, '确认密码不能为空'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '新密码和确认密码不匹配',
  path: ['confirmPassword'],
});

// ============================================
// 相册相关
// ============================================

export const createAlbumSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多 200 个字符'),
  description: z.string().max(1000, '描述最多 1000 个字符').optional().or(z.null()),
  slug: slugSchema.optional(),
  event_date: z.string().datetime().optional().or(z.null()),
  location: z.string().max(200).optional().or(z.null()),
  poster_image_url: z.string().url('海报图片URL格式无效').optional().or(z.null()),
  is_public: z.boolean().optional(),
  isPublic: z.boolean().optional(), // 兼容两种命名
  layout: z.enum(['masonry', 'grid', 'carousel']).optional(),
  sort_rule: z.enum(['capture_desc', 'capture_asc', 'manual']).optional(),
  allow_download: z.boolean().optional(),
  allow_batch_download: z.boolean().optional(),
  allowBatchDownload: z.boolean().optional(), // 兼容两种命名
  show_exif: z.boolean().optional(),
  watermark_enabled: z.boolean().optional(),
  watermark_type: z.enum(['text', 'logo']).optional().or(z.null()),
  watermark_config: z.record(z.unknown()).optional(),
  color_grading: z.object({
    preset: z.string().min(1).max(50),
  }).optional().or(z.null()),
  password: z.string().max(100, '密码最多 100 个字符').optional().or(z.null()),
  expires_at: z.string().datetime().optional().or(z.null()),
  expiresAt: z.string().datetime().optional().or(z.null()), // 兼容 camelCase
  templateId: uuidSchema.optional().or(z.null()),
  stylePreset: z.string().max(50).optional().or(z.null()),
}).refine((data) => {
  // 验证海报图片URL不能是内网地址（SSRF 防护）
  if (data.poster_image_url) {
    try {
      const url = new URL(data.poster_image_url);
      const hostname = url.hostname.toLowerCase();
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
      const isPrivateIP =
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        (hostname.startsWith('172.') &&
          parseInt(hostname.split('.')[1] || '0') >= 16 &&
          parseInt(hostname.split('.')[1] || '0') <= 31) ||
        hostname.endsWith('.local');
      
      if (isLocalhost || isPrivateIP) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}, {
  message: '海报图片URL不能使用内网地址',
  path: ['poster_image_url'],
});

export const updateAlbumSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().or(z.null()),
  cover_photo_id: uuidSchema.optional().or(z.null()),
  is_public: z.boolean().optional(),
  is_live: z.boolean().optional(),
  layout: z.enum(['masonry', 'grid', 'carousel']).optional(),
  sort_rule: z.enum(['capture_desc', 'capture_asc', 'manual']).optional(),
  allow_download: z.boolean().optional(),
  allow_batch_download: z.boolean().optional(),
  show_exif: z.boolean().optional(),
  watermark_enabled: z.boolean().optional(),
  watermark_type: z.enum(['text', 'logo']).optional().or(z.null()),
  watermark_config: z.record(z.unknown()).optional().or(z.null()),
  color_grading: z.object({
    preset: z.string().min(1).max(50),
  }).optional().or(z.null()),
  password: z.string().max(100).optional().or(z.null()),
  expires_at: z.string().datetime().optional().or(z.null()),
  share_title: z.string().max(200).optional().or(z.null()),
  share_description: z.string().max(1000).optional().or(z.null()),
  share_image_url: z.string().url().optional().or(z.null()),
  poster_image_url: z.string().url().optional().or(z.null()),
  event_date: z.string().datetime().optional().or(z.null()),
  location: z.string().max(200).optional().or(z.null()),
}).refine((data) => {
  // 验证 URL 不能是内网地址（SSRF 防护）
  const urls = [data.share_image_url, data.poster_image_url].filter(Boolean);
  for (const url of urls) {
    if (url) {
      try {
        const urlObj = new URL(url);
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
          return false;
        }
      } catch {
        return false;
      }
    }
  }
  return true;
}, {
  message: '图片URL不能使用内网地址',
  path: ['share_image_url', 'poster_image_url'],
});

export const albumIdSchema = z.object({
  id: uuidSchema,
});

export const albumSlugSchema = z.object({
  slug: slugSchema,
});

// ============================================
// 照片相关
// ============================================

export const photoIdSchema = z.object({
  id: uuidSchema,
});

export const uploadPhotoSchema = z.object({
  filename: z.string().min(1, '文件名不能为空').max(255, '文件名过长'),
  contentType: z.string().min(1, 'Content-Type不能为空'),
  fileSize: z.number().int().positive().optional(),
  hash: z.string().optional(),
}).refine((data) => {
  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'image/gif', 'image/tiff'];
  return allowedTypes.includes(data.contentType);
}, {
  message: '不支持的文件类型',
  path: ['contentType'],
}).refine((data) => {
  // 验证文件大小（如果提供）
  if (data.fileSize !== undefined) {
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    return data.fileSize <= MAX_FILE_SIZE;
  }
  return true;
}, {
  message: '文件大小超过限制（最大100MB）',
  path: ['fileSize'],
});

export const reprocessPhotoSchema = z.object({
  photoIds: z.array(uuidSchema).max(100, '单次最多重新处理100张照片').optional(),
  albumId: uuidSchema.optional(),
}).refine((data) => data.photoIds || data.albumId, {
  message: '请指定要重新处理的照片ID或相册ID',
  path: ['photoIds', 'albumId'],
});

export const reorderPhotosSchema = z.object({
  albumId: uuidSchema,
  orders: z.array(z.object({
    photoId: uuidSchema,
    sortOrder: z.number().int().min(0),
  })).min(1, '排序数据不能为空').max(500, '单次最多更新500张照片排序'),
});

export const rotatePhotoSchema = z.object({
  rotation: z.number().int().refine((val) => [0, 90, 180, 270].includes(val), {
    message: '旋转角度必须是 0、90、180 或 270 度',
  }).nullable(),
});

export const processPhotoSchema = z.object({
  photoId: uuidSchema,
  albumId: uuidSchema,
  originalKey: z.string().min(1, '原图key不能为空'),
});

// ============================================
// 分组相关
// ============================================

export const createGroupSchema = z.object({
  albumId: uuidSchema,
  name: z.string().min(1, '分组名称不能为空').max(100, '分组名称最多 100 个字符'),
  description: z.string().max(500).optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const groupIdSchema = z.object({
  groupId: uuidSchema,
});

export const albumGroupParamsSchema = z.object({
  id: uuidSchema,
  groupId: uuidSchema,
});

// ============================================
// 模板相关
// ============================================

export const createTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100, '模板名称最多 100 个字符'),
  description: z.string().max(500).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const templateIdSchema = z.object({
  id: uuidSchema,
});

// ============================================
// 公开 API
// ============================================

export const verifyPasswordSchema = z.object({
  password: z.string({ required_error: '密码不能为空' }).min(1, '密码不能为空'),
});

export const selectPhotoSchema = z.object({
  isSelected: z.boolean(),
});

export const downloadSelectedSchema = z.object({
  photoIds: z.array(uuidSchema).min(1, '至少选择一个照片'),
});

// ============================================
// 批量操作
// ============================================

export const batchOperationSchema = z.object({
  albumIds: z.array(uuidSchema).min(1, '至少选择一个相册').max(50, '单次最多操作50个相册'),
  operation: z.enum(['delete', 'publish', 'unpublish', 'duplicate']),
});

export const batchUpdateSchema = z.object({
  albumIds: z.array(uuidSchema).min(1, '至少选择一个相册').max(50, '单次最多更新50个相册'),
  updates: z.object({
    is_public: z.boolean().optional(),
    layout: z.enum(['masonry', 'grid', 'carousel']).optional(),
    sort_rule: z.enum(['capture_desc', 'capture_asc', 'manual']).optional(),
    allow_download: z.boolean().optional(),
    show_exif: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: '至少提供一个更新字段',
  }),
});

export const permanentDeleteSchema = z.object({
  photoIds: z.array(uuidSchema).min(1, '请选择要删除的照片').max(100, '单次最多删除100张照片'),
});

export const restoreSchema = z.object({
  photoIds: z.array(uuidSchema).min(1, '请选择要恢复的照片').max(100, '单次最多恢复100张照片'),
});

// ============================================
// 相册操作相关
// ============================================

export const packageDownloadSchema = z.object({
  photoIds: z.array(uuidSchema).optional(),
  photoSelection: z.enum(['all', 'selected', 'custom']).optional().default('all'),
  includeWatermarked: z.boolean().optional().default(true),
  includeOriginal: z.boolean().optional().default(true),
}).refine((data) => {
  // 如果选择 custom，必须提供 photoIds
  if (data.photoSelection === 'custom' && (!data.photoIds || data.photoIds.length === 0)) {
    return false;
  }
  return true;
}, {
  message: '选择 custom 时必须提供 photoIds',
  path: ['photoIds'],
});

export const packageIdQuerySchema = z.object({
  packageId: uuidSchema,
});

export const checkDuplicateSchema = z.object({
  filename: z.string().min(1, '文件名不能为空').max(255, '文件名过长'),
  fileSize: z.number().int().positive('文件大小必须为正整数'),
  fileHash: z.string().optional(),
});

export const reprocessAlbumSchema = z.object({
  apply_color_grading: z.boolean().optional().default(true),
});

export const consistencyCheckSchema = z.object({
  autoFix: z.boolean().optional().default(false),
  deleteOrphanedFiles: z.boolean().optional().default(false),
  deleteOrphanedRecords: z.boolean().optional().default(false),
  batchSize: z.number().int().positive().max(1000).optional().default(100),
}).refine((data) => {
  // 删除孤儿记录需要启用自动修复（因为涉及数据库操作）
  // 但删除孤儿文件可以独立启用（只是删除存储中的文件）
  if (data.deleteOrphanedRecords && !data.autoFix) {
    return false;
  }
  return true;
}, {
  message: '删除孤儿记录需要启用自动修复',
  path: ['autoFix'],
});

export const uploadProxyQuerySchema = z.object({
  key: z.string().min(1, 'key 不能为空'),
});

export const assignPhotosToGroupSchema = z.object({
  photo_ids: z.array(uuidSchema).min(1, '至少选择一个照片'),
});

export const removePhotosFromGroupSchema = z.object({
  photo_ids: z.array(uuidSchema).min(1, '至少选择一个照片'),
});

// ============================================
// 工具函数
// ============================================

/**
 * 验证请求体并返回解析后的数据
 * 
 * @param schema Zod schema
 * @param data 要验证的数据
 * @returns 验证成功返回解析后的数据，失败抛出 ZodError
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * 安全验证请求体，返回结果对象
 * 
 * @param schema Zod schema
 * @param data 要验证的数据
 * @returns 验证结果对象 { success: boolean, data?: T, error?: ZodError }
 */
export function safeValidate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
