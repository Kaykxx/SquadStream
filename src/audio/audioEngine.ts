import { createVad, type Vad } from './vad'

export type StreamKind = 'voice' | 'screen'

interface Entry {
  source: MediaStreamAudioSourceNode
  gain: GainNode
  sink?: HTMLAudioElement
  vad?: Vad
}

interface AttachOptions {
  /** MediaStream vindo de RTCPeerConnection: precisa de um <audio> mudo para o Chrome entregar o áudio ao Web Audio. */
  remote?: boolean
  /** Só para voz: notifica mudanças da atividade de voz (VAD). */
  onSpeaking?: (speaking: boolean) => void
}

const MAX_GAIN = 2 // 200%

/**
 * Gerenciador de áudio (Web Audio API). Sem nada de React/UI.
 * Cada fonte remota: MediaStreamSource -> GainNode (0..2) -> master (Ensurdecer) -> destino.
 */
export class AudioEngine {
  private ctx: AudioContext
  private master: GainNode
  private entries = new Map<string, Entry>()
  /** Volumes (0–200) lembrados por fonte, para valer mesmo se o stream chegar depois do slider. */
  private gains = new Map<string, number>()
  private extras = new Set<() => void>()
  private listeners = new Set<(state: AudioContextState) => void>()
  private disposed = false

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.master = this.ctx.createGain()
    this.master.connect(this.ctx.destination)
    this.ctx.onstatechange = () => this.listeners.forEach((l) => l(this.ctx.state))
  }

  get state(): AudioContextState { return this.ctx.state }

  onStateChange(cb: (state: AudioContextState) => void): () => void {
    this.listeners.add(cb)
    return () => { this.listeners.delete(cb) }
  }

  /** Retoma o AudioContext (autoplay policy). Chame após qualquer interação do usuário. */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {})
  }

  /** Retoma automaticamente no primeiro clique/tecla/toque. Retorna função de limpeza. */
  autoResumeOnGesture(): () => void {
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    const handler = () => { void this.resume() }
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, handler))
  }

  private key(id: string, kind: StreamKind) { return `${id}:${kind}` }

  /** Conecta um stream remoto (ou de teste) ao grafo de áudio com controle de ganho. */
  attachStream(id: string, kind: StreamKind, stream: MediaStream, opts: AttachOptions = {}): void {
    if (this.disposed) return
    this.detachStream(id, kind)
    if (stream.getAudioTracks().length === 0) return

    let sink: HTMLAudioElement | undefined
    if (opts.remote) {
      sink = new Audio()
      sink.muted = true
      sink.srcObject = stream
      void sink.play().catch(() => {})
    }
    const source = this.ctx.createMediaStreamSource(stream)
    const gain = this.ctx.createGain()
    source.connect(gain).connect(this.master)
    gain.gain.value = Math.min(MAX_GAIN, Math.max(0, (this.gains.get(this.key(id, kind)) ?? 100) / 100))
    const entry: Entry = { source, gain, sink }
    // VAD fica antes do ganho: o slider em 0% não "apaga" a borda verde de quem fala.
    if (kind === 'voice' && opts.onSpeaking) entry.vad = createVad(this.ctx, source, opts.onSpeaking)
    this.entries.set(this.key(id, kind), entry)
  }

  /** pct: 0–200 */
  setGain(id: string, kind: StreamKind, pct: number): void {
    this.gains.set(this.key(id, kind), pct)
    const e = this.entries.get(this.key(id, kind))
    if (!e) return
    const v = Math.min(MAX_GAIN, Math.max(0, pct / 100))
    e.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015)
  }

  /** Ensurdecer: silencia tudo que vem dos outros. */
  setDeafened(deafened: boolean): void {
    this.master.gain.setTargetAtTime(deafened ? 0 : 1, this.ctx.currentTime, 0.015)
  }

  /** VAD de um stream local (microfone). Não é conectado à saída, evitando eco. */
  watchLocalVoice(stream: MediaStream, onSpeaking: (speaking: boolean) => void): () => void {
    if (this.disposed) return () => {}
    const source = this.ctx.createMediaStreamSource(stream)
    const vad = createVad(this.ctx, source, onSpeaking)
    const stop = () => {
      if (!this.extras.delete(stop)) return
      vad.dispose()
      source.disconnect()
    }
    this.extras.add(stop)
    return stop
  }

  detachStream(id: string, kind: StreamKind): void {
    const k = this.key(id, kind)
    const e = this.entries.get(k)
    if (!e) return
    e.vad?.dispose()
    e.source.disconnect()
    e.gain.disconnect()
    if (e.sink) { e.sink.pause(); e.sink.srcObject = null }
    this.entries.delete(k)
  }

  detachPeer(id: string): void {
    this.detachStream(id, 'voice')
    this.detachStream(id, 'screen')
    this.gains.delete(this.key(id, 'voice'))
    this.gains.delete(this.key(id, 'screen'))
  }

  /** Libera tudo: nós, <audio>, VADs e o próprio AudioContext. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const k of [...this.entries.keys()]) {
      const [id, kind] = k.split(':') as [string, StreamKind]
      this.detachStream(id, kind)
    }
    ;[...this.extras].forEach((fn) => fn())
    this.listeners.clear()
    this.master.disconnect()
    this.ctx.onstatechange = null
    void this.ctx.close().catch(() => {})
  }
}
