
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { ApiError, handleError } from '@/lib/validation/error-handler'

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const paramsData = await params
  const { slug } = paramsData
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return ApiError.badRequest('No file uploaded')
    }
    
    // 0. 获取相册 ID
    const db = await createClient()
    const { data: album, error: albumError } = await db
      .from('albums')
      .select('id')
      .eq('slug', slug)
      .single()

    if (albumError || !album) {
      return ApiError.notFound('Album not found')
    }

    const albumId = (album as { id: string }).id
    
    // 1. 调用 AI 服务提取特征
    // 在 Docker 网络中，AI 服务地址为 http://ai:8000
    // 如果在本地开发，可能需要配置 AI_SERVICE_URL
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:8000'
    
    const aiFormData = new FormData()
    aiFormData.append('file', file)
    
    const aiRes = await fetch(`${aiServiceUrl}/extract`, {
      method: 'POST',
      body: aiFormData,
    })
    
    if (!aiRes.ok) {
      throw new Error(`AI service error: ${aiRes.statusText}`)
    }
    
    const aiData = await aiRes.json()
    const faces = aiData.faces
    
    if (!faces || faces.length === 0) {
      return NextResponse.json({ photos: [] })
    }
    
    // 假设只搜索第一个人脸
    const embedding = faces[0].embedding
    const vectorStr = `[${embedding.join(',')}]`
    
    // 2. 数据库向量搜索
    const { data: matchesData, error } = await db.rpc('search_faces', {
      query_embedding: vectorStr,
      match_threshold: 0.6, // 相似度阈值
      match_count: 50,
      filter_album_id: albumId
    })
    
    if (error) throw error
    
    const matches = matchesData as Array<{ photo_id: string; similarity: number }> | null
    
    if (!matches || matches.length === 0) {
      return NextResponse.json({ photos: [] })
    }

    // 3. 获取照片详情
    const photoIds = matches.map((m) => m.photo_id)
    
    const { data: photos } = await db
      .from('photos')
      .select('*')
      .in('id', photoIds)
      .eq('status', 'completed')
      
    return NextResponse.json({ photos: photos || [] })
    
  } catch (err: any) {
    return handleError(err, 'Search failed')
  }
}
