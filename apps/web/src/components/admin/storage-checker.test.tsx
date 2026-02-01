import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StorageChecker } from './storage-checker'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('StorageChecker', () => {
  const mockAlbumId = 'test-album-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染存储检查组件', () => {
    render(<StorageChecker albumId={mockAlbumId} />)
    
    expect(screen.getByText('存储一致性检查')).toBeInTheDocument()
    expect(screen.getByText(/检查相册在 MinIO 中的文件情况/)).toBeInTheDocument()
    expect(screen.getByText('开始检查')).toBeInTheDocument()
  })

  it('应该能够触发检查', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        album: {
          id: mockAlbumId,
          title: '测试相册',
        },
        summary: {
          dbPhotos: 10,
          rawFiles: 10,
          processedFiles: 20,
          missingInStorage: 0,
          missingInDb: 0,
        },
        details: {
          dbPhotos: [],
          missingInStorage: [],
          missingInDb: [],
        },
      }),
    })
    global.fetch = mockFetch

    render(<StorageChecker albumId={mockAlbumId} />)
    
    const checkButton = screen.getByText('开始检查')
    await user.click(checkButton)
    
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/admin/albums/${mockAlbumId}/check-storage`
    )
    
    await waitFor(() => {
      expect(screen.getByText('检查摘要')).toBeInTheDocument()
    })
  })

  it('应该显示检查摘要', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        album: { id: mockAlbumId, title: '测试相册' },
        summary: {
          dbPhotos: 10,
          rawFiles: 10,
          processedFiles: 20,
          missingInStorage: 0,
          missingInDb: 0,
        },
        details: {
          dbPhotos: [],
          missingInStorage: [],
          missingInDb: [],
        },
      }),
    })
    global.fetch = mockFetch

    render(<StorageChecker albumId={mockAlbumId} />)
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(screen.getByText('检查摘要')).toBeInTheDocument()
      expect(screen.getByText('数据库照片数')).toBeInTheDocument()
      expect(screen.getByText('原始文件数')).toBeInTheDocument()
      expect(screen.getByText('处理文件数')).toBeInTheDocument()
      
      // 检查数字值（可能有多个"10"，使用 getAllByText 然后检查上下文）
      const dbPhotosLabels = screen.getAllByText('数据库照片数')
      expect(dbPhotosLabels.length).toBeGreaterThan(0)
      
      // 检查是否显示通过状态
      const passText = screen.queryByText('存储一致性检查通过')
      expect(passText).toBeInTheDocument()
    })
  })

  it('应该显示存储中缺失的文件', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        album: { id: mockAlbumId, title: '测试相册' },
        summary: {
          dbPhotos: 10,
          rawFiles: 8,
          processedFiles: 18,
          missingInStorage: 2,
          missingInDb: 0,
        },
        details: {
          dbPhotos: [],
          missingInStorage: [
            '原始文件: raw/test-album-id/photo1.jpg',
            '缩略图: processed/test-album-id/thumb1.jpg',
          ],
          missingInDb: [],
        },
      }),
    })
    global.fetch = mockFetch

    render(<StorageChecker albumId={mockAlbumId} />)
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(screen.getByText('存储中缺失的文件 (2)')).toBeInTheDocument()
      expect(screen.getByText(/原始文件: raw\/test-album-id\/photo1\.jpg/)).toBeInTheDocument()
      expect(screen.getByText(/缩略图: processed\/test-album-id\/thumb1\.jpg/)).toBeInTheDocument()
    })
  })

  it('应该显示数据库中缺失的文件', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        album: { id: mockAlbumId, title: '测试相册' },
        summary: {
          dbPhotos: 10,
          rawFiles: 12,
          processedFiles: 22,
          missingInStorage: 0,
          missingInDb: 2,
        },
        details: {
          dbPhotos: [],
          missingInStorage: [],
          missingInDb: [
            '原始文件: raw/test-album-id/orphan1.jpg',
            '处理文件: processed/test-album-id/orphan2.jpg',
          ],
        },
      }),
    })
    global.fetch = mockFetch

    render(<StorageChecker albumId={mockAlbumId} />)
    
    await user.click(screen.getByText('开始检查'))
    
    await waitFor(() => {
      expect(screen.getByText('数据库中缺失的文件 (2)')).toBeInTheDocument()
      expect(screen.getByText(/原始文件: raw\/test-album-id\/orphan1\.jpg/)).toBeInTheDocument()
      expect(screen.getByText(/处理文件: processed\/test-album-id\/orphan2\.jpg/)).toBeInTheDocument()
    })
  })

  it('应该处理检查失败', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: '检查失败' },
      }),
    })
    global.fetch = mockFetch

    render(<StorageChecker albumId={mockAlbumId} />)
    
    await user.click(screen.getByText('开始检查'))
    
    // 应该显示错误（通过 toast，这里只验证请求失败）
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('应该在检查时显示加载状态', async () => {
    const user = userEvent.setup()
    let resolvePromise: (value: any) => void
    mockFetch.mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePromise = resolve
      })
    })
    global.fetch = mockFetch

    render(<StorageChecker albumId={mockAlbumId} />)
    
    await user.click(screen.getByText('开始检查'))
    
    expect(screen.getByText('检查中...')).toBeInTheDocument()
    
    resolvePromise!({
      ok: true,
      json: async () => ({
        album: { id: mockAlbumId, title: '测试相册' },
        summary: { dbPhotos: 0, rawFiles: 0, processedFiles: 0, missingInStorage: 0, missingInDb: 0 },
        details: { dbPhotos: [], missingInStorage: [], missingInDb: [] },
      }),
    })
  })
})
