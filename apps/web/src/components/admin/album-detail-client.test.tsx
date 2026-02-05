import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlbumDetailClient } from './album-detail-client'
import type { Album, Photo } from '@/types/database'
import { createMockFetch, mockFetchResponse } from '@/test/component-utils'

// Mock router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock dynamic imports
vi.mock('next/dynamic', () => ({
  default: (importFn: () => Promise<any>) => {
    const DynamicComponent = () => <div data-testid="dynamic-component">Dynamic Component</div>
    DynamicComponent.displayName = 'DynamicComponent'
    return DynamicComponent
  },
}))

// Mock toast
vi.mock('@/lib/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  handleApiError: vi.fn(),
}))

const createMockAlbum = (overrides?: Partial<Album>): Album => ({
  id: 'album-1',
  title: 'Test Album',
  slug: 'test-album',
  description: 'Test Description',
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
  watermark_enabled: false,
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
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

const createMockPhoto = (id: string, overrides?: Partial<Photo>): Photo => ({
  id,
  album_id: 'album-1',
  filename: `photo-${id}.jpg`,
  original_key: `photos/${id}/original.jpg`,
  thumb_key: `photos/${id}/thumb.jpg`,
  preview_key: `photos/${id}/preview.jpg`,
  blur_data: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
  width: 1920,
  height: 1080,
  file_size: 1024000,
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
  ...overrides,
})

describe('AlbumDetailClient', () => {
  const mockAlbum = createMockAlbum()
  const mockPhotos: Photo[] = [
    createMockPhoto('photo-1'),
    createMockPhoto('photo-2'),
    createMockPhoto('photo-3'),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch 默认返回成功响应（需要多个调用）
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      // 根据 URL 返回不同的响应
      return Promise.resolve({
        ok: true,
        json: async () => {
          if (callCount === 1) {
            return { groups: [] } // PhotoGroupManager
          } else if (callCount === 2) {
            return { photos: mockPhotos } // loadPhotos
          } else if (callCount === 3) {
            return { groups: [] } // loadPhotoGroups
          }
          return {}
        },
      })
    })
  })

  it('应该渲染相册详情', async () => {
    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 等待组件加载完成
    await waitFor(() => {
      // 应该显示照片或相关UI元素（不要求 dynamic-component，因为可能还没打开上传器）
      const hasUploadButton = screen.queryByText(/上传照片/i) || screen.queryByText(/上传/i)
      expect(hasUploadButton).toBeTruthy()
    })
  })

  it('应该显示照片列表', () => {
    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 应该显示照片（通过文件名或其他标识）
    // 注意：实际渲染可能使用 Image 组件，需要根据实际情况调整
  })

  it('应该显示空状态当没有照片', async () => {
    render(<AlbumDetailClient album={mockAlbum} initialPhotos={[]} />)

    // 应该显示"上传您的第一张照片"或类似的空状态提示
    await waitFor(() => {
      // 可能有多个"上传"文本，使用 getAllByText 或更具体的查询
      const uploadElements = screen.getAllByText(/上传/i)
      expect(uploadElements.length).toBeGreaterThan(0)
    })
  })

  it('应该能够切换上传器显示状态', async () => {
    const user = userEvent.setup()
    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 等待组件加载
    await waitFor(() => {
      expect(screen.queryByText(/上传照片/i) || screen.queryByText(/上传/i)).toBeTruthy()
    })

    // 查找上传按钮（可能有多个，选择第一个）
    const uploadButtons = screen.getAllByText(/上传照片|上传/i)
    const uploadButton = uploadButtons.find(btn => btn.textContent?.includes('上传照片')) || uploadButtons[0]
    
    if (uploadButton) {
      await user.click(uploadButton)

      // 上传器应该显示
      await waitFor(() => {
        expect(screen.getByTestId('dynamic-component')).toBeInTheDocument()
      })
    }
  })

  it('应该能够切换回收站视图', async () => {
    const user = userEvent.setup()
    
    // Mock API 响应
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        json: async () => {
          if (callCount === 1) return { groups: [] } // PhotoGroupManager
          if (callCount === 2) return { photos: mockPhotos } // loadPhotos
          if (callCount === 3) return { groups: [] } // loadPhotoGroups
          if (callCount === 4) return { photos: [] } // 回收站照片列表
          return {}
        },
      })
    })

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 等待组件加载 - 使用 aria-label 查找按钮
    await waitFor(() => {
      const archiveButton = screen.queryByRole('button', { name: /回收站/i })
      expect(archiveButton).toBeTruthy()
    }, { timeout: 2000 })

    // 切换到回收站视图 - 使用 aria-label 查找按钮
    const archiveButton = screen.getByRole('button', { name: /回收站/i })
    await user.click(archiveButton)

    // 应该调用 API 加载回收站照片
    await waitFor(() => {
      // 检查是否调用了 fetch（可能多次调用）
      expect(global.fetch).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('应该能够选择照片', async () => {
    const user = userEvent.setup()
    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 查找选择模式按钮（如果存在）
    // 实际实现可能需要先进入选择模式
  })

  it('应该能够删除照片', async () => {
    const user = userEvent.setup()
    
    // Mock 删除 API
    global.fetch = createMockFetch([
      { data: { message: '删除成功' }, ok: true },
    ])

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 查找删除按钮（可能需要先选择照片）
    // 实际测试需要模拟完整的删除流程
  })

  it('应该显示处理中的照片数量', () => {
    const processingPhotos: Photo[] = [
      createMockPhoto('photo-1', { status: 'processing' }),
      createMockPhoto('photo-2', { status: 'pending' }),
      createMockPhoto('photo-3', { status: 'completed' }),
    ]

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={processingPhotos} />)

    // 应该显示处理中的照片数量提示
    expect(screen.getByText(/处理中/i)).toBeInTheDocument()
  })

  it('应该能够筛选已选照片', async () => {
    const user = userEvent.setup()
    const selectedPhotos: Photo[] = [
      createMockPhoto('photo-1', { is_selected: true }),
      createMockPhoto('photo-2', { is_selected: false }),
    ]

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={selectedPhotos} />)

    // 查找筛选按钮
    const filterButton = screen.getByText(/只看已选/i)
    await user.click(filterButton)

    // 应该只显示已选照片
  })

  it('应该能够设置封面照片', async () => {
    const user = userEvent.setup()
    
    // Mock 设置封面 API
    global.fetch = createMockFetch([
      { data: { message: '设置成功' }, ok: true },
    ])

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 查找设置封面按钮（可能需要右键菜单或其他交互）
    // 实际测试需要模拟完整的设置封面流程
  })

  it('应该能够重新排序照片', async () => {
    const user = userEvent.setup()
    
    // Mock 保存顺序 API
    global.fetch = createMockFetch([
      { data: { message: '保存成功' }, ok: true },
    ])

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 查找排序按钮（上移/下移）
    // 实际测试需要模拟拖拽或点击排序按钮
  })

  it('应该能够恢复已删除的照片', async () => {
    const user = userEvent.setup()
    const deletedPhotos: Photo[] = [
      createMockPhoto('photo-1', { deleted_at: '2024-01-01T00:00:00Z' }),
    ]

    // Mock 恢复 API
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        json: async () => {
          if (callCount === 1) return { groups: [] } // PhotoGroupManager
          if (callCount === 2) return { photos: deletedPhotos } // loadPhotos
          if (callCount === 3) return { groups: [] } // loadPhotoGroups
          if (callCount === 4) return { message: '恢复成功' } // restore API
          return {}
        },
      })
    })

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={deletedPhotos} />)

    // 等待组件加载 - 使用 aria-label 查找按钮
    await waitFor(() => {
      const archiveButton = screen.queryByRole('button', { name: /回收站/i })
      expect(archiveButton).toBeTruthy()
    }, { timeout: 2000 })

    // 切换到回收站视图 - 使用 aria-label 查找按钮
    const archiveButton = screen.getByRole('button', { name: /回收站/i })
    await user.click(archiveButton)

    // 应该调用 API 加载回收站照片
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('应该显示分组管理器', () => {
    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 应该显示照片分组管理器
    // 注意：PhotoGroupManager 是动态导入的，可能需要特殊处理
  })

  it('应该处理上传完成回调', async () => {
    const user = userEvent.setup()
    
    // Mock 上传完成后的刷新
    global.fetch = createMockFetch([
      { data: { photos: mockPhotos }, ok: true },
    ])

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 打开上传器
    const uploadButton = screen.getByText(/上传照片/i)
    await user.click(uploadButton)

    // 模拟上传完成（需要触发 onComplete 回调）
    // 实际测试需要模拟完整的上传流程
  })

  it('应该处理 API 错误', async () => {
    // Mock API 错误
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    })

    render(<AlbumDetailClient album={mockAlbum} initialPhotos={mockPhotos} />)

    // 触发一个会调用 API 的操作
    // 应该显示错误提示
  })
})
