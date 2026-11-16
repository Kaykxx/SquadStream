/**
 * Função serverless (Vercel): entrega servidores ICE ao navegador.
 * As chaves da Metered ficam SÓ aqui (variáveis sem prefixo VITE_), nunca no JavaScript do site.
 *
 * Variáveis de ambiente (Vercel > Settings > Environment Variables):
 *   METERED_APP         ex.: meuapp.metered.live        (domínio do app na Metered)
 *   METERED_SECRET_KEY  chave secreta do app (cria credenciais temporárias)
 * Fallback opcional, se a API de credenciais não estiver disponível no seu plano:
 *   TURN_URLS (separadas por vírgula), TURN_USERNAME, TURN_CREDENTIAL
 */

interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}
interface Res {
  status: (code: number) => Res
  setHeader: (k: string, v: string) => void
  json: (body: unknown) => void
}
interface IceServer { urls: string | string[]; username?: string; credential?: string }

const STUN: IceServer = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }

// Uma credencial temporária compartilhada, renovada de tempos em tempos (a Metered leva até ~2 min
// para propagar uma credencial nova, por isso não criamos uma por visitante).
const EXPIRY_SECONDS = 12 * 60 * 60
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000
let cached: { servers: IceServer[]; createdAt: number } | null = null

async function fetchTemporary(): Promise<IceServer[] | null> {
  const app = process.env.METERED_APP?.trim()
  const secret = process.env.METERED_SECRET_KEY?.trim()
  if (!app || !secret || !/^[a-z0-9-]+\.metered\.live$/i.test(app)) return null
  try {
    const created = await fetch(`https://${app}/api/v1/turn/credential?secretKey=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiryInSeconds: EXPIRY_SECONDS, label: 'squadstream' }),
      signal: AbortSignal.timeout(5000),
    })
    if (!created.ok) return null
    const { apiKey } = (await created.json()) as { apiKey?: string }
    if (!apiKey) return null
    const list = await fetch(`https://${app}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!list.ok) return null
    const servers = (await list.json()) as IceServer[]
    return Array.isArray(servers) && servers.length ? servers : null
  } catch {
    return null
  }
}

function staticFallback(): IceServer[] | null {
  const urls = process.env.TURN_URLS?.split(',').map((u) => u.trim()).filter(Boolean)
  if (!urls?.length) return null
  return [{ urls, username: process.env.TURN_USERNAME ?? '', credential: process.env.TURN_CREDENTIAL ?? '' }]
}

// Limite simples por IP (por instância; suficiente contra abuso casual).
const hits = new Map<string, { n: number; reset: number }>()
function limited(ip: string): boolean {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || now > h.reset) {
    hits.set(ip, { n: 1, reset: now + 60_000 })
    if (hits.size > 1000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k)
    return false
  }
  return ++h.n > 20
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.status(405).json({ error: 'method' }); return }
  // Navegadores sempre enviam Sec-Fetch-Site: só aceitamos chamadas feitas pelo próprio site.
  const site = first(req.headers['sec-fetch-site'])
  if (site && site !== 'same-origin') { res.status(403).json({ error: 'forbidden' }); return }
  const ip = first(req.headers['x-forwarded-for'])?.split(',')[0].trim() ?? req.socket?.remoteAddress ?? 'unknown'
  if (limited(ip)) { res.status(429).json({ error: 'rate' }); return }

  if (!cached || Date.now() - cached.createdAt > REFRESH_AFTER_MS) {
    const servers = await fetchTemporary()
    if (servers) cached = { servers, createdAt: Date.now() }
  }
  const turn = cached?.servers ?? staticFallback() ?? []
  res.status(200).json({ iceServers: [STUN, ...turn] })
}
