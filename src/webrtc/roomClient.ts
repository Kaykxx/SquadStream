import type { AudioEngine } from '../audio'
import { MAX_PEERS, fetchIceServers, type ScreenQuality } from './config'
import { CameraError, startCamera, type CameraHandle } from './camera'
import { colorFor, type Identity } from './identity'
import { PeerLink, type LinkState } from './peerLink'
import { ScreenError, startScreenShare, type ScreenHandle } from './screenShare'
import { Signaling, type ChatPayload, type PresenceMeta, type SignalingStatus } from './signaling'

export interface RemotePeer {
  id: string
  name: string
  color: string
  muted: boolean
  deafened: boolean
  sharing: boolean
  camera: boolean
  connection: LinkState
}

export interface RoomEvents {
  onPeers: (peers: RemotePeer[]) => void
  onChat: (msg: ChatPayload) => void
  onStatus: (s: SignalingStatus, detail?: string) => void
  onFull: () => void
  onSpeaking: (id: string, speaking: boolean) => void
  /** stream de tela de um participante (inclusive você), ou null quando parou */
  onScreen: (id: string, stream: MediaStream | null) => void
  /** transmissão local terminou (botão nativo do navegador ou parada) */
  onLocalShareEnded: () => void
  /** stream da câmera de um participante (inclusive você), ou null quando desligou */
  onCamera: (id: string, stream: MediaStream | null) => void
  /** câmera local terminou sozinha (desconectada ou permissão revogada) */
  onLocalCameraEnded: () => void
  onCameraError: (message: string) => void
  onScreenError: (message: string) => void
  onNotice: (message: string) => void
}

interface Options {
  code: string
  name: string
  identity: Identity
  engine: AudioEngine
  /** null = modo "só ouvir" (microfone negado/indisponível). */
  micStream: MediaStream | null
  muted: boolean
  deafened: boolean
  events: RoomEvents
}

/** Orquestra sinalização + peers + áudio. Sem React: a UI só recebe eventos. */
export class RoomClient {
  private o: Options
  private signaling: Signaling
  private links = new Map<string, PeerLink>()
  private states = new Map<string, LinkState>()
  private metas: PresenceMeta[] = []
  private destroyed = false
  private screen: ScreenHandle | null = null
  private screenQuality: ScreenQuality = '1080p60'
  private screenStreams = new Map<string, MediaStream>()
  private cameraStreams = new Map<string, MediaStream>()
  private camera: CameraHandle | null = null
  /** Streams de vídeo recebidos, por id do stream; a classificação câmera/tela sai da presença. */
  private videos = new Map<string, { peerId: string; stream: MediaStream }>()
  private pendingTracks: { id: string; stream: MediaStream; track: MediaStreamTrack }[] = []
  private iceServers: RTCIceServer[] = []

  constructor(o: Options) {
    this.o = o
    const me: PresenceMeta = {
      id: o.identity.peerId,
      name: o.name,
      color: colorFor(o.identity.peerId),
      joinedAt: o.identity.joinedAt,
      muted: o.muted,
      deafened: o.deafened,
      sharing: false,
      camera: false,
      voiceStreamId: o.micStream?.id,
    }
    this.signaling = new Signaling(o.code, me, {
      onPeers: (all) => this.handlePeers(all),
      onSignal: (m) => {
        // Sinal de quem não conhecemos só vale se ainda há vaga (evita criar conexões em massa).
        if (!this.links.has(m.from) && this.links.size >= MAX_PEERS - 1) return
        void this.ensureLink(m.from).handleSignal(m)
      },
      onChat: (m) => { if (m.from !== me.id) o.events.onChat(m) },
      onStatus: (s, d) => { if (!this.destroyed) o.events.onStatus(s, d) },
      onFull: () => { if (!this.destroyed) { this.closeAll(); o.events.onFull() } },
    })
  }

  async start(): Promise<void> {
    this.iceServers = await fetchIceServers()
    if (!this.destroyed) this.signaling.connect()
  }

