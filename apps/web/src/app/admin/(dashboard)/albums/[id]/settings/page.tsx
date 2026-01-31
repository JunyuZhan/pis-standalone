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

  return (
    <div className="max-w-2xl">
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
      <AlbumSettingsForm album={album} />
    </div>
  )
}
