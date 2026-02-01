/**
 * Cloudflare CDN Cache Purge Utility (Worker version)
 * 
 * Used to purge CDN cache when photos are deleted, ensuring deleted photos cannot be accessed via CDN
 */

interface PurgeCacheOptions {
  urls: string[]
  zoneId?: string
  apiToken?: string
}

interface PurgeCacheResult {
  success: boolean
  purgedUrls: string[]
  failedUrls: string[]
  error?: string
}

/**
 * Purge Cloudflare CDN cache
 * 
 * @param options Purge options
 * @returns Purge result
 */
export async function purgeCloudflareCache(
  options: PurgeCacheOptions
): Promise<PurgeCacheResult> {
  const { urls, zoneId, apiToken } = options

  // Skip purge if not configured
  if (!zoneId || !apiToken) {
    console.warn('[Cloudflare Purge] Zone ID or API Token not configured, skipping cache purge')
    return {
      success: false,
      purgedUrls: [],
      failedUrls: urls,
      error: 'Cloudflare API not configured',
    }
  }

  if (urls.length === 0) {
    return {
      success: true,
      purgedUrls: [],
      failedUrls: [],
    }
  }

  try {
    // Cloudflare API limit: maximum 30 URLs per request
    const BATCH_SIZE = 30
    const batches: string[][] = []
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      batches.push(urls.slice(i, i + BATCH_SIZE))
    }

    const purgedUrls: string[] = []
    const failedUrls: string[] = []

    // Purge in batches
    for (const batch of batches) {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              files: batch,
            }),
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('[Cloudflare Purge] Failed to purge cache:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            urls: batch,
          })
          failedUrls.push(...batch)
        } else {
          const result = (await response.json()) as { success: boolean; errors?: unknown[] }
          if (result.success) {
            purgedUrls.push(...batch)
          } else {
            console.error('[Cloudflare Purge] API returned success=false:', result.errors)
            failedUrls.push(...batch)
          }
        }
      } catch (error) {
        console.error('[Cloudflare Purge] Error purging batch:', error)
        failedUrls.push(...batch)
      }

      // Avoid rate limiting: delay 100ms between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return {
      success: failedUrls.length === 0,
      purgedUrls,
      failedUrls,
      ...(failedUrls.length > 0 && {
        error: `Failed to purge ${failedUrls.length} URLs`,
      }),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Cloudflare Purge] Unexpected error:', error)
    return {
      success: false,
      purgedUrls: [],
      failedUrls: urls,
      error: errorMessage,
    }
  }
}

/**
 * Build complete image URL (for cache purging)
 * 
 * @param mediaUrl Media server base URL
 * @param imageKey Image storage path (e.g., processed/thumbs/xxx.jpg)
 * @returns Complete image URL
 */
export function buildImageUrl(mediaUrl: string, imageKey: string): string {
  const baseUrl = mediaUrl.replace(/\/$/, '')
  const key = imageKey.replace(/^\//, '')
  return `${baseUrl}/${key}`
}

/**
 * Purge photo CDN cache
 * 
 * @param mediaUrl Media server base URL
 * @param photo Photo object (contains original_key, thumb_key, preview_key)
 * @param zoneId Cloudflare Zone ID (optional, from environment variables)
 * @param apiToken Cloudflare API Token (optional, from environment variables)
 * @returns Purge result
 */
export async function purgePhotoCache(
  mediaUrl: string,
  photo: {
    original_key?: string | null
    thumb_key?: string | null
    preview_key?: string | null
  },
  zoneId?: string,
  apiToken?: string
): Promise<PurgeCacheResult> {
  const urls: string[] = []

  // Build all image URLs
  if (photo.original_key) {
    urls.push(buildImageUrl(mediaUrl, photo.original_key))
  }
  if (photo.thumb_key) {
    urls.push(buildImageUrl(mediaUrl, photo.thumb_key))
  }
  if (photo.preview_key) {
    urls.push(buildImageUrl(mediaUrl, photo.preview_key))
  }

  if (urls.length === 0) {
    return {
      success: true,
      purgedUrls: [],
      failedUrls: [],
    }
  }

  // Use provided parameters or get from environment variables
  const finalZoneId = zoneId || process.env.CLOUDFLARE_ZONE_ID
  const finalApiToken = apiToken || process.env.CLOUDFLARE_API_TOKEN

  return purgeCloudflareCache({
    urls,
    zoneId: finalZoneId,
    apiToken: finalApiToken,
  })
}