  private ensureLink(id: string): PeerLink {
    let link = this.links.get(id)
    if (link) return link
    const { identity, micStream } = this.o
    link = new PeerLink({
      localId: identity.peerId,
      remoteId: id,
      iceServers: this.iceServers,
      localStream: micStream,
      sendSignal: (m) => this.signaling.sendSignal({ from: identity.peerId, to: id, ...m }),
      onState: (s) => { this.states.set(id, s); this.emitPeers() },
      onTrack: (e) => {
        const stream = e.streams[0]
        if (stream) this.routeTrack(id, stream, e.track)
      },
    })
    if (this.screen) link.addScreen(this.screen.stream, this.screenQuality)
    if (this.camera) link.addCamera(this.camera.stream)
    this.links.set(id, link)
    this.states.set(id, 'connecting')
    return link
  }

  /** Voz = stream do microfone anunciado na presença; qualquer outro = transmissão de tela. */
  private routeTrack(id: string, stream: MediaStream, track: MediaStreamTrack): void {
    const meta = this.metas.find((m) => m.id === id)
    if (!meta) { this.pendingTracks.push({ id, stream, track }); return } // presença ainda não chegou
    const { engine, events } = this.o
    if (stream.id === meta.voiceStreamId) {
      if (track.kind === 'audio') engine.attachStream(id, 'voice', stream, { remote: true, onSpeaking: (s) => events.onSpeaking(id, s) })
      return
    }
    if (track.kind === 'video') {
      this.videos.set(stream.id, { peerId: id, stream })
      stream.addEventListener('removetrack', () => {
        if (stream.getVideoTracks().length === 0) { this.videos.delete(stream.id); this.reclassify(id) }
      })
      this.reclassify(id)
    } else {
      engine.attachStream(id, 'screen', stream, { remote: true })
    }
  }

  /**
   * Decide, pela presença, qual stream de vídeo é a câmera e qual é a tela de cada peer.
   * Reexecutada a cada mudança de presença, então se corrige sozinha se o vídeo chegar antes dela.
   */
  private reclassify(id: string): void {
    const meta = this.metas.find((m) => m.id === id)
    if (!meta) return
    const mine = [...this.videos.values()].filter((v) => v.peerId === id).map((v) => v.stream)
    const cam = meta.camera ? mine.find((s) => s.id === meta.cameraStreamId) ?? null : null
    const scr = meta.sharing ? [...mine].reverse().find((s) => s.id !== meta.cameraStreamId) ?? null : null
    if (this.cameraStreams.get(id) !== (cam ?? undefined)) {
      if (cam) this.cameraStreams.set(id, cam)
      else this.cameraStreams.delete(id)
      this.o.events.onCamera(id, cam)
    }
    if (this.screenStreams.get(id) !== (scr ?? undefined)) {
      if (scr) this.screenStreams.set(id, scr)
      else { this.screenStreams.delete(id); this.o.engine.detachStream(id, 'screen') }
      this.o.events.onScreen(id, scr)
    }
    if (!meta.sharing) this.o.engine.detachStream(id, 'screen')
  }

  private handlePeers(all: PresenceMeta[]): void {
    if (this.destroyed) return
    this.metas = all
    const myId = this.o.identity.peerId
    const remoteIds = new Set(all.filter((m) => m.id !== myId).map((m) => m.id))
    remoteIds.forEach((id) => this.ensureLink(id))
    // Remove quem saiu (e fantasmas), exceto links recém-criados por sinal que chegou antes da presença.
    for (const [id, link] of [...this.links]) {
      if (!remoteIds.has(id) && Date.now() - link.createdAt > 5000) this.dropLink(id)
    }
    const queued = this.pendingTracks
    this.pendingTracks = []
    queued.forEach((q) => this.routeTrack(q.id, q.stream, q.track))
    // Quem parou de transmitir: remove tile e áudio da tela.
    for (const m of all) if (m.id !== myId) this.reclassify(m.id)
    this.emitPeers()
  }

  private dropLink(id: string): void {
    this.links.get(id)?.close()
    this.links.delete(id)
    this.states.delete(id)
    this.o.engine.detachPeer(id)
    for (const [sid, v] of [...this.videos]) if (v.peerId === id) this.videos.delete(sid)
    if (this.cameraStreams.delete(id)) this.o.events.onCamera(id, null)
    if (this.screenStreams.delete(id)) this.o.events.onScreen(id, null)
    this.o.events.onSpeaking(id, false)
  }

  private emitPeers(): void {
    if (this.destroyed) return
    const myId = this.o.identity.peerId
    const peers: RemotePeer[] = this.metas
      .filter((m) => m.id !== myId)
      .map((m) => ({
        id: m.id, name: m.name, color: m.color, muted: m.muted, deafened: m.deafened, sharing: m.sharing, camera: m.camera,
        connection: this.states.get(m.id) ?? 'connecting',
      }))
    this.o.events.onPeers(peers)
  }

