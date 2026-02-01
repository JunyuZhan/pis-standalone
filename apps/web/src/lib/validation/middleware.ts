/**
 * PIS Web - 验证中间件
 *
 * 提供 API 路由的输入验证中间件
 *
 * @author PIS Contributors
 * @license MIT
 *
 * @description
 * 使用 Zod 进行输入验证，提供：
 * - 请求体验证（withValidation）
 * - 查询参数验证（withQueryValidation）
 * - 路径参数验证（withParamsValidation）
 *
 * @example
 * ```typescript
 * import { withValidation, withQueryValidation } from '@/lib/validation/middleware'
 * import { createAlbumSchema, albumIdSchema } from '@/lib/validation/schemas'
 * import { NextRequest } from 'next/server'
 *
 * // 验证请求体
 * export const POST = withValidation(createAlbumSchema, async (req, body) => {
 *   // body 是经过验证的类型安全数据
 *   return NextResponse.json({ success: true })
 * })
 *
 * // 验证查询参数
 * export const GET = withQueryValidation(albumIdSchema, async (req, query) => {
 *   const { id } = query
 *   return NextResponse.json({ albumId: id })
 * })
 * ```
 */
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodSchema, ZodError } from 'zod'
import { handleValidationError, createErrorResponse, ErrorCode } from './error-handler'

/**
 * 验证请求体的中间件
 *
 * @description
 * - 自动解析 JSON 请求体
 * - 使用 Zod Schema 验证
 * - 验证失败返回 400 错误
 *
 * @template TBody - Zod Schema 类型
 * @param schema - Zod 验证 Schema
 * @param handler - API 路由处理函数
 * @returns 验证后的处理函数
 *
 * @example
 * ```typescript
 * import { loginSchema } from '@/lib/validation/schemas'
 *
 * export const POST = withValidation(loginSchema, async (req, body) => {
 *   // body 类型为 { email: string, password: string }
 *   const { email, password } = body
 *   // 处理登录逻辑...
 * })
 * ```
 */
export function withValidation<TBody extends ZodSchema>(
  schema: TBody,
  handler: (req: NextRequest, body: z.infer<TBody>) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 解析请求体
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          '无效的 JSON 格式',
          undefined,
          400
        )
      }

      // 验证请求体
      const validatedBody = schema.parse(body)

      // 调用处理函数
      return await handler(req, validatedBody)
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error)
      }
      throw error
    }
  }
}

/**
 * 验证查询参数的中间件
 *
 * @description
 * - 自动解析 URL 查询参数
 * - 使用 Zod Schema 验证
 * - 验证失败返回 400 错误
 *
 * @template TQuery - Zod Schema 类型
 * @param schema - Zod 验证 Schema
 * @param handler - API 路由处理函数
 * @returns 验证后的处理函数
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 *
 * const querySchema = z.object({
 *   page: z.string().transform(Number),
 *   limit: z.string().transform(Number),
 * })
 *
 * export const GET = withQueryValidation(querySchema, async (req, query) => {
 *   // query 类型为 { page: number, limit: number }
 *   const { page, limit } = query
 *   // 处理查询逻辑...
 * })
 * ```
 */
export function withQueryValidation<TQuery extends ZodSchema>(
  schema: TQuery,
  handler: (req: NextRequest, query: z.infer<TQuery>) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 获取查询参数
      const searchParams = req.nextUrl.searchParams
      const query: Record<string, string> = {}
      searchParams.forEach((value, key) => {
        query[key] = value
      })

      // 验证查询参数
      const validatedQuery = schema.parse(query)

      // 调用处理函数
      return await handler(req, validatedQuery)
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error)
      }
      throw error
    }
  }
}

/**
 * 验证路径参数的中间件
 *
 * @description
 * - 验证动态路由参数（如 `[id]`）
 * - 使用 Zod Schema 验证
 * - 验证失败返回 400 错误
 *
 * @template TParams - Zod Schema 类型
 * @param schema - Zod 验证 Schema
 * @param handler - API 路由处理函数
 * @returns 验证后的处理函数
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { uuidSchema } from '@/lib/validation/schemas'
 *
 * // app/api/albums/[id]/route.ts
 * export const GET = withParamsValidation(
 *   z.object({ id: uuidSchema }),
 *   async (req, params) => {
 *     // params 类型为 { id: string }
 *     const { id } = params
 *     // 处理查询逻辑...
 *   }
 * )
 * ```
 */
export function withParamsValidation<TParams extends ZodSchema>(
  schema: TParams,
  handler: (req: NextRequest, params: z.infer<TParams>) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    { params }: { params: unknown }
  ): Promise<NextResponse> => {
    try {
      // 验证路径参数
      const validatedParams = schema.parse(params)

      // 调用处理函数
      return await handler(req, validatedParams)
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error)
      }
      throw error
    }
  }
}
