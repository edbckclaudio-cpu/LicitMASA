const CACHE_NAME = 'licitmasa-v1'
const PRECACHE_URLS = ['/', '/robots.txt']
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})
async function networkThenCache(request) {
  try {
    const response = await fetch(request)
    const clone = response.clone()
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, clone)
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/')
      if (fallback) return fallback
    }
    return new Response('', { status: 503 })
  }
}
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  const isAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/firebase-messaging-sw.js')
  if (req.method !== 'GET') return
  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cached) => cached || networkThenCache(req))
    )
    return
  }
  if (req.mode === 'navigate') {
    event.respondWith(networkThenCache(req))
    return
  }
  event.respondWith(networkThenCache(req))
})
