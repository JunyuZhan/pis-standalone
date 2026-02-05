/**
 * @fileoverview PIS Web - BlurHash 工具函数
 *
 * @description
 * 将 BlurHash 字符串转换为 data URL，用于 Next.js Image 组件的 placeholder。
 *
 * 注意：Next.js Image 的 placeholder="blur" 需要在服务端生成 blurDataURL。
 * 但由于 blurhash 解码需要 DOM API，我们使用客户端生成的方式。
 *
 * @module lib/blurhash
 *
 * @example
 * ```typescript
 * import { getBlurDataURL } from '@/lib/blurhash'
 *
 * function Photo({ blurHash }) {
 *   const [blurDataURL, setBlurDataURL] = useState<string>()
 *
 *   useEffect(() => {
 *     setBlurDataURL(getBlurDataURL(blurHash))
 *   }, [blurHash])
 *
 *   return (
 *     <Image
 *       src={src}
 *       placeholder="blur"
 *       blurDataURL={blurDataURL}
 *     />
 *   )
 * }
 * ```
 */

/**
 * 将 BlurHash 字符串转换为 data URL（仅客户端）
 *
 * @description
 * - 仅在浏览器环境中执行
 * - 动态导入 blurhash 库避免服务端打包问题
 * - 解码失败时返回 undefined
 *
 * @param {string|null|undefined} blurHash BlurHash 字符串
 * @param {number} [width=32] 输出图片宽度
 * @param {number} [height=32] 输出图片高度
 * @returns {string|undefined} data URL 字符串，服务端或解码失败返回 undefined
 *
 * @example
 * ```typescript
 * const blurData = getBlurDataURL('LFE.RD%0t7xuRjWBjur^#RjWB', 64, 64)
 * // 返回: "data:image/png;base64,iVBORw0KG..."
 * ```
 */
// 缓存 blurhash 模块，避免重复加载
let blurhashModule: { decode: (hash: string, width: number, height: number) => Uint8ClampedArray } | null = null

async function loadBlurhashModule() {
  if (blurhashModule) {
    return blurhashModule
  }
  
  // 仅在客户端加载
  if (typeof window === 'undefined') {
    return null
  }
  
  try {
    // 使用动态导入，避免服务端打包问题
    const blurhash = await import("blurhash")
    
    if (blurhash && typeof blurhash.decode === 'function') {
      blurhashModule = blurhash
      return blurhashModule
    }

    // 兼容 ESM/CJS interop (有些环境下可能是 default export)
    if (blurhash && blurhash.default && typeof blurhash.default.decode === 'function') {
      blurhashModule = blurhash.default
      return blurhashModule
    }
  } catch (error) {
    console.error('Failed to load blurhash module:', error)
    // 模块加载失败（可能在服务端或模块不存在）
    return null
  }
  
  return null
}

export async function getBlurDataURL(
  blurHash: string | null | undefined,
  width: number = 32,
  height: number = 32,
): Promise<string | undefined> {
  // 只在客户端执行
  if (typeof window === "undefined" || !blurHash) {
    return undefined
  }

  try {
    const blurhash = await loadBlurhashModule()
    
    if (!blurhash) {
      return undefined
    }
    
    const pixels = blurhash.decode(blurHash, width, height)
    
    if (!pixels || !ArrayBuffer.isView(pixels)) {
      return undefined
    }
    
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return undefined
    }

    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)

    return canvas.toDataURL()
  } catch {
    console.warn("Failed to decode BlurHash")
    return undefined
  }
}
