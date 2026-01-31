// PIS Service Worker
// 更新版本号以清除旧缓存（当更新 logo 或其他静态资源时，请更新此版本号）
const CACHE_NAME = 'pis-cache-v4';
const STATIC_CACHE = 'pis-static-v4';
const IMAGE_CACHE = 'pis-images-v4';

// 静态资源缓存列表
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// 安装事件
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活事件
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== IMAGE_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') return;

  // 跳过 API 请求
  if (url.pathname.startsWith('/api/')) return;

  // 跳过 Supabase 请求（向后兼容，仅在混合模式下使用）
  if (url.hostname.includes('supabase')) return;

  // 跳过外部媒体服务器请求（NEXT_PUBLIC_MEDIA_URL）- 这些请求应该直接通过，不经过 Service Worker
  // 检查是否是跨域请求（外部媒体服务器）
  const isExternalRequest = url.origin !== self.location.origin;
  
  // 如果是外部请求（媒体服务器），直接跳过，让浏览器正常处理
  if (isExternalRequest) {
    return;
  }

  // 图片缓存策略：仅缓存同源的图片（本地静态资源）
  // 只处理同源的图片请求，外部媒体 URL 已在上面的检查中跳过
  if (
    request.destination === 'image' ||
    url.pathname.includes('/processed/') ||
    url.pathname.includes('/thumbs/')
  ) {
    // 再次确认是同源请求（双重检查）
    if (url.origin === self.location.origin) {
      event.respondWith(
        caches.open(IMAGE_CACHE).then((cache) => {
          return cache.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            return fetch(request).then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            }).catch(() => {
              // 返回占位图
              return caches.match('/icons/placeholder.png');
            });
          });
        })
      );
      return;
    }
  }

  // 页面请求：网络优先，离线时使用缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 缓存成功的页面响应
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline');
          });
        })
    );
    return;
  }

  // 其他静态资源：网络优先（确保 logo 等资源能及时更新）
  // 特别处理图标文件，使用网络优先策略
  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败时使用缓存
          return caches.match(request);
        })
    );
    return;
  }

  // 其他静态资源：缓存优先
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// 后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-selections') {
    console.log('[SW] Syncing selections...');
    // 可以在这里实现离线选片的同步
  }
});

// 推送通知
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png', // 使用主图标作为 badge
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// 消息处理
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_IMAGES') {
    const urls = event.data.urls;
    caches.open(IMAGE_CACHE).then((cache) => {
      urls.forEach((url) => {
        cache.add(url).catch(() => {});
      });
    });
  }
});
