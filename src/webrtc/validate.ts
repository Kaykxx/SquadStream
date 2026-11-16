import type { PresenceMeta, SignalMessage } from './signaling'

/** O canal Realtime é aberto a quem tem o código da sala: nada que chega dele é confiável. */
const ID_RE = /^[A-Za-z0-9-]{1,64}$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const MAX_SDP = 100_000
const DESC_TYPES = new Set(['offer', 'answer', 'pranswer', 'rollback'])

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function sanitizeMeta(raw: unknown): PresenceMeta | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 24) : ''
  return {
    id: raw.id,
    name: name || 'Anônimo',
    color: typeof raw.color === 'string' && COLOR_RE.test(raw.color) ? raw.color : '#7c5cff',
    joinedAt: typeof raw.joinedAt === 'number' && Number.isFinite(raw.joinedAt) ? raw.joinedAt : Date.now(),
    muted: raw.muted === true,
    deafened: raw.deafened === true,
    sharing: raw.sharing === true,
    voiceStreamId: typeof raw.voiceStreamId === 'string' && raw.voiceStreamId.length <= 64 ? raw.voiceStreamId : undefined,
  }
}

export function sanitizeSignal(raw: unknown, myId: string): SignalMessage | null {
  if (!isObj(raw) || raw.to !== myId || typeof raw.from !== 'string' || !ID_RE.test(raw.from) || raw.from === myId) return null
  const out: SignalMessage = { from: raw.from, to: myId }
  if (isObj(raw.description)) {
    const d = raw.description
    if (typeof d.type !== 'string' || !DESC_TYPES.has(d.type)) return null
    if (d.sdp !== undefined && (typeof d.sdp !== 'string' || d.sdp.length > MAX_SDP)) return null
    out.description = { type: d.type as RTCSdpType, sdp: d.sdp as string | undefined }
  } else if (isObj(raw.candidate)) {
    const c = raw.candidate
    if (typeof c.candidate !== 'string' || c.candidate.length > 1024) return null
    out.candidate = {
      candidate: c.candidate,
      sdpMid: typeof c.sdpMid === 'string' && c.sdpMid.length <= 64 ? c.sdpMid : null,
      sdpMLineIndex: typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : null,
      usernameFragment: typeof c.usernameFragment === 'string' && c.usernameFragment.length <= 64 ? c.usernameFragment : undefined,
    }
  } else {
    return null
  }
  return out
}

export interface RawChat { id: string; from: string; text: string }

export function sanitizeChat(raw: unknown): RawChat | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || raw.id.length > 64) return null
  if (typeof raw.from !== 'string' || !ID_RE.test(raw.from)) return null
  if (typeof raw.text !== 'string') return null
  const text = raw.text.trim().slice(0, 500)
  return text ? { id: raw.id, from: raw.from, text } : null
}
