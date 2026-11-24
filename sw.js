const CACHE = 'bbb-demo-v8'
const SHELL = [
  './', './index.html', './styles.css', './app.js', './inventory.js', './media.js',
  './manifest.webmanifest', './assets/dm-sans.woff2', './assets/icon-192.png',
  './assets/icon-512.png', './assets/ejemplo.webp', './assets/remera.webp', './assets/pantalon.webp',
]

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(SHELL)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('bbb-demo-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

const assets = new Set(SHELL.map(path => new URL(path, self.location).href))
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.mode === 'navigate' && new URL(request.url).origin === self.location.origin) {
    event.respondWith(caches.match(new URL('./index.html', self.location).href).then(cached => cached ?? fetch(request)))
    return
  }
  if (assets.has(request.url)) event.respondWith(caches.match(request).then(cached => cached ?? fetch(request)))
})
