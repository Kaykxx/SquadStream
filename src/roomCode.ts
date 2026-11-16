export function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/** Aceita código puro ou link (…/?sala=ABC123 ou …/ABC123). */
export function parseRoomInput(raw: string): string {
  const s = raw.trim()
  try {
    const u = new URL(s)
    const q = u.searchParams.get('sala')
    if (q) return q.toUpperCase()
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (last) return last.toUpperCase()
  } catch {
    /* não é URL */
  }
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
