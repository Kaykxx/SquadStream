import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { MAX_PEERS } from './config'

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
      const msg = payload as SignalMessage
      if (msg.to === this.meta.id) this.h.onSignal(msg)
    })
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => this.h.onChat(payload as ChatPayload))
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
      .map((arr) => arr[arr.length - 1])
      .filter(Boolean)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    const myIdx = metas.findIndex((m) => m.id === this.meta.id)
    if (myIdx >= MAX_PEERS) {
      this.h.onFull()
      void this.leave()
      return
    }
    this.h.onPeers(metas)
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
