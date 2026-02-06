import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { ApiError } from '@/lib/validation/error-handler'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/analytics/albums/[id]
 * 获取单个相册的详细统计数据
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // 验证管理员权限
  const admin = await requireAdmin(request)
  if (!admin) {
    return ApiError.forbidden('需要管理员权限')
  }

  const { id: albumId } = await params

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'

    const db = await createAdminClient()

    // 验证相册存在
    const { data: album } = await db.from('albums')
      .select('id, title, slug, photo_count, created_at')
      .eq('id', albumId)
      .single()

    if (!album) {
      return ApiError.notFound('相册不存在')
    }

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
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }

    const startDateStr = startDate.toISOString()

    // 获取访问统计
    const { data: viewStats } = await db.query(`
      SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT session_id) as unique_visitors,
        COUNT(DISTINCT viewer_ip) as unique_ips
      FROM album_views 
      WHERE album_id = $1 AND viewed_at >= $2
    `, [albumId, startDateStr])

    // 获取照片查看统计
    const { data: photoStats } = await db.query(`
      SELECT COUNT(*) as photo_views
      FROM photo_views 
      WHERE album_id = $1 AND viewed_at >= $2
    `, [albumId, startDateStr])

    // 获取下载统计
    const { data: downloadStats } = await db.query(`
      SELECT 
        COUNT(*) as download_count,
        COALESCE(SUM(file_count), 0) as total_files,
        COALESCE(SUM(total_size), 0) as total_size
      FROM download_logs 
      WHERE album_id = $1 AND downloaded_at >= $2
    `, [albumId, startDateStr])

    // 获取每日趋势
    const { data: dailyTrend } = await db.query(`
      SELECT 
        DATE(viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as visitors
      FROM album_views 
      WHERE album_id = $1 AND viewed_at >= $2
      GROUP BY DATE(viewed_at)
      ORDER BY date ASC
    `, [albumId, startDateStr])

    // 获取每小时分布（最近 7 天）
    const { data: hourlyDistribution } = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM viewed_at) as hour,
        COUNT(*) as count
      FROM album_views 
      WHERE album_id = $1 AND viewed_at >= $2
      GROUP BY EXTRACT(HOUR FROM viewed_at)
      ORDER BY hour
    `, [albumId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()])

    // 获取设备类型分布
    const { data: deviceStats } = await db.query(`
      SELECT device_type, COUNT(*) as count
      FROM album_views 
      WHERE album_id = $1 AND viewed_at >= $2
      GROUP BY device_type
    `, [albumId, startDateStr])

    // 获取来源分布
    const { data: refererStats } = await db.query(`
      SELECT 
        CASE 
          WHEN viewer_referer IS NULL OR viewer_referer = '' THEN '直接访问'
          WHEN viewer_referer LIKE '%weixin%' OR viewer_referer LIKE '%wechat%' THEN '微信'
          WHEN viewer_referer LIKE '%weibo%' THEN '微博'
          WHEN viewer_referer LIKE '%google%' THEN 'Google'
          WHEN viewer_referer LIKE '%baidu%' THEN '百度'
          ELSE '其他来源'
        END as source,
        COUNT(*) as count
      FROM album_views 
      WHERE album_id = $1 AND viewed_at >= $2
      GROUP BY source
      ORDER BY count DESC
    `, [albumId, startDateStr])

    // 获取热门照片
    const { data: topPhotos } = await db.query(`
      SELECT 
        pv.photo_id,
        p.filename,
        p.thumbnail_url,
        COUNT(*) as views
      FROM photo_views pv
      JOIN photos p ON pv.photo_id = p.id
      WHERE pv.album_id = $1 AND pv.viewed_at >= $2
      GROUP BY pv.photo_id, p.filename, p.thumbnail_url
      ORDER BY views DESC
      LIMIT 10
    `, [albumId, startDateStr])

    // 获取最近访问记录
    const { data: recentViews } = await db.query(`
      SELECT 
        viewed_at,
        device_type,
        browser,
        os,
        viewer_referer
      FROM album_views 
      WHERE album_id = $1
      ORDER BY viewed_at DESC
      LIMIT 20
    `, [albumId])

    return NextResponse.json({
      album,
      period,
      startDate: startDateStr,
      summary: {
        totalViews: parseInt(viewStats?.[0]?.total_views || '0'),
        uniqueVisitors: parseInt(viewStats?.[0]?.unique_visitors || '0'),
        uniqueIps: parseInt(viewStats?.[0]?.unique_ips || '0'),
        photoViews: parseInt(photoStats?.[0]?.photo_views || '0'),
        downloads: parseInt(downloadStats?.[0]?.download_count || '0'),
        downloadedFiles: parseInt(downloadStats?.[0]?.total_files || '0'),
        downloadedSize: parseInt(downloadStats?.[0]?.total_size || '0'),
      },
      dailyTrend: dailyTrend || [],
      hourlyDistribution: hourlyDistribution || [],
      deviceStats: deviceStats || [],
      refererStats: refererStats || [],
      topPhotos: topPhotos || [],
      recentViews: recentViews || [],
    })
  } catch (error) {
    console.error('获取相册统计失败:', error)
    return ApiError.internal('获取相册统计失败')
  }
}
