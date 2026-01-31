/**
 * PIS Web - 验证中间件
 * 
 * 提供 API 路由的输入验证中间件
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';
import { handleValidationError, createErrorResponse, ErrorCode } from './error-handler';

/**
 * 验证请求体的中间件
 * 
 * @param schema Zod schema
 * @param handler API 路由处理函数
 * @returns 验证后的处理函数
 */
export function withValidation<TBody extends ZodSchema>(
  schema: TBody,
  handler: (req: NextRequest, body: z.infer<TBody>) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 解析请求体
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          '无效的 JSON 格式',
          undefined,
          400
        );
      }

      // 验证请求体
      const validatedBody = schema.parse(body);

      // 调用处理函数
      return await handler(req, validatedBody);
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }
      throw error;
    }
  };
}

/**
 * 验证查询参数的中间件
 * 
 * @param schema Zod schema
 * @param handler API 路由处理函数
 * @returns 验证后的处理函数
 */
export function withQueryValidation<TQuery extends ZodSchema>(
  schema: TQuery,
  handler: (req: NextRequest, query: z.infer<TQuery>) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 获取查询参数
      const searchParams = req.nextUrl.searchParams;
      const query: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        query[key] = value;
      });

      // 验证查询参数
      const validatedQuery = schema.parse(query);

      // 调用处理函数
      return await handler(req, validatedQuery);
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }
      throw error;
    }
  };
}

/**
 * 验证路径参数的中间件
 * 
 * @param schema Zod schema
 * @param handler API 路由处理函数
 * @returns 验证后的处理函数
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
      const validatedParams = schema.parse(params);

      // 调用处理函数
      return await handler(req, validatedParams);
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }
      throw error;
    }
  };
}