  /** Precisa ser chamado direto de um clique (getDisplayMedia exige gesto do usuário). */
  async startScreen(q: ScreenQuality): Promise<void> {
    if (this.screen || this.destroyed) return
    this.screenQuality = q
    try {
      const handle = await startScreenShare(q, () => this.stopScreen(true))
      if (this.destroyed) { handle.stop(); return }
      this.screen = handle
      for (const link of this.links.values()) {
        link.addScreen(handle.stream, q)
        void link.applyScreenQuality(q)
      }
      this.signaling.updateMeta({ sharing: true })
      this.o.events.onScreen(this.o.identity.peerId, handle.stream)
      if (!handle.hasAudio) {
        this.o.events.onNotice('Transmissão sem áudio. Para incluir som, marque “Compartilhar áudio da guia/do sistema” no seletor do navegador (disponível ao escolher uma aba ou, no Windows, a tela inteira).')
      }
    } catch (e) {
      this.o.events.onScreenError(e instanceof ScreenError ? e.message : 'Não foi possível iniciar o compartilhamento de tela.')
    }
  }

  stopScreen(fromBrowser = false): void {
    const handle = this.screen
    if (!handle) return
    this.screen = null
    handle.stop()
    for (const link of this.links.values()) link.removeScreen()
    this.o.events.onScreen(this.o.identity.peerId, null)
    if (!this.destroyed) this.signaling.updateMeta({ sharing: false })
    if (fromBrowser) this.o.events.onLocalShareEnded()
  }

  /** Troca de qualidade em tempo real, sem reiniciar a transmissão. */
  async setScreenQuality(q: ScreenQuality): Promise<void> {
    this.screenQuality = q
    if (!this.screen) return
    await this.screen.applyQuality(q)
    for (const link of this.links.values()) await link.applyScreenQuality(q)
  }

  /** Liga a câmera (pede permissão). Independe do microfone e da tela. */
  async startCamera(): Promise<void> {
    if (this.camera || this.destroyed) return
    try {
      const handle = await startCamera(() => this.stopCamera(true))
      if (this.destroyed) { handle.stop(); return }
      this.camera = handle
      // Presença primeiro: quem receber o vídeo já sabe qual stream é a câmera.
      this.signaling.updateMeta({ camera: true, cameraStreamId: handle.stream.id })
      for (const link of this.links.values()) {
        link.addCamera(handle.stream)
        void link.applyCameraParams()
      }
      this.o.events.onCamera(this.o.identity.peerId, handle.stream)
    } catch (e) {
      this.o.events.onCameraError(e instanceof CameraError ? e.message : 'Não foi possível ligar a câmera.')
    }
  }

  stopCamera(fromBrowser = false): void {
    const handle = this.camera
    if (!handle) return
    this.camera = null
    handle.stop()
    for (const link of this.links.values()) link.removeCamera()
    this.o.events.onCamera(this.o.identity.peerId, null)
    if (!this.destroyed) this.signaling.updateMeta({ camera: false, cameraStreamId: undefined })
    if (fromBrowser) this.o.events.onLocalCameraEnded()
  }

  setLocalState(patch: { muted?: boolean; deafened?: boolean }): void {
    this.signaling.updateMeta(patch)
  }

  sendChat(text: string): ChatPayload {
    const msg: ChatPayload = {
      id: crypto.randomUUID(),
      from: this.o.identity.peerId,
      name: this.o.name,
      color: colorFor(this.o.identity.peerId),
      text,
      ts: Date.now(),
    }
    this.signaling.sendChat(msg)
    return msg
  }

  private closeAll(): void {
    for (const id of [...this.links.keys()]) this.dropLink(id)
  }

  /** Cleanup completo: peers, nós de áudio dos peers e canal. (O microfone é liberado pelo useAudio.) */
  destroy(): void {
    if (this.destroyed) return
    this.screen?.stop() // solta a captura de tela (sem avisar: já estamos saindo)
    this.screen = null
    this.camera?.stop() // apaga a luz da câmera
    this.camera = null
    this.destroyed = true
    this.closeAll()
    void this.signaling.leave()
  }
}
