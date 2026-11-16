/**
 * Identidade estável por aba (sessionStorage): sobrevive ao F5, então a pessoa
 * reaparece com o mesmo id/posição na sala e substitui a presença antiga (sem fantasma).
 */
export interface Identity {
  peerId: string
  joinedAt: number
}

const KEY = 'ss:identity'

export function getIdentity(code: string): Identity {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Identity & { code: string }
      if (v.code === code && v.peerId) return { peerId: v.peerId, joinedAt: v.joinedAt }
    }
  } catch { /* storage indisponível */ }
  const id: Identity = { peerId: crypto.randomUUID(), joinedAt: Date.now() }
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...id, code })) } catch { /* ignore */ }
  return id
}

export function clearIdentity(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

const COLORS = ['#7c5cff', '#ff6b6b', '#ffb84d', '#3ddc84', '#4cc9f0', '#f472b6', '#a3e635', '#fb923c']
export function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}
