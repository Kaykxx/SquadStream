/** Código de sala: 10 caracteres de um alfabeto de 32 (50 bits), com gerador criptográfico. */
export function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
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
