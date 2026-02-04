import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { checkDuplicateSchema, albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Check if file is duplicate
 * POST /api/admin/albums/[id]/check-duplicate
 * 
 * Request body:
 * {
 *   filename: string,
 *   fileSize: number,
 *   fileHash?: string  // Optional, if provided uses hash-based detection (more accurate)
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const albumId = idValidation.data.id

    // Verify authentication
    const user = await getCurrentUser(request)
    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    const db = await createClient()

    // Verify album exists
    const albumResult = await db
      .from('albums')
      .select('id')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误')
    }

    const bodyValidation = safeValidate(checkDuplicateSchema, body)
    if (!bodyValidation.success) {
      return handleError(bodyValidation.error, '输入验证失败')
    }

    const { filename, fileSize, fileHash } = bodyValidation.data

    const adminClient = await createAdminClient()

    // Check for duplicates: prefer file hash if provided, otherwise use filename + file size
    let duplicatePhoto = null

    if (fileHash) {
      // Use hash-based detection (most accurate)
      const hashMatchResult = await adminClient
        .from('photos')
        .select('id, filename')
        .eq('album_id', albumId)
        .eq('hash', fileHash)
        .is('deleted_at', null)
        .limit(1)
        .single()
      
      if (hashMatchResult.data) {
        duplicatePhoto = hashMatchResult.data
      }
    }

    // If not found by hash, use filename + file size detection
    if (!duplicatePhoto) {
      const sizeMatchResult = await adminClient
        .from('photos')
        .select('id, filename, file_size')
        .eq('album_id', albumId)
        .eq('filename', filename)
        .eq('file_size', fileSize)
        .is('deleted_at', null)
        .limit(1)

      // Check if any record found
      if (sizeMatchResult.data && sizeMatchResult.data.length > 0) {
        duplicatePhoto = sizeMatchResult.data[0]
      }
    }

    return NextResponse.json({
      isDuplicate: !!duplicatePhoto,
      duplicatePhoto: duplicatePhoto || null,
    })
  } catch (error) {
    return handleError(error, '检查重复文件失败')
  }
}
