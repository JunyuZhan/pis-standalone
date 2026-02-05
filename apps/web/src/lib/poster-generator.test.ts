import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  POSTER_PRESETS,
  validateAndLimitStyle,
  generatePoster,
  downloadPoster,
} from './poster-generator'

// Mock canvas
const mockCanvas = {
  width: 0,
  height: 0,
  toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
  toBlob: vi.fn().mockImplementation((callback) => {
    callback(new Blob(['mock'], { type: 'image/png' }))
  }),
  getContext: vi.fn().mockReturnValue({
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    measureText: vi.fn().mockReturnValue({ width: 100 }),
  }),
}

// Mock Image
const mockImage = {
  width: 1000,
  height: 1000,
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  src: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  global.document = {
    createElement: vi.fn().mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas
      if (tag === 'img') {
        const img = { ...mockImage }
        setTimeout(() => {
          if (img.onload) img.onload()
        }, 0)
        return img
      }
      return {}
    }),
    getElementById: vi.fn().mockReturnValue(null),
  } as unknown as Document

  global.Image = class {
    width = 1000
    height = 1000
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    src = ''
    constructor() {
      setTimeout(() => {
        if (this.onload) this.onload()
      }, 0)
    }
  } as unknown as typeof Image

  global.URL = {
    createObjectURL: vi.fn().mockReturnValue('blob:url'),
    revokeObjectURL: vi.fn(),
  } as unknown as typeof URL

  global.Blob = class Blob {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public parts: unknown[], public options: Record<string, any>) {}
  } as unknown as typeof Blob
})

describe('poster-generator', () => {
  describe('POSTER_PRESETS', () => {
    it('should have all preset styles', () => {
      expect(POSTER_PRESETS).toHaveProperty('classic')
      expect(POSTER_PRESETS).toHaveProperty('minimal')
      expect(POSTER_PRESETS).toHaveProperty('elegant')
      expect(POSTER_PRESETS).toHaveProperty('business')
    })

    it('should have valid preset configurations', () => {
      expect(POSTER_PRESETS.classic.layout).toBe('centered')
      expect(POSTER_PRESETS.minimal.layout).toBe('top')
      expect(POSTER_PRESETS.elegant.layout).toBe('bottom')
    })
  })

  describe('validateAndLimitStyle', () => {
    it('should limit titleFontSize to valid range', () => {
      const style = validateAndLimitStyle({ titleFontSize: 100 })
      expect(style.titleFontSize).toBe(72)

      const style2 = validateAndLimitStyle({ titleFontSize: 10 })
      expect(style2.titleFontSize).toBe(32)
    })

    it('should limit descriptionFontSize to valid range', () => {
      const style = validateAndLimitStyle({ descriptionFontSize: 50 })
      expect(style.descriptionFontSize).toBe(40)

      const style2 = validateAndLimitStyle({ descriptionFontSize: 10 })
      expect(style2.descriptionFontSize).toBe(18)
    })

    it('should limit overlayOpacity to valid range', () => {
      const style = validateAndLimitStyle({ overlayOpacity: 1.0 })
      expect(style.overlayOpacity).toBe(0.8)

      const style2 = validateAndLimitStyle({ overlayOpacity: 0.1 })
      expect(style2.overlayOpacity).toBe(0.2)
    })

    it('should limit qrSize to valid range', () => {
      const style = validateAndLimitStyle({ qrSize: 500 })
      expect(style.qrSize).toBe(400)

      const style2 = validateAndLimitStyle({ qrSize: 100 })
      expect(style2.qrSize).toBe(200)
    })

    it('should validate and fix invalid color format', () => {
      const style = validateAndLimitStyle({ titleColor: 'invalid' })
      expect(style.titleColor).toBe('#FFFFFF')

      const style2 = validateAndLimitStyle({ titleColor: '#FF0000' })
      expect(style2.titleColor).toBe('#FF0000')
    })

    it('should preserve valid style values', () => {
      const style = validateAndLimitStyle({
        titleColor: '#FF0000',
        descriptionColor: '#00FF00',
        titleFontSize: 50,
        descriptionFontSize: 25,
        overlayOpacity: 0.5,
        qrSize: 300,
      })

      expect(style.titleColor).toBe('#FF0000')
      expect(style.descriptionColor).toBe('#00FF00')
      expect(style.titleFontSize).toBe(50)
      expect(style.descriptionFontSize).toBe(25)
      expect(style.overlayOpacity).toBe(0.5)
      expect(style.qrSize).toBe(300)
    })
  })

  describe('generatePoster', () => {
    it('should generate poster with gradient background when no image', async () => {
      const result = await generatePoster({
        backgroundImageUrl: null,
        title: 'Test Title',
        qrCodeUrl: 'https://example.com/qr.svg',
      })

      expect(result).toHaveProperty('dataUrl')
      expect(result).toHaveProperty('blob')
      expect(mockCanvas.getContext).toHaveBeenCalled()
    })

    it('should generate poster with background image', async () => {
      const result = await generatePoster({
        backgroundImageUrl: 'https://example.com/bg.jpg',
        title: 'Test Title',
        qrCodeUrl: 'https://example.com/qr.svg',
      })

      expect(result).toHaveProperty('dataUrl')
      expect(result).toHaveProperty('blob')
    })

    it('should handle background image load error', async () => {
      const mockImg = new global.Image()
      mockImg.onerror = null
      vi.mocked(global.document.createElement).mockImplementation(((tag: string) => {
        if (tag === 'canvas') return mockCanvas
        if (tag === 'img') {
          const img = { ...mockImage }
          setTimeout(() => {
            if (typeof img.onerror === 'function') (img.onerror as any)()
          }, 0)
          return img
        }
        return {}
      }) as any)

      const result = await generatePoster({
        backgroundImageUrl: 'https://example.com/invalid.jpg',
        title: 'Test Title',
        qrCodeUrl: 'https://example.com/qr.svg',
      })

      expect(result).toHaveProperty('dataUrl')
    })

    it('should use custom dimensions', async () => {
      await generatePoster({
        backgroundImageUrl: null,
        title: 'Test Title',
        qrCodeUrl: 'https://example.com/qr.svg',
        width: 1080,
        height: 1920,
      })

      expect(mockCanvas.width).toBe(1080)
      expect(mockCanvas.height).toBe(1920)
    })

    it('should handle description', async () => {
      await generatePoster({
        backgroundImageUrl: null,
        title: 'Test Title',
        description: 'Test Description',
        qrCodeUrl: 'https://example.com/qr.svg',
      })

      expect(mockCanvas.getContext().fillText).toHaveBeenCalled()
    })
  })

  describe('downloadPoster', () => {
    it('should download poster blob', () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      }

      vi.mocked(global.document.createElement).mockImplementation(((tag: string) => {
        if (tag === 'a') return mockLink
        return {}
      }) as any)

      const mockBody = {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      }
      global.document.body = mockBody as unknown as HTMLBodyElement

      const blob = new Blob(['test'], { type: 'image/png' })
      downloadPoster(blob, 'poster.png')

      expect(mockLink.href).toBe('blob:url')
      expect(mockLink.download).toBe('poster.png')
      expect(mockLink.click).toHaveBeenCalled()
      expect(mockBody.appendChild).toHaveBeenCalledWith(mockLink)
      expect(mockBody.removeChild).toHaveBeenCalledWith(mockLink)
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url')
    })
  })
})
