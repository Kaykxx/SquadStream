import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { MAX_PEERS } from './config'
import { sanitizeChat, sanitizeMeta, sanitizeSignal } from './validate'

export interface PresenceMeta {
  id: string
  name: string
  color: string
  joinedAt: number
  muted: boolean
  deafened: boolean
  sharing: boolean
  /** id do MediaStream do microfone: qualquer outro stream deste peer é transmissão de tela */
  voiceStreamId?: string
}

export interface SignalMessage {
  from: string
  to: string
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export interface ChatPayload {
  id: string
  from: string
  name: string
  color: string
  text: string
  ts: number
}

export type SignalingStatus = 'connecting' | 'connected' | 'error' | 'closed'

export interface SignalingHandlers {
  onPeers: (all: PresenceMeta[]) => void
  onSignal: (msg: SignalMessage) => void
  onChat: (msg: ChatPayload) => void
  onStatus: (s: SignalingStatus, detail?: string) => void
  onFull: () => void
}

let client: SupabaseClient | null = null

export function hasSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

function getClient(): SupabaseClient {
  if (!client) {
    // Tolera a URL colada com sufixo (ex.: .../rest/v1/): o cliente precisa só da origem do projeto.
    const origin = new URL((import.meta.env.VITE_SUPABASE_URL as string).trim()).origin
    client = createClient(origin, (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 40 } },
    })
  }
  return client
}

/** Sinalização, presença e chat sobre um canal Supabase Realtime (Broadcast + Presence). */
export class Signaling {
  private channel: RealtimeChannel | null = null
  private left = false
  /** Participantes conhecidos pela presença (validada): nome/cor do chat vêm daqui, nunca da mensagem. */
  private known = new Map<string, PresenceMeta>()
  private chatTimes = new Map<string, number[]>()
  private code: string
  private meta: PresenceMeta
  private h: SignalingHandlers

  constructor(code: string, meta: PresenceMeta, handlers: SignalingHandlers) {
    this.code = code
    this.meta = meta
    this.h = handlers
  }

  connect(): void {
    if (!hasSupabaseConfig()) {
      this.h.onStatus('error', 'Chaves do Supabase ausentes. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local e reinicie o npm run dev.')
      return
    }
    this.h.onStatus('connecting')
    const ch = getClient().channel(`room:${this.code}`, {
      config: { broadcast: { self: false }, presence: { key: this.meta.id } },
    })
    this.channel = ch
    ch.on('presence', { event: 'sync' }, () => this.handleSync())
    ch.on('broadcast', { event: 'signal' }, ({ payload }) => {
      const msg = sanitizeSignal(payload, this.meta.id)
      if (msg) this.h.onSignal(msg)
    })
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const c = sanitizeChat(payload)
      const from = c && this.known.get(c.from)
      if (!c || !from || c.from === this.meta.id || !this.allowChat(c.from)) return
      this.h.onChat({ id: c.id, from: c.from, name: from.name, color: from.color, text: c.text, ts: Date.now() })
    })
    ch.subscribe(async (status) => {
      if (this.left) return
      if (status === 'SUBSCRIBED') {
        await ch.track(this.meta) // também roda a cada reconexão automática
        this.h.onStatus('connected')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.h.onStatus('error', 'Falha na conexão com o servidor de sinalização. Tentando reconectar…')
      } else if (status === 'CLOSED') {
        this.h.onStatus('closed')
      }
    })
  }

  private handleSync(): void {
    if (!this.channel || this.left) return
    const state = this.channel.presenceState<PresenceMeta>()
    const metas = Object.values(state)
      .map((arr) => sanitizeMeta(arr[arr.length - 1]))
      .filter((m): m is PresenceMeta => m !== null)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    this.known = new Map(metas.map((m) => [m.id, m]))
    const myIdx = metas.findIndex((m) => m.id === this.meta.id)
    if (myIdx >= MAX_PEERS) {
      this.h.onFull()
      void this.leave()
      return
    }
    this.h.onPeers(metas)
  }

  /** No máximo 5 mensagens a cada 3 s por remetente. */
  private allowChat(from: string): boolean {
    const now = Date.now()
    const recent = (this.chatTimes.get(from) ?? []).filter((t) => now - t < 3000)
    if (recent.length >= 5) return false
    recent.push(now)
    this.chatTimes.set(from, recent)
    return true
  }

  updateMeta(patch: Partial<PresenceMeta>): void {
    this.meta = { ...this.meta, ...patch }
    if (this.channel && !this.left) void this.channel.track(this.meta)
  }

  sendSignal(msg: SignalMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'signal', payload: msg })
  }

  sendChat(msg: ChatPayload): void {
    void this.channel?.send({ type: 'broadcast', event: 'chat', payload: msg })
  }

  async leave(): Promise<void> {
    if (this.left) return
    this.left = true
    const ch = this.channel
    this.channel = null
    if (!ch) return
    try { await ch.untrack() } catch { /* ignore */ }
    try { await getClient().removeChannel(ch) } catch { /* ignore */ }
  }
}
