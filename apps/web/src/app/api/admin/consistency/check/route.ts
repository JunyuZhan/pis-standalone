import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { consistencyCheckSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'

/**
 * 数据一致性检查 API
 * POST /api/admin/consistency/check
 *
 * 请求体：
 * {
 *   autoFix: boolean,        // 是否自动修复
 *   deleteOrphanedFiles: boolean,  // 是否删除孤儿文件
 *   deleteOrphanedRecords: boolean, // 是否删除孤儿记录
 *   batchSize: number        // 每批检查数量
 * }
 *
 * 注意：此 API 通过代理调用 Worker 服务执行检查
 * 避免在 Next.js 中进行大量数据库查询导致超时
 */
export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const user = await getCurrentUser(request)

    if (!user) {
      return ApiError.unauthorized('请先登录')
    }

    // 解析和验证请求体（允许空请求体）
    let body: unknown = {}
    try {
      const bodyText = await request.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch {
      body = {}
    }

    const bodyValidation = safeValidate(consistencyCheckSchema, body)
    if (!bodyValidation.success) {
      return handleError(bodyValidation.error, '输入验证失败')
    }

    const {
      autoFix = false,
      deleteOrphanedFiles = false,
      deleteOrphanedRecords = false,
      batchSize = 100,
    } = bodyValidation.data

    // 调用 Worker API 执行检查（通过代理路由）
    const requestUrl = new URL(request.url)
    const protocol = requestUrl.protocol
    const host = requestUrl.host
    // 使用相对路径，通过代理路由转发到 Worker 服务
    const workerUrl = `${protocol}//${host}/api/worker/consistency/check`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }

    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          autoFix,
          deleteOrphanedFiles,
          deleteOrphanedRecords,
          batchSize,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Worker consistency check error:', response.status, errorText)
        return ApiError.internal(`检查失败: ${errorText}`)
      }

      const workerResult = await response.json()

      // 转换 Worker 返回的结果格式为前端期望的格式
      const result = workerResult.result || workerResult
      
      // 计算修复数量（标记为重新处理或删除的记录数）
      const fixedCount = result.details?.inconsistentPhotos?.filter(
        (p: any) => p.action === 'marked_for_reprocessing' || p.action === 'deleted_orphaned_record'
      ).length || 0
      
      const formattedResult = {
        success: true,
        result: {
          totalChecked: result.summary?.totalPhotos || 0,
          inconsistencies: result.summary?.inconsistentRecords || 0,
          fixed: fixedCount,
          orphanedFiles: result.summary?.orphanedFiles || 0,
          orphanedRecords: result.summary?.orphanedRecords || 0,
          errors: result.errors || [],
          // 添加详细信息
          orphanedFilesDetails: result.details?.orphanedFiles || [],
          inconsistentPhotosDetails: result.details?.inconsistentPhotos || [],
        },
      }

      // 返回检查结果
      return NextResponse.json(formattedResult)
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      console.error('Failed to call worker:', errorMsg)

      return ApiError.internal('Worker 服务不可用，请稍后重试')
    }
  } catch (error) {
    return handleError(error, '一致性检查失败')
  }
}

/**
 * 获取一致性检查状态
 * GET /api/admin/consistency/check
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/consistency/check',
    methods: {
      POST: {
        description: '执行数据一致性检查',
        parameters: {
          autoFix: '是否自动修复不一致的记录',
          deleteOrphanedFiles: '是否删除孤儿文件',
          deleteOrphanedRecords: '是否删除孤儿记录',
          batchSize: '每批检查的数量（默认100）',
        },
      },
    },
  })
}
