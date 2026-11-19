/* Hierapolis Reborn media cache (production only; registered from src/main.tsx).
 * The build replaces the manifest below with { "/terrain/sat.jpg": "<content hash>", ... } for every media
 * file under public/. Matching same-origin GETs are served cache-first, keyed by URL + hash, so repeat visits
 * load terrain, models, textures and audio from Cache Storage and a deploy re-downloads only changed files.
 * Cross-origin requests (Google 3D Tiles, fonts) are never touched: Google's Map Tiles policies forbid
 * storing tile content outside the browser's normal HTTP cache. */
const MANIFEST = self.__MEDIA_MANIFEST__ || {}
const CACHE = 'hierapolis-media-v1'

const keyFor = (path) => (MANIFEST[path] ? `${path}?v=${MANIFEST[path]}` : null)

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // drop other cache generations and entries whose file changed or disappeared
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name)
    const cache = await caches.open(CACHE)
    const wanted = new Set(Object.keys(MANIFEST).map(keyFor))
    for (const req of await cache.keys()) {
      const u = new URL(req.url)
      if (!wanted.has(u.pathname + u.search)) await cache.delete(req)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const key = keyFor(url.pathname)
  if (!key) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(key)
    if (hit) return hit
    const res = await fetch(req)
    if (res.ok && res.status === 200 && res.type === 'basic') {
      try { await cache.put(key, res.clone()) } catch { /* quota exceeded: serve uncached */ }
    }
    return res
  })())
})
