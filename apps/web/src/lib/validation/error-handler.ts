/**
 * @fileoverview 统一 API 错误处理
 *
 * 提供统一的 API 错误响应格式和处理工具。
 * 标准化错误响应结构，简化错误处理逻辑。
 *
 * @module lib/validation/error-handler
 *
 * @example
 * ```typescript
 * import { createErrorResponse, ErrorCode, ApiError } from '@/lib/validation/error-handler'
 *
 * // 使用函数创建错误响应
 * return createErrorResponse(ErrorCode.NOT_FOUND, '相册不存在', undefined, 404)
 *
 * // 使用便捷方法
 * return ApiError.notFound('相册不存在')
 * ```
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import logger from "@/lib/logger";

// 重新导出 validate 和 safeValidate 以便使用
export { validate, safeValidate } from "./schemas";

// ============================================
// 错误代码枚举
// ============================================

/**
 * API 错误代码枚举
 *
 * @description
 * 标准化错误代码，便于客户端识别和处理不同类型的错误。
 *
 * @enum {string}
 */
export enum ErrorCode {
  // 通用错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  // 认证错误
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  PASSWORD_MISMATCH = "PASSWORD_MISMATCH",

  // 资源错误
  ALBUM_NOT_FOUND = "ALBUM_NOT_FOUND",
  PHOTO_NOT_FOUND = "PHOTO_NOT_FOUND",
  GROUP_NOT_FOUND = "GROUP_NOT_FOUND",
  TEMPLATE_NOT_FOUND = "TEMPLATE_NOT_FOUND",

  // 业务错误
  ALBUM_EXPIRED = "ALBUM_EXPIRED",
  ALBUM_PASSWORD_REQUIRED = "ALBUM_PASSWORD_REQUIRED",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  DUPLICATE_SLUG = "DUPLICATE_SLUG",
  DUPLICATE_ERROR = "DUPLICATE_ERROR",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  STORAGE_ERROR = "STORAGE_ERROR",
  PROCESSING_ERROR = "PROCESSING_ERROR",
}

// ============================================
// 错误响应接口
// ============================================

/**
 * API 错误响应接口
 *
 * @interface
 * @property {Object} error - 错误对象
 * @property {string} error.code - 错误代码
 * @property {string} error.message - 错误消息
 * @property {*} [error.details] - 错误详情（可选）
 */
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
 *
 * @param {ErrorCode} code - 错误代码
 * @param {string} message - 错误消息
 * @param {*} [details] - 错误详情
 * @param {number} [status=400] - HTTP 状态码
 * @returns {NextResponse<ApiErrorResponse>} 格式化的错误响应
 *
 * @example
 * ```typescript
 * return createErrorResponse(
 *   ErrorCode.ALBUM_NOT_FOUND,
 *   '相册不存在',
 *   { slug: 'unknown' },
 *   404
 * )
 * ```
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  status: number = 400,
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return NextResponse.json(response, { status });
}

/**
 * 处理 Zod 验证错误
 *
 * @description
 * 将 Zod 验证错误转换为统一的 API 错误响应格式。
 *
 * @param {ZodError} error - Zod 验证错误对象
 * @returns {NextResponse<ApiErrorResponse>} 格式化的验证错误响应
 *
 * @example
 * ```typescript
 * try {
 *   schema.parse(data)
 * } catch (error) {
 *   if (error instanceof ZodError) {
 *     return handleValidationError(error)
 *   }
 * }
 * ```
 */
export function handleValidationError(
  error: ZodError,
): NextResponse<ApiErrorResponse> {
  const details = error.errors.map((err) => ({
    path: err.path.join("."),
    message: err.message,
  }));

  return createErrorResponse(
    ErrorCode.VALIDATION_ERROR,
    "输入验证失败",
    details,
    400,
  );
}

