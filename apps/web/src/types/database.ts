/**
 * PostgreSQL 数据库类型定义
 * 
 * 注意：类型定义已手动维护，与数据库schema保持同步。
 * 数据库架构定义在 `docker/init-postgresql-db.sql` 中（`docker/schema.sql` 是符号链接）。
 * 
 * 如需更新类型定义，请：
 * 1. 更新数据库架构文件
 * 2. 手动更新此文件以保持同步
 * 3. 或使用 PostgreSQL 类型生成工具（如 pgtyped）
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      albums: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          cover_photo_id: string | null
          is_public: boolean
          // 访问控制
          password: string | null
          upload_token: string | null  // FTP/API 上传令牌
          expires_at: string | null
          // 布局设置
          layout: 'masonry' | 'grid' | 'carousel'
          sort_rule: 'capture_desc' | 'capture_asc' | 'manual'
          // 功能开关
          allow_download: boolean
          allow_batch_download: boolean
          show_exif: boolean
          allow_share: boolean
          // 水印设置
          watermark_enabled: boolean
          watermark_type: 'text' | 'logo' | null
          watermark_config: Json
          // 调色配置
          color_grading: Json | null
          // 人工修图
          enable_human_retouch: boolean
          // AI 修图
          enable_ai_retouch: boolean
          ai_retouch_config: Json
          // 分享配置
          share_title: string | null
          share_description: string | null
          share_image_url: string | null
          // 海报配置
          poster_image_url: string | null
          // 活动元数据
          event_date: string | null
          location: string | null
          // 直播模式
          is_live: boolean
          // 统计
          photo_count: number
          selected_count: number
          view_count: number
          // 元数据
          metadata: Json
          // 时间戳
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          slug?: string
          title: string
          description?: string | null
          cover_photo_id?: string | null
          is_public?: boolean
          password?: string | null
          upload_token?: string | null  // FTP/API 上传令牌（可选，创建时自动生成）
          expires_at?: string | null
          layout?: 'masonry' | 'grid' | 'carousel'
          sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
          allow_download?: boolean
          allow_batch_download?: boolean
          show_exif?: boolean
          allow_share?: boolean
          watermark_enabled?: boolean
          watermark_type?: 'text' | 'logo' | null
          watermark_config?: Json
          color_grading?: Json | null
          enable_human_retouch?: boolean
          enable_ai_retouch?: boolean
          ai_retouch_config?: Json
          share_title?: string | null
          share_description?: string | null
          share_image_url?: string | null
          poster_image_url?: string | null
          event_date?: string | null
          location?: string | null
          is_live?: boolean
          photo_count?: number
          selected_count?: number
          view_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string | null
          cover_photo_id?: string | null
          is_public?: boolean
          password?: string | null
          upload_token?: string | null  // FTP/API 上传令牌（可选，用于重置）
          expires_at?: string | null
          layout?: 'masonry' | 'grid' | 'carousel'
          sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
          allow_download?: boolean
          allow_batch_download?: boolean
          show_exif?: boolean
          allow_share?: boolean
          watermark_enabled?: boolean
          watermark_type?: 'text' | 'logo' | null
          watermark_config?: Json
          color_grading?: Json | null
          enable_human_retouch?: boolean
          enable_ai_retouch?: boolean
          ai_retouch_config?: Json
          share_title?: string | null
          share_description?: string | null
          share_image_url?: string | null
          poster_image_url?: string | null
          event_date?: string | null
          location?: string | null
          is_live?: boolean
          photo_count?: number
          selected_count?: number
          view_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      photos: {
        Row: {
          id: string
          album_id: string
          original_key: string
          preview_key: string | null
          thumb_key: string | null
          filename: string
          file_size: number | null
          width: number | null
          height: number | null
          mime_type: string | null
          blur_data: string | null
          exif: Json
          captured_at: string | null
          status: 'pending' | 'pending_retouch' | 'retouching' | 'processing' | 'completed' | 'failed'
          retoucher_id: string | null
          is_selected: boolean
          sort_order: number
          rotation: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          album_id: string
          original_key: string
          preview_key?: string | null
          thumb_key?: string | null
          filename: string
          file_size?: number | null
          width?: number | null
          height?: number | null
          mime_type?: string | null
          blur_data?: string | null
          exif?: Json
          captured_at?: string | null
          status?: 'pending' | 'pending_retouch' | 'retouching' | 'processing' | 'completed' | 'failed'
          retoucher_id?: string | null
          is_selected?: boolean
          sort_order?: number
          rotation?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          album_id?: string
          original_key?: string
          preview_key?: string | null
          thumb_key?: string | null
          filename?: string
          file_size?: number | null
          width?: number | null
          height?: number | null
          mime_type?: string | null
          blur_data?: string | null
          exif?: Json
          captured_at?: string | null
          status?: 'pending' | 'pending_retouch' | 'retouching' | 'processing' | 'completed' | 'failed'
          retoucher_id?: string | null
          is_selected?: boolean
          sort_order?: number
          rotation?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      album_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          is_public: boolean
          layout: 'masonry' | 'grid' | 'carousel'
          sort_rule: 'capture_desc' | 'capture_asc' | 'manual'
          allow_download: boolean
          allow_batch_download: boolean
          show_exif: boolean
          password: string | null
          expires_at: string | null
          watermark_enabled: boolean
          watermark_type: 'text' | 'logo' | null
          watermark_config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_public?: boolean
          layout?: 'masonry' | 'grid' | 'carousel'
          sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
          allow_download?: boolean
          allow_batch_download?: boolean
          show_exif?: boolean
          password?: string | null
          expires_at?: string | null
          watermark_enabled?: boolean
          watermark_type?: 'text' | 'logo' | null
          watermark_config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_public?: boolean
          layout?: 'masonry' | 'grid' | 'carousel'
          sort_rule?: 'capture_desc' | 'capture_asc' | 'manual'
          allow_download?: boolean
          allow_batch_download?: boolean
          show_exif?: boolean
          password?: string | null
          expires_at?: string | null
          watermark_enabled?: boolean
          watermark_type?: 'text' | 'logo' | null
          watermark_config?: Json
          created_at?: string
          updated_at?: string
        }
      }
      package_downloads: {
        Row: {
          id: string
          album_id: string
          photo_ids: string[]
          include_watermarked: boolean
          include_original: boolean
          status: 'pending' | 'processing' | 'completed' | 'failed'
          zip_key: string | null
          file_size: number | null
          download_url: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          album_id: string
          photo_ids: string[]
          include_watermarked?: boolean
          include_original?: boolean
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          zip_key?: string | null
          file_size?: number | null
          download_url?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          album_id?: string
          photo_ids?: string[]
          include_watermarked?: boolean
          include_original?: boolean
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          zip_key?: string | null
          file_size?: number | null
          download_url?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
      photo_groups: {
        Row: {
          id: string
          album_id: string
          name: string
          description: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          album_id: string
          name: string
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          album_id?: string
          name?: string
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      photo_group_assignments: {
        Row: {
          photo_id: string
          group_id: string
          created_at: string
        }
        Insert: {
          photo_id: string
          group_id: string
          created_at?: string
        }
        Update: {
          photo_id?: string
          group_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// 便捷类型别名
export type Album = Database['public']['Tables']['albums']['Row']
export type AlbumInsert = Database['public']['Tables']['albums']['Insert']
export type AlbumUpdate = Database['public']['Tables']['albums']['Update']

export type Photo = Database['public']['Tables']['photos']['Row']
export type PhotoInsert = Database['public']['Tables']['photos']['Insert']
export type PhotoUpdate = Database['public']['Tables']['photos']['Update']

export type AlbumTemplate = Database['public']['Tables']['album_templates']['Row']
export type AlbumTemplateInsert = Database['public']['Tables']['album_templates']['Insert']
export type AlbumTemplateUpdate = Database['public']['Tables']['album_templates']['Update']

export type PackageDownload = Database['public']['Tables']['package_downloads']['Row']
export type PackageDownloadInsert = Database['public']['Tables']['package_downloads']['Insert']
export type PackageDownloadUpdate = Database['public']['Tables']['package_downloads']['Update']

export type PhotoGroup = Database['public']['Tables']['photo_groups']['Row']
export type PhotoGroupInsert = Database['public']['Tables']['photo_groups']['Insert']
export type PhotoGroupUpdate = Database['public']['Tables']['photo_groups']['Update']

export type PhotoGroupAssignment = Database['public']['Tables']['photo_group_assignments']['Row']
export type PhotoGroupAssignmentInsert = Database['public']['Tables']['photo_group_assignments']['Insert']
