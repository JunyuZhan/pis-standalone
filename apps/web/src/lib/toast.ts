/**
 * @fileoverview Toast 提示消息工具函数
 *
 * 基于 Sonner 库的统一提示消息管理。
 * 提供成功、错误、信息、警告等多种提示类型。
 *
 * @module lib/toast
 *
 * @example
 * ```typescript
 * import { showSuccess, showError, showLoading, updateLoadingSuccess } from '@/lib/toast'
 *
 * // 显示提示
 * showSuccess('操作成功')
 * showError('操作失败')
 *
 * // 异步操作模式
 * async function handleSubmit() {
 *   const toastId = showLoading('正在提交...')
 *   try {
 *     await submitForm()
 *     updateLoadingSuccess(toastId, '提交成功')
 *   } catch (error) {
 *     updateLoadingError(toastId, '提交失败')
 *   }
 * }
 * ```
 */

import { toast } from 'sonner'

/**
 * 显示成功提示
 *
 * @param {string} message - 提示消息
 * @param {number} [duration=3000] - 显示时长（毫秒）
 *
 * @example
 * ```typescript
 * showSuccess('保存成功')
 * showSuccess('删除成功', 2000)
 * ```
 */
export function showSuccess(message: string, duration?: number) {
  toast.success(message, { duration: duration || 3000 })
}

/**
 * 显示错误提示
 *
 * @param {string} message - 错误消息
 * @param {number} [duration=4000] - 显示时长（毫秒）
 *
 * @example
 * ```typescript
 * showError('操作失败，请重试')
 * ```
 */
export function showError(message: string, duration?: number) {
  toast.error(message, { duration: duration || 4000 })
}

/**
 * 显示信息提示
 *
 * @param {string} message - 提示消息
 * @param {number} [duration=3000] - 显示时长（毫秒）
 *
 * @example
 * ```typescript
 * showInfo('即将到期的照片将被删除')
 * ```
 */
export function showInfo(message: string, duration?: number) {
  toast.info(message, { duration: duration || 3000 })
}

/**
 * 显示警告提示
 *
 * @param {string} message - 警告消息
 * @param {number} [duration=3000] - 显示时长（毫秒）
 *
 * @example
 * ```typescript
 * showWarning('此操作不可撤销')
 * ```
 */
export function showWarning(message: string, duration?: number) {
  toast.warning(message, { duration: duration || 3000 })
}

/**
 * 显示加载提示
 *
 * @description
 * 显示持续显示的加载提示，返回 toastId 用于后续更新为成功或失败状态。
 *
 * @param {string} message - 加载消息
 * @returns {string | number} Toast ID，用于后续更新
 *
 * @example
 * ```typescript
 * const toastId = showLoading('正在上传...')
 * // 稍后更新
 * updateLoadingSuccess(toastId, '上传成功')
 * ```
 */
export function showLoading(message: string): string | number {
  return toast.loading(message)
}

/**
 * 将加载提示更新为成功状态
 *
 * @param {string | number} toastId - Toast ID
 * @param {string} message - 成功消息
 *
 * @example
 * ```typescript
 * const toastId = showLoading('正在处理...')
 * await process()
 * updateLoadingSuccess(toastId, '处理完成')
 * ```
 */
export function updateLoadingSuccess(toastId: string | number, message: string) {
  toast.success(message, { id: toastId })
}

/**
 * 将加载提示更新为错误状态
 *
 * @param {string | number} toastId - Toast ID
 * @param {string} message - 错误消息
 *
 * @example
 * ```typescript
 * const toastId = showLoading('正在处理...')
 * try {
 *   await process()
 * } catch (error) {
 *   updateLoadingError(toastId, '处理失败')
 * }
 * ```
 */
export function updateLoadingError(toastId: string | number, message: string) {
  toast.error(message, { id: toastId })
}

/**
 * 处理 API 错误并显示提示
 *
 * @description
 * 自动识别常见错误类型并显示相应的错误消息。
 *
 * @param {unknown} error - 错误对象
 * @param {string} [defaultMessage='操作失败，请重试'] - 默认错误消息
 *
 * @example
 * ```typescript
 * try {
 *   await apiCall()
 * } catch (error) {
 *   handleApiError(error, '请求失败')
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  defaultMessage = '操作失败，请重试'
) {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    showError('网络连接失败，请检查网络后重试')
  } else if (error instanceof Error) {
    showError(error.message || defaultMessage)
  } else {
    showError(defaultMessage)
  }
}