/**
 * 处理通用错误
 *
 * @description
 * 统一处理各类错误，返回标准化的错误响应。
 * 自动识别 Zod 错误和已知的业务错误。
 *
 * @param {*} error - 错误对象
 * @param {string} [defaultMessage='操作失败，请重试'] - 默认错误消息
 * @param {number} [status] - HTTP 状态码
 * @returns {NextResponse<ApiErrorResponse>} 格式化的错误响应
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation()
 * } catch (error) {
 *   return handleError(error, '操作失败')
 * }
 * ```
 */
export function handleError(
  error: unknown,
  defaultMessage: string = "操作失败，请重试",
  status?: number,
): NextResponse<ApiErrorResponse> {
  // 记录错误日志（使用 try-catch 避免 logger worker thread 错误导致 API 失败）
  try {
    logger.error({ err: error }, "API Error");
  } catch (loggerError) {
    // 如果 logger 失败（例如 worker thread 已退出），使用 console.error 作为降级方案
    console.error('[API Error]', error);
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Logger] Logger failed, using console.error as fallback:', loggerError);
    }
  }

  // Zod 验证错误
  if (error instanceof ZodError) {
    return handleValidationError(error);
  }

  // 已知错误
  if (error instanceof Error) {
    // 检查是否是已知的业务错误
    const knownErrors: Record<string, { code: ErrorCode; status: number }> = {
      "Not found": { code: ErrorCode.NOT_FOUND, status: 404 },
      Unauthorized: { code: ErrorCode.UNAUTHORIZED, status: 401 },
      Forbidden: { code: ErrorCode.FORBIDDEN, status: 403 },
    };

    for (const [key, { code, status: errStatus }] of Object.entries(
      knownErrors,
    )) {
      if (error.message.includes(key)) {
        return createErrorResponse(code, error.message, undefined, errStatus);
      }
    }

    // 其他错误
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error.message || defaultMessage,
      undefined,
      status || 500,
    );
  }

  // 未知错误
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    defaultMessage,
    undefined,
    status || 500,
  );
}

/**
 * 创建成功响应
 *
 * @template T - 响应数据类型
 * @param {T} data - 响应数据
 * @param {number} [status=200] - HTTP 状态码
 * @returns {NextResponse<{ data: T }>} 格式化的成功响应
 *
 * @example
 * ```typescript
 * return createSuccessResponse({ id: '123', name: 'Album' }, 201)
 * // { data: { id: '123', name: 'Album' } }
 * ```
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
): NextResponse<{ success: true; data: T }> {
  return NextResponse.json({ success: true, data }, { status });
}

// ============================================
// 便捷函数
// ============================================

/**
 * API 错误便捷方法集合
 *
 * @description
 * 提供常用错误的快速创建方法。
 *
 * @namespace
 * @property {Function} notFound - 创建 404 响应
 * @property {Function} unauthorized - 创建 401 响应
 * @property {Function} forbidden - 创建 403 响应
 * @property {Function} badRequest - 创建 400 响应
 * @property {Function} conflict - 创建 409 响应
 * @property {Function} validation - 创建验证错误响应
 * @property {Function} internal - 创建 500 响应
 *
 * @example
 * ```typescript
 * return ApiError.notFound('相册不存在')
 * return ApiError.unauthorized('请先登录')
 * return ApiError.validation('输入格式错误', details)
 * ```
 */
export const ApiError = {
  notFound: (message: string = "资源未找到") =>
    createErrorResponse(ErrorCode.NOT_FOUND, message, undefined, 404),

  unauthorized: (message: string = "未授权") =>
    createErrorResponse(ErrorCode.UNAUTHORIZED, message, undefined, 401),

  forbidden: (message: string = "禁止访问") =>
    createErrorResponse(ErrorCode.FORBIDDEN, message, undefined, 403),

  badRequest: (message: string = "请求参数错误") =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, message, undefined, 400),

  conflict: (message: string = "资源冲突") =>
    createErrorResponse(ErrorCode.DUPLICATE_SLUG, message, undefined, 409),

  validation: (message: string, details?: unknown) =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, message, details, 400),

  internal: (message: string = "服务器内部错误") =>
    createErrorResponse(ErrorCode.INTERNAL_ERROR, message, undefined, 500),
};
