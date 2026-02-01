/**
 * @fileoverview 图片预加载工具
 *
 * 优化图片加载性能，通过预加载即将可见的图片提升用户体验。
 * 使用 `<link rel="preload">` 和 Intersection Observer API。
 *
 * @module lib/image-preloader
 *
 * @example
 * ```typescript
 * import { preloadImage, preloadImages, preloadVisibleImages } from '@/lib/image-preloader'
 *
 * // 预加载单张图片
 * preloadImage('/photo.jpg', { fetchPriority: 'high' })
 *
 * // 批量预加载
 * preloadImages(['/photo1.jpg', '/photo2.jpg'])
 *
 * // 基于可见性的智能预加载
 * const cleanup = preloadVisibleImages(container, 'img', { preloadCount: 3 })
 * // 组件卸载时清理
 * return () => cleanup()
 * ```
 */

/**
 * 预加载选项接口
 *
 * @interface
 * @property {'high' | 'low'} [priority] - 加载优先级
 * @property {'high' | 'low' | 'auto'} [fetchPriority] - fetch 优先级
 */
interface PreloadOptions {
  priority?: 'high' | 'low'
  fetchPriority?: 'high' | 'low' | 'auto'
}

/**
 * 预加载单张图片
 *
 * @description
 * 通过创建 `<link rel="preload">` 标签预加载指定图片。
 * 重复调用同一图片 URL 会被忽略。
 *
 * @param {string} src - 图片 URL
 * @param {PreloadOptions} [options={}] - 预加载选项
 *
 * @example
 * ```typescript
 * preloadImage('/hero-image.jpg', { fetchPriority: 'high' })
 * ```
 */
export function preloadImage(src: string, options: PreloadOptions = {}): void {
  if (!src) return

  // 检查是否已经预加载过
  if (document.querySelector(`link[href="${src}"]`)) {
    return
  }

  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = src

  // 设置优先级（如果支持）
  if (options.fetchPriority) {
    link.setAttribute('fetchpriority', options.fetchPriority)
  }

  document.head.appendChild(link)
}

/**
 * 批量预加载图片
 *
 * @description
 * 预加载多张图片，前几张使用高优先级，其余使用低优先级。
 *
 * @param {string[]} srcs - 图片 URL 数组
 * @param {PreloadOptions} [options={}] - 预加载选项
 *
 * @example
 * ```typescript
 * preloadImages([
 *   '/photo1.jpg',
 *   '/photo2.jpg',
 *   '/photo3.jpg',
 *   '/photo4.jpg'
 * ])
 * // photo1-3 使用高优先级，photo4 使用低优先级
 * ```
 */
export function preloadImages(
  srcs: string[],
  options: PreloadOptions = {}
): void {
  srcs.forEach((src, index) => {
    // 前几张图片使用高优先级
    const priority = index < 3 ? 'high' : 'low'
    preloadImage(src, {
      ...options,
      fetchPriority: priority as 'high' | 'low',
    })
  })
}

/**
 * 预加载即将可见的图片（基于 Intersection Observer）
 *
 * @description
 * 当图片即将进入视口时，自动预加载该图片及其后的几张图片。
 * 提前 200px 开始预加载，可通过返回的清理函数取消观察。
 *
 * @param {HTMLElement} container - 容器元素
 * @param {string} imageSelector - 图片选择器
 * @param {Object} [options={}] - 配置选项
 * @param {number} [options.preloadCount=3] - 预加载数量
 * @returns {Function} 清理函数，调用可停止观察
 *
 * @example
 * ```typescript
 * // 在 React 组件中使用
 * useEffect(() => {
 *   const container = galleryRef.current
 *   if (!container) return
 *
 *   const cleanup = preloadVisibleImages(
 *     container,
 *     'img[data-src]',
 *     { preloadCount: 5 }
 *   )
 *
 *   return cleanup
 * }, [])
 * ```
 */
export function preloadVisibleImages(
  container: HTMLElement,
  imageSelector: string,
  options: { preloadCount?: number } = {}
): () => void {
  const { preloadCount = 3 } = options

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          const src =
            img.getAttribute('data-preload-src') || img.src

          if (src) {
            // 预加载当前图片和后续几张
            const container = img.closest('[data-image-container]')
            if (container) {
              const images = Array.from(
                container.querySelectorAll<HTMLImageElement>(imageSelector)
              )
              const currentIndex = images.indexOf(img)

              for (
                let i = 1;
                i <= preloadCount && currentIndex + i < images.length;
                i++
              ) {
                const nextImg = images[currentIndex + i]
                const nextSrc =
                  nextImg.getAttribute('data-preload-src') ||
                  nextImg.src
                if (nextSrc) {
                  preloadImage(nextSrc, {
                    fetchPriority: i === 1 ? 'high' : 'low',
                  })
                }
              }
            }
          }

          observer.unobserve(img)
        }
      })
    },
    { rootMargin: '200px' } // 提前 200px 开始预加载
  )

  const images = container.querySelectorAll<HTMLImageElement>(imageSelector)
  images.forEach((img) => observer.observe(img))

  // 返回清理函数
  return () => observer.disconnect()
}
