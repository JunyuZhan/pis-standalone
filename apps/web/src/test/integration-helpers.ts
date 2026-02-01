/**
 * 集成测试辅助函数
 * 
 * 提供用于集成测试的工具函数，帮助创建和清理测试数据。
 */

import { createAdminClient } from '@/lib/database'
import { v4 as uuidv4 } from 'uuid'
import { generateAlbumSlug } from '@/lib/utils'

export interface TestAlbum {
  id: string
  title: string
  description?: string
  is_public?: boolean
}

export interface TestPhoto {
  id: string
  album_id: string
  filename: string
  mime_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * 创建测试相册
 */
export async function createTestAlbum(overrides: Partial<TestAlbum> = {}): Promise<TestAlbum> {
  const adminClient = await createAdminClient()
  
  const albumData = {
    title: overrides.title || `Test Album ${Date.now()}`,
    slug: generateAlbumSlug(), // 生成唯一 slug
    description: overrides.description || 'Integration test album',
    is_public: overrides.is_public ?? false,
  }

  const { data: album, error } = await adminClient.insert('albums', albumData)
  
  if (error || !album || album.length === 0) {
    throw new Error(`Failed to create test album: ${error?.message}`)
  }
  
  return album[0] as unknown as TestAlbum
}

/**
 * 删除测试相册
 */
export async function deleteTestAlbum(albumId: string): Promise<void> {
  const adminClient = await createAdminClient()
  
  // 先删除相册中的所有照片
  await adminClient.from('photos').delete().eq('album_id', albumId)
  
  // 然后删除相册
  const { error } = await adminClient.from('albums').delete().eq('id', albumId)
  
  if (error) {
    throw new Error(`Failed to delete test album: ${error.message}`)
  }
}

/**
 * 创建测试照片记录
 */
export async function createTestPhoto(
  albumId: string,
  overrides: Partial<TestPhoto> = {}
): Promise<TestPhoto> {
  const adminClient = await createAdminClient()
  
  const photoData = {
    id: overrides.id || uuidv4(),
    album_id: albumId,
    filename: overrides.filename || 'test.jpg',
    mime_type: overrides.mime_type || 'image/jpeg',
    status: overrides.status || 'pending',
    original_key: `raw/${albumId}/${overrides.id || uuidv4()}.jpg`,
  }

  const { data: photo, error } = await adminClient.insert('photos', photoData)

  if (error || !photo || photo.length === 0) {
    throw new Error(`Failed to create test photo: ${error?.message}`)
  }

  return photo[0] as TestPhoto
}

/**
 * 删除测试照片
 */
export async function deleteTestPhoto(photoId: string): Promise<void> {
  const adminClient = await createAdminClient()
  
  const { error } = await adminClient.from('photos').delete().eq('id', photoId)
  
  if (error) {
    throw new Error(`Failed to delete test photo: ${error.message}`)
  }
}

/**
 * 批量删除测试照片
 */
export async function deleteTestPhotos(photoIds: string[]): Promise<void> {
  if (photoIds.length === 0) return

  const adminClient = await createAdminClient()
  
  const { error } = await adminClient.from('photos').delete().in('id', photoIds)
  
  if (error) {
    throw new Error(`Failed to delete test photos: ${error.message}`)
  }
}

/**
 * 清理所有测试数据
 */
export async function cleanupTestData(albumIds: string[], photoIds: string[]): Promise<void> {
  // 删除照片
  if (photoIds.length > 0) {
    await deleteTestPhotos(photoIds)
  }

  // 删除相册
  for (const albumId of albumIds) {
    await deleteTestAlbum(albumId)
  }
}
