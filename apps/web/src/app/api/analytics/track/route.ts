import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/postgresql-client'
import { headers } from 'next/headers'

/**
 * 解析 User-Agent 获取设备信息
 */
function parseUserAgent(ua: string): { deviceType: string; browser: string; os: string } {
  let deviceType = 'desktop'
  let browser = 'unknown'
  let os = 'unknown'

  // 设备类型检测
  if (/mobile/i.test(ua)) {
    deviceType = 'mobile'
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = 'tablet'
  }

  // 浏览器检测
  if (/firefox/i.test(ua)) {
    browser = 'Firefox'
  } else if (/edg/i.test(ua)) {
    browser = 'Edge'
  } else if (/chrome/i.test(ua)) {
    browser = 'Chrome'
  } else if (/safari/i.test(ua)) {
    browser = 'Safari'
  } else if (/opera|opr/i.test(ua)) {
    browser = 'Opera'
  }

  // 操作系统检测
  if (/windows/i.test(ua)) {
    os = 'Windows'
  } else if (/macintosh|mac os/i.test(ua)) {
    os = 'macOS'
  } else if (/linux/i.test(ua)) {
    os = 'Linux'
  } else if (/android/i.test(ua)) {
    os = 'Android'
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS'
  }

  return { deviceType, browser, os }
}

/**
 * 生成会话 ID（基于 IP 和日期，用于去重）
 */
function generateSessionId(ip: string): string {
  const today = new Date().toISOString().split('T')[0]
  return `${ip}-${today}-${Math.random().toString(36).substring(2, 8)}`
}

/**
 * POST /api/analytics/track
 * 记录访问事件
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, albumId, photoId, sessionId: clientSessionId } = body

    if (!type) {
      return NextResponse.json(
        { error: '缺少事件类型' },
        { status: 400 }
      )
    }

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 
               headersList.get('x-real-ip') || 
               'unknown'
    const ua = headersList.get('user-agent') || ''
    const referer = headersList.get('referer') || ''
    
    const { deviceType, browser, os } = parseUserAgent(ua)
    const sessionId = clientSessionId || generateSessionId(ip)

    const db = await createClient()

    switch (type) {
      case 'album_view': {
        if (!albumId) {
          return NextResponse.json(
            { error: '缺少相册 ID' },
            { status: 400 }
          )
        }

        // 检查是否是重复访问（同一会话 5 分钟内不重复记录）
        const { data: recentView } = await db.from('album_views')
          .select('id')
          .eq('album_id', albumId)
          .eq('session_id', sessionId)
          .gt('viewed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(1)
          .single()

        if (!recentView) {
          await db.from('album_views').insert({
            album_id: albumId,
            viewer_ip: ip,
            viewer_ua: ua,
            viewer_referer: referer,
            device_type: deviceType,
            browser,
            os,
            session_id: sessionId,
          })
        }
        break
      }

      case 'photo_view': {
        if (!photoId) {
          return NextResponse.json(
            { error: '缺少照片 ID' },
            { status: 400 }
          )
        }

        // 检查是否是重复查看（同一会话 1 分钟内不重复记录）
        const { data: recentPhotoView } = await db.from('photo_views')
          .select('id')
          .eq('photo_id', photoId)
          .eq('session_id', sessionId)
          .gt('viewed_at', new Date(Date.now() - 60 * 1000).toISOString())
          .limit(1)
          .single()

        if (!recentPhotoView) {
          await db.from('photo_views').insert({
            photo_id: photoId,
            album_id: albumId || null,
            viewer_ip: ip,
            session_id: sessionId,
          })
        }
        break
      }

      case 'download': {
        const { downloadType = 'single', fileCount = 1, totalSize } = body

        await db.from('download_logs').insert({
          photo_id: photoId || null,
          album_id: albumId || null,
          download_type: downloadType,
          file_count: fileCount,
          total_size: totalSize || null,
          downloader_ip: ip,
          session_id: sessionId,
        })
        break
      }

      default:
        return NextResponse.json(
          { error: '未知的事件类型' },
          { status: 400 }
        )
    }

    return NextResponse.json({ 
      success: true,
      sessionId,
    })
  } catch (error) {
    console.error('记录访问事件失败:', error)
    // 静默失败，不影响用户体验
    return NextResponse.json({ success: false })
  }
}
