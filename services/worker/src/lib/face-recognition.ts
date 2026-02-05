/**
 * @fileoverview 人脸识别模块
 *
 * @description
 * 调用外部 AI 服务进行人脸检测和特征提取。
 * 用于相册中的人脸识别和分类功能。
 *
 * @module lib/face-recognition
 *
 * @example
 * ```typescript
 * import { extractFaces } from '@/lib/face-recognition'
 *
 * const faces = await extractFaces(imageBuffer)
 * console.log('检测到', faces.length, '个人脸')
 * ```
 */

import FormData from "form-data";

/** AI 服务 URL（从环境变量读取，默认 http://ai:8000） */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://ai:8000";

/**
 * 人脸识别结果
 *
 * @interface
 */
export interface FaceResult {
  /** 人脸特征向量（用于人脸比对） */
  embedding: number[];
  /** 人脸边界框 [x, y, width, height] */
  bbox: number[];
  /** 检测置信度（0-1） */
  det_score: number;
}

/**
 * 从图像中提取人脸特征
 *
 * @description
 * 调用外部 AI 服务检测图像中的所有人脸，并返回特征向量和位置信息。
 * 如果 AI 服务不可用或出错，返回空数组（不影响主流程）。
 *
 * @param {Buffer} imageBuffer - 图像 Buffer
 * @returns {Promise<FaceResult[]>} 人脸结果数组，失败返回空数组
 *
 * @example
 * ```typescript
 * const faces = await extractFaces(buffer)
 * if (faces.length > 0) {
 *   console.log('检测到', faces.length, '个人脸')
 *   console.log('第一个人脸的置信度:', faces[0].det_score)
 * }
 * ```
 */
export async function extractFaces(imageBuffer: Buffer): Promise<FaceResult[]> {
  const form = new FormData();
  form.append("file", imageBuffer, {
    filename: "image.jpg",
    contentType: "image/jpeg",
  });

  try {
    const response = await fetch(`${AI_SERVICE_URL}/extract`, {
      method: "POST",
      body: form as any, // Node fetch supports FormData but types might conflict
      headers: form.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      error?: string;
      faces?: FaceResult[];
    };
    if (data.error) {
      throw new Error(`AI service error: ${data.error}`);
    }

    return data.faces || [];
  } catch (error) {
    console.error("Face extraction failed:", error);
    // Don't crash the worker, just return empty
    return [];
  }
}
