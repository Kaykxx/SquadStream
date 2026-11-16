export type MicErrorCode = 'denied' | 'not-found' | 'in-use' | 'unsupported' | 'unknown'

export class MicError extends Error {
  code: MicErrorCode
  constructor(code: MicErrorCode, message: string) {
    super(message)
    this.name = 'MicError'
    this.code = code
  }
}

function toMicError(e: unknown): MicError {
  const name = e instanceof DOMException ? e.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new MicError('denied', 'Permissão de microfone negada. Libere o microfone no ícone de cadeado da barra de endereço e recarregue a página.')
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new MicError('not-found', 'Nenhum microfone foi encontrado. Conecte um e tente de novo.')
    case 'NotReadableError':
    case 'AbortError':
      return new MicError('in-use', 'Não foi possível acessar o microfone. Ele pode estar em uso por outro programa.')
    default:
      return new MicError('unknown', 'Erro inesperado ao abrir o microfone.')
  }
}

export interface MicHandle {
  stream: MediaStream
  /** Mutar desliga a track (silêncio), sem soltar o microfone. */
  setMuted: (muted: boolean) => void
  /** Para todas as tracks e libera o microfone do navegador. */
  stop: () => void
}

export async function startMic(): Promise<MicHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicError('unsupported', 'Seu navegador não suporta captura de microfone (use HTTPS ou localhost).')
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })
  } catch (e) {
    throw toMicError(e)
  }
  return {
    stream,
    setMuted: (muted) => stream.getAudioTracks().forEach((t) => { t.enabled = !muted }),
    stop: () => stream.getTracks().forEach((t) => t.stop()),
  }
}
