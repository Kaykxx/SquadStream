import { QUALITY_PROFILES, type ScreenQuality } from './config'

export type ScreenErrorCode = 'denied' | 'unsupported' | 'unknown'

export class ScreenError extends Error {
  code: ScreenErrorCode
  constructor(code: ScreenErrorCode, message: string) {
    super(message)
    this.name = 'ScreenError'
    this.code = code
  }
}

export interface ScreenHandle {
  stream: MediaStream
  video: MediaStreamTrack
  /** false se o usuário não marcou "compartilhar áudio" no seletor do navegador */
  hasAudio: boolean
  applyQuality: (q: ScreenQuality) => Promise<void>
  /** Para as tracks (idempotente). Não dispara o callback de "ended". */
  stop: () => void
}

function videoConstraints(q: ScreenQuality): MediaTrackConstraints {
  const p = QUALITY_PROFILES[q]
  return {
    width: { ideal: p.width, max: p.width },
    height: { ideal: p.height, max: p.height },
    frameRate: { ideal: p.fps, max: p.fps },
  }
}

function setHint(track: MediaStreamTrack, q: ScreenQuality) {
  try { track.contentHint = QUALITY_PROFILES[q].contentHint } catch { /* não suportado */ }
}

/**
 * Abre o seletor nativo (tela/janela/aba) com áudio. Precisa ser chamada de dentro de um clique.
 * `onEnded` dispara quando a transmissão termina pelo botão nativo "Parar compartilhamento".
 */
export async function startScreenShare(q: ScreenQuality, onEnded: () => void): Promise<ScreenHandle> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new ScreenError('unsupported', 'Seu navegador não suporta compartilhamento de tela.')
  }
  let stream: MediaStream
  try {
    const opts: DisplayMediaStreamOptions & Record<string, unknown> = {
      video: videoConstraints(q),
      // Áudio de música/jogo: sem processamento de voz.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      systemAudio: 'include',
    }
    stream = await navigator.mediaDevices.getDisplayMedia(opts)
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'NotAllowedError' || name === 'AbortError' || name === 'SecurityError') {
      throw new ScreenError('denied', 'Compartilhamento cancelado ou negado. Clique em “Compartilhar tela” e escolha o que transmitir.')
    }
    throw new ScreenError('unknown', 'Não foi possível iniciar o compartilhamento de tela.')
  }

  const video = stream.getVideoTracks()[0]
  setHint(video, q)
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    video.removeEventListener('ended', ended)
    stream.getTracks().forEach((t) => t.stop())
  }
  const ended = () => { stop(); onEnded() }
  video.addEventListener('ended', ended)

  return {
    stream,
    video,
    hasAudio: stream.getAudioTracks().length > 0,
    stop,
    async applyQuality(next) {
      setHint(video, next)
      try { await video.applyConstraints(videoConstraints(next)) } catch { /* mantém o que já está */ }
    },
  }
}
