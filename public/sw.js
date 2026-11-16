/* Service worker do SquadStream: deixa o app instalável e acelera o carregamento.
 * NUNCA mexe em /api/* nem em outros domínios (Supabase, TURN): chamadas ao vivo sempre vão à rede. */
const CACHE = 'squadstream-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Página: rede primeiro (sempre pega a versão nova); sem rede, usa a última guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    )
    return
  }

  // Arquivos com hash no nome (/assets/*) nunca mudam: cache primeiro.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); void caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      })),
    )
  }
})
