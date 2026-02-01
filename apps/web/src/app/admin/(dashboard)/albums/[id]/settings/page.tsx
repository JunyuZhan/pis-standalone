import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/database'
import type { Database } from '@/types/database'
import { AlbumSettingsForm } from '@/components/admin/album-settings-form'

type Album = Database['public']['Tables']['albums']['Row']

interface AlbumSettingsPageProps {
  params: Promise<{ id: string }>
}

/**
 * 相册设置页
 */
export default async function AlbumSettingsPage({
  params,
}: AlbumSettingsPageProps) {
  const { id } = await params
  const db = await createClient()

  // 获取相册信息
  const albumResult = await db
    .from('albums')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (albumResult.error || !albumResult.data) {
    notFound()
  }

  const album = albumResult.data as Album

  // 获取封面照片的原图 key（用于风格预设预览）
  let coverOriginalKey: string | null = null
  if (album.cover_photo_id) {
    const coverPhotoResult = await db
      .from('photos')
      .select('original_key')
      .eq('id', album.cover_photo_id)
      .single()
    
    if (coverPhotoResult.data) {
      coverOriginalKey = (coverPhotoResult.data as { original_key: string | null }).original_key
    }
  }

  return (
    <div className="max-w-4xl lg:max-w-6xl">
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 text-text-secondary mb-6">
        <Link
          href={`/admin/albums/${id}`}
          className="flex items-center gap-1 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回相册
        </Link>
      </div>

      {/* 页面标题 */}
      <h1 className="text-2xl font-serif font-bold mb-8">相册设置</h1>

      {/* 设置表单组件 */}
      <AlbumSettingsForm album={album} coverOriginalKey={coverOriginalKey} />
    </div>
  )
}
