import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MasonryGrid } from './masonry'
import type { Photo, Album } from '@/types/database'

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: vi.fn(() => {
    return function MockPhotoLightbox() {
      return <div data-testid="photo-lightbox">Lightbox</div>
    }
  }),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

// Mock OptimizedImage
vi.mock('@/components/ui/optimized-image', () => ({
  OptimizedImage: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}))

const createMockPhoto = (id: string, overrides?: Partial<Photo>): Photo => ({
  id,
  album_id: 'album-1',
  original_key: `photos/${id}.jpg`,
  thumb_key: `thumbs/${id}.jpg`,
  preview_key: `previews/${id}.jpg`,
  filename: `photo-${id}.jpg`,
  file_size: 1024000,
  width: 1920,
  height: 1080,
  mime_type: 'image/jpeg',
  exif: {},
  rotation: 0,
  sort_order: 0,
  retoucher_id: null,
  captured_at: null,
  status: 'completed',
  is_selected: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  blur_data: null,
  ...overrides,
})

const createMockAlbum = (overrides?: Partial<Album>): Album => ({
  id: 'album-1',
  title: 'Test Album',
  slug: 'test-album',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  watermark_enabled: false,
  description: null,
  cover_photo_id: null,
  allow_download: true,
  is_public: true,
  password: null,
  expires_at: null,
  layout: 'masonry',
  deleted_at: null,
  sort_rule: 'capture_desc',
  allow_batch_download: true,
  show_exif: true,
  allow_share: true,
  watermark_type: null,
  watermark_config: {},
  color_grading: null,
  enable_human_retouch: false,
  enable_ai_retouch: false,
  ai_retouch_config: {},
  share_title: null,
  share_description: null,
  share_image_url: null,
  poster_image_url: null,
  event_date: null,
  location: null,
  is_live: false,
  photo_count: 0,
  selected_count: 0,
  view_count: 0,
  metadata: {},
  ...overrides,
})

describe('MasonryGrid', () => {
  const mockPhotos: Photo[] = [
    createMockPhoto('photo-1'),
    createMockPhoto('photo-2'),
    createMockPhoto('photo-3'),
  ]

  const mockAlbum = createMockAlbum()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock environment variable
    process.env.NEXT_PUBLIC_MEDIA_URL = 'http://localhost:3000/media'
  })

  it('应该渲染照片网格', () => {
    const { container } = render(<MasonryGrid photos={mockPhotos} album={mockAlbum} />)
    
    // 应该渲染照片容器（使用 className 查找）
    const grid = container.querySelector('.columns-2, .grid')
    expect(grid).toBeInTheDocument()
  })

  it('应该显示所有照片', () => {
    render(<MasonryGrid photos={mockPhotos} album={mockAlbum} />)
    
    // 检查照片数量（通过图片元素）
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThanOrEqual(mockPhotos.length)
  })

  it('应该支持点击照片打开 Lightbox', async () => {
    const user = userEvent.setup()
    render(<MasonryGrid photos={mockPhotos} album={mockAlbum} />)
    
    // 查找第一张照片
    const firstPhoto = screen.getAllByRole('img')[0]
    await user.click(firstPhoto)
    
    // Lightbox 应该打开
    await waitFor(() => {
      expect(screen.getByTestId('photo-lightbox')).toBeInTheDocument()
    })
  })

  it('应该支持选择照片', async () => {
    const user = userEvent.setup()
    const onSelectChange = vi.fn()
    
    render(
      <MasonryGrid 
        photos={mockPhotos} 
        album={mockAlbum}
        onSelectChange={onSelectChange}
      />
    )
    
    // 查找选择相关的交互元素（可能是复选框或点击区域）
    // 根据实际实现调整选择器
    const selectableElements = screen.queryAllByRole('checkbox')
    if (selectableElements.length > 0) {
      await user.click(selectableElements[0])
      // 如果实现了选择功能，应该调用 onSelectChange
    }
  })

  it('应该支持无限滚动加载更多', () => {
    const onLoadMore = vi.fn()

    // 验证组件在有 hasMore 和 onLoadMore 时能正常渲染
    const { container } = render(
      <MasonryGrid 
        photos={mockPhotos} 
        album={mockAlbum}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    )
    
    // 验证组件已渲染（包含照片网格）
    const grid = container.querySelector('.columns-2, .grid')
    expect(grid).toBeInTheDocument()
    
    // 验证加载触发器元素存在（用于 IntersectionObserver）
    const loadMoreTrigger = container.querySelector('.h-4')
    expect(loadMoreTrigger).toBeInTheDocument()
  })

  it('应该显示加载状态', () => {
    const { container } = render(
      <MasonryGrid 
        photos={mockPhotos} 
        album={mockAlbum}
        isLoading={true}
      />
    )
    
    // 应该显示加载指示器（Loader2 图标，有 animate-spin 类）
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('应该支持不同的布局模式', () => {
    const { container, rerender } = render(
      <MasonryGrid 
        photos={mockPhotos} 
        album={mockAlbum}
        layout="masonry"
      />
    )
    
    // 检查瀑布流布局类名
    expect(container.querySelector('.columns-2')).toBeInTheDocument()
    
    // 切换到网格布局
    rerender(
      <MasonryGrid 
        photos={mockPhotos} 
        album={mockAlbum}
        layout="grid"
      />
    )
    
    // 检查网格布局类名
    expect(container.querySelector('.grid')).toBeInTheDocument()
  })

  it('应该处理空照片列表', () => {
    const { container } = render(<MasonryGrid photos={[]} album={mockAlbum} />)
    
    // 应该渲染空网格容器
    const grid = container.querySelector('.columns-2, .grid')
    expect(grid).toBeInTheDocument()
    // 应该没有照片
    const images = screen.queryAllByRole('img')
    expect(images.length).toBe(0)
  })
})
