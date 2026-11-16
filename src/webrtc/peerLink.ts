import { QUALITY_PROFILES, type ScreenQuality } from './config'

export type LinkState = 'connecting' | 'connected' | 'reconnecting' | 'failed'

interface Options {
  localId: string
  remoteId: string
  iceServers: RTCIceServer[]
  localStream: MediaStream | null
  sendSignal: (m: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => void
  onTrack: (e: RTCTrackEvent) => void
  onState: (s: LinkState) => void
}

const MAX_ICE_RESTARTS = 3

/** Uma conexão P2P com um par, usando "perfect negotiation" (resolve glare e renegociações). */
export class PeerLink {
  readonly remoteId: string
  readonly createdAt = Date.now()
  readonly pc: RTCPeerConnection
  private polite: boolean
  private o: Options
  private makingOffer = false
  private ignoreOffer = false
  private settingRemoteAnswer = false
  private closed = false
  private restarts = 0
  private disconnectTimer: ReturnType<typeof setTimeout> | undefined
  private screenSenders: RTCRtpSender[] = []
  private quality: ScreenQuality = '1080p60'

  constructor(o: Options) {
    this.o = o
    this.remoteId = o.remoteId
    this.polite = o.localId > o.remoteId
    this.pc = new RTCPeerConnection({ iceServers: o.iceServers })

    this.pc.ontrack = (e) => o.onTrack(e)
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) o.sendSignal({ candidate: candidate.toJSON() })
    }
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true
        await this.pc.setLocalDescription()
        if (this.pc.localDescription) o.sendSignal({ description: this.pc.localDescription.toJSON() })
      } catch (e) {
        console.warn('[peerLink] negociação falhou', e)
      } finally {
        this.makingOffer = false
      }
    }
    this.pc.onconnectionstatechange = () => this.onConnState()
    // Parâmetros do encoder só existem depois da negociação: reaplica quando voltar a 'stable'.
    this.pc.onsignalingstatechange = () => { if (this.pc.signalingState === 'stable') void this.applyScreenQuality(this.quality) }

    if (o.localStream) o.localStream.getTracks().forEach((t) => this.pc.addTrack(t, o.localStream!))
    else this.pc.addTransceiver('audio', { direction: 'recvonly' }) // modo "só ouvir" (sem microfone)
  }

  private onConnState(): void {
    if (this.closed) return
    clearTimeout(this.disconnectTimer)
    switch (this.pc.connectionState) {
      case 'connected':
        this.restarts = 0
        this.o.onState('connected')
        break
      case 'disconnected':
        this.o.onState('reconnecting')
        this.disconnectTimer = setTimeout(() => this.restartIce(), 3000)
        break
      case 'failed':
        this.restartIce()
        break
      default:
        this.o.onState('connecting')
    }
  }

  private restartIce(): void {
    if (this.closed) return
    if (this.restarts >= MAX_ICE_RESTARTS) { this.o.onState('failed'); return }
    this.restarts++
    this.o.onState('reconnecting')
    this.pc.restartIce()
  }

  /** Começa a enviar a transmissão de tela (dispara renegociação). */
  addScreen(stream: MediaStream, q: ScreenQuality): void {
    if (this.closed || this.screenSenders.length) return
    this.quality = q
    this.screenSenders = stream.getTracks().map((t) => this.pc.addTrack(t, stream))
  }

  removeScreen(): void {
    if (this.closed) return
    for (const s of this.screenSenders) { try { this.pc.removeTrack(s) } catch { /* ignore */ } }
    this.screenSenders = []
  }

  /** Bitrate, fps máximo e preferência de degradação no RTCRtpSender de vídeo. */
  async applyScreenQuality(q: ScreenQuality): Promise<void> {
    this.quality = q
    const sender = this.screenSenders.find((s) => s.track?.kind === 'video')
    if (!sender || this.closed) return
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) return
    const p = QUALITY_PROFILES[q]
    params.encodings[0].maxBitrate = p.maxBitrate
    params.encodings[0].maxFramerate = p.fps
    ;(params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = p.degradation
    try { await sender.setParameters(params) } catch (e) { console.warn('[peerLink] setParameters falhou', e) }
  }

  async handleSignal(m: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }): Promise<void> {
    if (this.closed) return
    const pc = this.pc
    try {
      if (m.description) {
        const d = m.description
        const readyForOffer = !this.makingOffer && (pc.signalingState === 'stable' || this.settingRemoteAnswer)
        const collision = d.type === 'offer' && !readyForOffer
        this.ignoreOffer = !this.polite && collision
        if (this.ignoreOffer) return
        this.settingRemoteAnswer = d.type === 'answer'
        await pc.setRemoteDescription(d)
        this.settingRemoteAnswer = false
        if (d.type === 'offer') {
          await pc.setLocalDescription()
          if (pc.localDescription) this.o.sendSignal({ description: pc.localDescription.toJSON() })
        }
      } else if (m.candidate) {
        try {
          await pc.addIceCandidate(m.candidate)
        } catch (e) {
          if (!this.ignoreOffer) throw e
        }
      }
    } catch (e) {
      console.warn('[peerLink] sinal inválido', e)
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    clearTimeout(this.disconnectTimer)
    const pc = this.pc
    pc.ontrack = null
    pc.onicecandidate = null
    pc.onnegotiationneeded = null
    pc.onconnectionstatechange = null
    pc.onsignalingstatechange = null
    // Não paramos as tracks locais aqui: o stream do microfone é compartilhado entre os peers.
    pc.getSenders().forEach((s) => { try { pc.removeTrack(s) } catch { /* ignore */ } })
    pc.close()
  }
}
