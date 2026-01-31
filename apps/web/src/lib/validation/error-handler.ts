/**
 * PIS Web - 统一错误处理
 * 
 * 提供统一的 API 错误响应格式和处理工具
 * 
 * @author junyuzhan <junyuzhan@outlook.com>
 * @license MIT
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import logger from '@/lib/logger';

// 重新导出 validate 和 safeValidate 以便使用
export { validate, safeValidate } from './schemas';

// ============================================
// 错误代码枚举
// ============================================

export enum ErrorCode {
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // 认证错误
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PASSWORD_MISMATCH = 'PASSWORD_MISMATCH',
  
  // 资源错误
  ALBUM_NOT_FOUND = 'ALBUM_NOT_FOUND',
  PHOTO_NOT_FOUND = 'PHOTO_NOT_FOUND',
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  
  // 业务错误
  ALBUM_EXPIRED = 'ALBUM_EXPIRED',
  ALBUM_PASSWORD_REQUIRED = 'ALBUM_PASSWORD_REQUIRED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  DUPLICATE_SLUG = 'DUPLICATE_SLUG',
  DUPLICATE_ERROR = 'DUPLICATE_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
}

// ============================================
// 错误响应接口
// ============================================

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================
// 错误处理函数
// ============================================

/**
 * 创建统一的错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  status: number = 400
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return NextResponse.json(response, { status });
}

/**
 * 处理 Zod 验证错误
 */
export function handleValidationError(error: ZodError): NextResponse<ApiErrorResponse> {
  const details = error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));

  return createErrorResponse(
    ErrorCode.VALIDATION_ERROR,
    '输入验证失败',
    details,
    400
  );
}

/**
 * 处理通用错误
 */
export function handleError(
  error: unknown,
  defaultMessage: string = '操作失败，请重试',
  status?: number
): NextResponse<ApiErrorResponse> {
  // 记录错误日志
  logger.error({ err: error }, 'API Error');

  // Zod 验证错误
  if (error instanceof ZodError) {
    return handleValidationError(error);
  }

  // 已知错误
  if (error instanceof Error) {
    // 检查是否是已知的业务错误
    const knownErrors: Record<string, { code: ErrorCode; status: number }> = {
      'Not found': { code: ErrorCode.NOT_FOUND, status: 404 },
      'Unauthorized': { code: ErrorCode.UNAUTHORIZED, status: 401 },
      'Forbidden': { code: ErrorCode.FORBIDDEN, status: 403 },
    };

    for (const [key, { code, status }] of Object.entries(knownErrors)) {
      if (error.message.includes(key)) {
        return createErrorResponse(code, error.message, undefined, status);
      }
    }

    // 其他错误
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error.message || defaultMessage,
      undefined,
      status || 500
    );
  }

  // 未知错误
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    defaultMessage,
    undefined,
    status || 500
  );
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

// ============================================
// 便捷函数
// ============================================

export const ApiError = {
  notFound: (message: string = '资源未找到') =>
    createErrorResponse(ErrorCode.NOT_FOUND, message, undefined, 404),
  
  unauthorized: (message: string = '未授权') =>
    createErrorResponse(ErrorCode.UNAUTHORIZED, message, undefined, 401),
  
  forbidden: (message: string = '禁止访问') =>
    createErrorResponse(ErrorCode.FORBIDDEN, message, undefined, 403),
  
  badRequest: (message: string = '请求参数错误') =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, message, undefined, 400),
  
  conflict: (message: string = '资源冲突') =>
    createErrorResponse(ErrorCode.DUPLICATE_SLUG, message, undefined, 409),
  
  validation: (message: string, details?: unknown) =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, message, details, 400),
  
  internal: (message: string = '服务器内部错误') =>
    createErrorResponse(ErrorCode.INTERNAL_ERROR, message, undefined, 500),
};
