export type CameraErrorCode = 'denied' | 'not-found' | 'in-use' | 'unsupported' | 'unknown'

export class CameraError extends Error {
  code: CameraErrorCode
  constructor(code: CameraErrorCode, message: string) {
    super(message)
    this.name = 'CameraError'
    this.code = code
  }
}

export interface CameraHandle {
  stream: MediaStream
  video: MediaStreamTrack
  /** Para a captura e apaga a luz da câmera (idempotente). Não dispara o callback de "ended". */
  stop: () => void
}

function toCameraError(e: unknown): CameraError {
  const name = e instanceof DOMException || e instanceof TypeError ? e.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError('denied', 'Permissão de câmera negada. Libere a câmera no ícone de cadeado da barra de endereço e tente de novo.')
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', 'Nenhuma câmera foi encontrada. Conecte uma e tente de novo.')
    case 'NotReadableError':
    case 'AbortError':
      return new CameraError('in-use', 'Não foi possível acessar a câmera. Ela pode estar em uso por outro programa.')
    default:
      return new CameraError('unknown', `Erro inesperado ao abrir a câmera (${name || 'desconhecido'}).`)
  }
}

/** Só vídeo (o microfone é independente). 16:9 em torno de 640×360 a 30 fps: leve para malha P2P. */
export async function startCamera(onEnded: () => void): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'Seu navegador não suporta câmera (use HTTPS ou localhost).')
  }
  const attempts: MediaStreamConstraints[] = [
    { video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30, max: 30 }, facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ]
  let stream: MediaStream | null = null
  let lastErr: unknown
  for (const c of attempts) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(c)
      break
    } catch (e) {
      lastErr = e
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) break
    }
  }
  if (!stream) throw toCameraError(lastErr)

  const video = stream.getVideoTracks()[0]
  try { video.contentHint = 'motion' } catch { /* não suportado */ }
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    video.removeEventListener('ended', ended)
    stream.getTracks().forEach((t) => t.stop())
  }
  // 'ended' dispara se a câmera for desconectada ou o navegador revogar a permissão.
  const ended = () => { stop(); onEnded() }
  video.addEventListener('ended', ended)
  return { stream, video, stop }
}
