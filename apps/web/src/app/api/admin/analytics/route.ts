import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { ApiError } from '@/lib/validation/error-handler'

/**
 * GET /api/admin/analytics
 * 获取统计数据概览
 */
export async function GET(request: NextRequest) {
  // 验证管理员权限
  const admin = await requireAdmin(request)
  if (!admin) {
    return ApiError.forbidden('需要管理员权限')
  }

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d, all
    const albumId = searchParams.get('albumId')

    const db = await createAdminClient()

    // 计算时间范围
    let startDate: Date
    switch (period) {
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        startDate = new Date('2000-01-01')
        break
      default: // 7d
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }

    const startDateStr = startDate.toISOString()

    // 构建查询条件
    const albumFilter = albumId ? `AND album_id = '${albumId}'` : ''

    // 获取总访问量
    const { data: totalViews } = await db.query(`
      SELECT COUNT(*) as count 
      FROM album_views 
      WHERE viewed_at >= $1 ${albumFilter}
    `, [startDateStr])

    // 获取独立访客数
    const { data: uniqueVisitors } = await db.query(`
      SELECT COUNT(DISTINCT session_id) as count 
      FROM album_views 
      WHERE viewed_at >= $1 ${albumFilter}
    `, [startDateStr])

    // 获取照片查看量
    const { data: photoViews } = await db.query(`
      SELECT COUNT(*) as count 
      FROM photo_views 
      WHERE viewed_at >= $1 ${albumId ? `AND album_id = '${albumId}'` : ''}
    `, [startDateStr])

    // 获取下载次数
    const { data: downloads } = await db.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(file_count), 0) as files
      FROM download_logs 
      WHERE downloaded_at >= $1 ${albumId ? `AND album_id = '${albumId}'` : ''}
    `, [startDateStr])

    // 获取每日趋势数据
    const { data: dailyTrend } = await db.query(`
      SELECT 
        DATE(viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as visitors
      FROM album_views 
      WHERE viewed_at >= $1 ${albumFilter}
      GROUP BY DATE(viewed_at)
      ORDER BY date ASC
    `, [startDateStr])

    // 获取设备类型分布
    const { data: deviceStats } = await db.query(`
      SELECT 
        device_type,
        COUNT(*) as count
      FROM album_views 
      WHERE viewed_at >= $1 ${albumFilter}
      GROUP BY device_type
      ORDER BY count DESC
    `, [startDateStr])

    // 获取浏览器分布
    const { data: browserStats } = await db.query(`
      SELECT 
        browser,
        COUNT(*) as count
      FROM album_views 
      WHERE viewed_at >= $1 ${albumFilter}
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 5
    `, [startDateStr])

    // 获取热门相册（如果没有指定相册）
    let topAlbums = null
    if (!albumId) {
      const { data: albums } = await db.query(`
        SELECT 
          av.album_id,
          a.title,
          a.slug,
          COUNT(*) as views,
          COUNT(DISTINCT av.session_id) as visitors
        FROM album_views av
        JOIN albums a ON av.album_id = a.id
        WHERE av.viewed_at >= $1
        GROUP BY av.album_id, a.title, a.slug
        ORDER BY views DESC
        LIMIT 10
      `, [startDateStr])
      topAlbums = albums
    }

    // 获取热门照片
    const { data: topPhotos } = await db.query(`
      SELECT 
        pv.photo_id,
        p.filename,
        p.thumbnail_url,
        COUNT(*) as views
      FROM photo_views pv
      JOIN photos p ON pv.photo_id = p.id
      WHERE pv.viewed_at >= $1 ${albumId ? `AND pv.album_id = '${albumId}'` : ''}
      GROUP BY pv.photo_id, p.filename, p.thumbnail_url
      ORDER BY views DESC
      LIMIT 10
    `, [startDateStr])

    return NextResponse.json({
      period,
      startDate: startDateStr,
      summary: {
        totalViews: parseInt(totalViews?.[0]?.count || '0'),
        uniqueVisitors: parseInt(uniqueVisitors?.[0]?.count || '0'),
        photoViews: parseInt(photoViews?.[0]?.count || '0'),
        downloads: parseInt(downloads?.[0]?.count || '0'),
        downloadedFiles: parseInt(downloads?.[0]?.files || '0'),
      },
      dailyTrend: dailyTrend || [],
      deviceStats: deviceStats || [],
      browserStats: browserStats || [],
      topAlbums,
      topPhotos: topPhotos || [],
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return ApiError.internal('获取统计数据失败')
  }
}
