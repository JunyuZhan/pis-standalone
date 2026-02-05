import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { preloadImage, preloadImages, preloadVisibleImages } from './image-preloader'

describe('image-preloader', () => {
  const originalDocument = global.document
  const originalIntersectionObserver = global.IntersectionObserver

  beforeEach(() => {
    // Mock document
    global.document = {
      querySelector: vi.fn(),
      createElement: vi.fn(),
      head: {
        appendChild: vi.fn(),
      },
    } as unknown as Document

    // Mock IntersectionObserver as a class
    global.IntersectionObserver = class MockIntersectionObserver {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {}
    } as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    global.document = originalDocument
    global.IntersectionObserver = originalIntersectionObserver
  })

  describe('preloadImage', () => {
    it('should return early if src is empty', () => {
      preloadImage('')
      expect(global.document.createElement).not.toHaveBeenCalled()
    })

    it('should return early if already preloaded', () => {
      vi.mocked(global.document.querySelector).mockReturnValue({} as HTMLLinkElement)
      
      preloadImage('https://example.com/image.jpg')
      expect(global.document.createElement).not.toHaveBeenCalled()
    })

    it('should create preload link', () => {
      const mockLink = {
        rel: '',
        as: '',
        href: '',
        setAttribute: vi.fn(),
      }
      vi.mocked(global.document.createElement).mockReturnValue(mockLink as unknown as HTMLLinkElement)
      vi.mocked(global.document.querySelector).mockReturnValue(null)

      preloadImage('https://example.com/image.jpg')

      expect(mockLink.rel).toBe('preload')
      expect(mockLink.as).toBe('image')
      expect(mockLink.href).toBe('https://example.com/image.jpg')
      expect(global.document.head.appendChild).toHaveBeenCalledWith(mockLink)
    })

    it('should set fetchPriority if provided', () => {
      const mockLink = {
        rel: '',
        as: '',
        href: '',
        setAttribute: vi.fn(),
      }
      vi.mocked(global.document.createElement).mockReturnValue(mockLink as unknown as HTMLLinkElement)
      vi.mocked(global.document.querySelector).mockReturnValue(null)

      preloadImage('https://example.com/image.jpg', { fetchPriority: 'high' })

      expect(mockLink.setAttribute).toHaveBeenCalledWith('fetchpriority', 'high')
    })
  })

  describe('preloadImages', () => {
    it('should preload multiple images', () => {
      const mockLink = {
        rel: '',
        as: '',
        href: '',
        setAttribute: vi.fn(),
      }
      vi.mocked(global.document.createElement).mockReturnValue(mockLink as unknown as HTMLLinkElement)
      vi.mocked(global.document.querySelector).mockReturnValue(null)

      preloadImages([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
        'https://example.com/image4.jpg',
      ])

      expect(global.document.createElement).toHaveBeenCalledTimes(4)
      expect(mockLink.setAttribute).toHaveBeenCalledWith('fetchpriority', 'high')
    })

    it('should use high priority for first 3 images', () => {
      const mockLink = {
        rel: '',
        as: '',
        href: '',
        setAttribute: vi.fn(),
      }
      vi.mocked(global.document.createElement).mockReturnValue(mockLink as unknown as HTMLLinkElement)
      vi.mocked(global.document.querySelector).mockReturnValue(null)

      preloadImages([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
        'https://example.com/image4.jpg',
      ])

      // First 3 should be high priority
      expect(mockLink.setAttribute).toHaveBeenCalledWith('fetchpriority', 'high')
    })
  })

  describe('preloadVisibleImages', () => {
    it('should create IntersectionObserver', () => {
      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement

      const observerSpy = vi.spyOn(global, 'IntersectionObserver' as any)
      preloadVisibleImages(mockContainer, 'img')

      expect(observerSpy).toHaveBeenCalled()
      observerSpy.mockRestore()
    })

    it('should observe all images', () => {
      const mockImg1 = {} as HTMLImageElement
      const mockImg2 = {} as HTMLImageElement
      let capturedObserver: any

      const OriginalObserver = global.IntersectionObserver
      global.IntersectionObserver = class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          capturedObserver = this
        }
      } as unknown as typeof IntersectionObserver

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockImg1, mockImg2]),
      } as unknown as HTMLElement

      preloadVisibleImages(mockContainer, 'img')

      expect(capturedObserver.observe).toHaveBeenCalledTimes(2)
      expect(capturedObserver.observe).toHaveBeenCalledWith(mockImg1)
      expect(capturedObserver.observe).toHaveBeenCalledWith(mockImg2)

      global.IntersectionObserver = OriginalObserver
    })

    it('should return cleanup function', () => {
      let capturedObserver: any

      const OriginalObserver = global.IntersectionObserver
      global.IntersectionObserver = class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          capturedObserver = this
        }
      } as unknown as typeof IntersectionObserver

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement

      const cleanup = preloadVisibleImages(mockContainer, 'img')

      expect(typeof cleanup).toBe('function')
      cleanup()
      expect(capturedObserver.disconnect).toHaveBeenCalled()

      global.IntersectionObserver = OriginalObserver
    })

    it('should preload images when intersecting', () => {
      let capturedCallback: IntersectionObserverCallback | null = null
      let capturedObserver: any

      const OriginalObserver = global.IntersectionObserver
      global.IntersectionObserver = class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          capturedCallback = callback
          capturedObserver = this
        }
      } as unknown as typeof IntersectionObserver

      const mockImg1 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img1.jpg'),
        src: 'https://example.com/img1.jpg',
        closest: vi.fn(),
      } as any

      const mockImg2 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img2.jpg'),
        src: 'https://example.com/img2.jpg',
      } as any

      const mockImg3 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img3.jpg'),
        src: 'https://example.com/img3.jpg',
      } as any

      mockImg1.closest.mockReturnValue({
        querySelectorAll: vi.fn().mockReturnValue([mockImg1, mockImg2, mockImg3]),
      })

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockImg1]),
      } as unknown as HTMLElement

      vi.mocked(global.document.createElement).mockReturnValue({
        rel: '',
        as: '',
        href: '',
        setAttribute: vi.fn(),
      } as unknown as HTMLLinkElement)
      vi.mocked(global.document.querySelector).mockReturnValue(null)

      preloadVisibleImages(mockContainer, 'img')

      // Trigger the callback with intersecting entry
      if (capturedCallback) {
          (capturedCallback as any)([
            {
              isIntersecting: true,
              target: mockImg1,
            } as unknown as IntersectionObserverEntry,
          ], capturedObserver)
        }

      // Should preload images
      expect(global.document.createElement).toHaveBeenCalled()
      expect(capturedObserver.unobserve).toHaveBeenCalledWith(mockImg1)

      global.IntersectionObserver = OriginalObserver
    })

    it('should handle images without data-preload-src', () => {
      let capturedCallback: IntersectionObserverCallback | null = null
      let capturedObserver: any

      const OriginalObserver = global.IntersectionObserver
      global.IntersectionObserver = class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          capturedCallback = callback
          capturedObserver = this
        }
      } as unknown as typeof IntersectionObserver

      const mockImg1 = {
        getAttribute: vi.fn().mockReturnValue(null),
        src: 'https://example.com/img1.jpg',
        closest: vi.fn(),
      } as any

      const mockImg2 = {
        getAttribute: vi.fn().mockReturnValue(null),
        src: 'https://example.com/img2.jpg',
      } as any

      mockImg1.closest.mockReturnValue({
        querySelectorAll: vi.fn().mockReturnValue([mockImg1, mockImg2]),
      })

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockImg1]),
      } as unknown as HTMLElement

      vi.mocked(global.document.createElement).mockReturnValue({
        rel: '',
        as: '',
        href: '',
        setAttribute: vi.fn(),
      } as unknown as HTMLLinkElement)
      vi.mocked(global.document.querySelector).mockReturnValue(null)

      preloadVisibleImages(mockContainer, 'img')

      if (capturedCallback) {
        (capturedCallback as any)([
          {
            isIntersecting: true,
            target: mockImg1,
          } as unknown as IntersectionObserverEntry,
        ], capturedObserver)
      }

      // Should preload subsequent images using src when data-preload-src is not available
      expect(global.document.createElement).toHaveBeenCalled()
      expect(capturedObserver.unobserve).toHaveBeenCalledWith(mockImg1)

      global.IntersectionObserver = OriginalObserver
    })

    it('should handle images without container', () => {
      let capturedCallback: IntersectionObserverCallback | null = null
      let capturedObserver: any

      const OriginalObserver = global.IntersectionObserver
      global.IntersectionObserver = class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          capturedCallback = callback
          capturedObserver = this
        }
      } as unknown as typeof IntersectionObserver

      const mockImg1 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img1.jpg'),
        src: 'https://example.com/img1.jpg',
        closest: vi.fn().mockReturnValue(null),
      } as any

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockImg1]),
      } as unknown as HTMLElement

      preloadVisibleImages(mockContainer, 'img')

      if (capturedCallback) {
        (capturedCallback as any)([
          {
            isIntersecting: true,
            target: mockImg1,
          } as unknown as IntersectionObserverEntry,
        ], capturedObserver)
      }

      expect(capturedObserver.unobserve).toHaveBeenCalledWith(mockImg1)

      global.IntersectionObserver = OriginalObserver
    })

    it('should handle non-intersecting entries', () => {
      let capturedCallback: IntersectionObserverCallback | null = null
      let capturedObserver: any

      const OriginalObserver = global.IntersectionObserver
      global.IntersectionObserver = class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          capturedCallback = callback
          capturedObserver = this
        }
      } as unknown as typeof IntersectionObserver

      const mockImg1 = {} as HTMLImageElement
      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockImg1]),
      } as unknown as HTMLElement

      preloadVisibleImages(mockContainer, 'img')

      if (capturedCallback) {
        (capturedCallback as any)([
          {
            isIntersecting: false,
            target: mockImg1,
          } as unknown as IntersectionObserverEntry,
        ], capturedObserver)
      }

      expect(capturedObserver.unobserve).not.toHaveBeenCalled()

      global.IntersectionObserver = OriginalObserver
    })

    it('should respect preloadCount option', () => {
      let capturedCallback: IntersectionObserverCallback | null = null
      let capturedObserver: any

      const OriginalObserver = global.IntersectionObserver
      global.IntersectionObserver = class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          capturedCallback = callback
          capturedObserver = this
        }
      } as unknown as typeof IntersectionObserver

      const mockImg1 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img1.jpg'),
        src: 'https://example.com/img1.jpg',
        closest: vi.fn(),
      } as any

      const mockImg2 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img2.jpg'),
        src: 'https://example.com/img2.jpg',
      } as any

      const mockImg3 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img3.jpg'),
        src: 'https://example.com/img3.jpg',
      } as any

      const mockImg4 = {
        getAttribute: vi.fn().mockReturnValue('https://example.com/img4.jpg'),
        src: 'https://example.com/img4.jpg',
      } as any

      mockImg1.closest.mockReturnValue({
        querySelectorAll: vi.fn().mockReturnValue([mockImg1, mockImg2, mockImg3, mockImg4]),
      })

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue([mockImg1]),
      } as unknown as HTMLElement

      vi.mocked(global.document.createElement).mockReturnValue({
        rel: '',
        as: '',
        href: '',
        setAttribute: vi.fn(),
      } as unknown as HTMLLinkElement)
      vi.mocked(global.document.querySelector).mockReturnValue(null)

      preloadVisibleImages(mockContainer, 'img', { preloadCount: 2 })

      if (capturedCallback) {
        (capturedCallback as any)([
          {
            isIntersecting: true,
            target: mockImg1,
          } as unknown as IntersectionObserverEntry,
        ], capturedObserver)
      }

      // Should preload 2 images (img2 and img3), not img4
      expect(global.document.createElement).toHaveBeenCalledTimes(2)

      global.IntersectionObserver = OriginalObserver
    })
  })
})
