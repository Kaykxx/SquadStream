import { useEffect, useRef } from 'react'

interface Props {
  stream: MediaStream
  videoRef?: (el: HTMLVideoElement | null) => void
  onSize?: (w: number, h: number) => void
  /** espelha horizontalmente (prévia da própria câmera) */
  mirror?: boolean
  /** preenche o quadro cortando as bordas (câmeras); padrão: mostra inteiro */
  cover?: boolean
}

/** Vídeo da transmissão. Sempre mudo: o áudio da tela passa pelo AudioEngine (ganho 0–200%). */
export default function ScreenVideo({ stream, videoRef, onSize, mirror, cover }: Props) {
  const el = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = el.current
    if (!v) return
    v.srcObject = stream
    void v.play().catch(() => {})
    const report = () => onSize?.(v.videoWidth, v.videoHeight)
    v.addEventListener('loadedmetadata', report)
    v.addEventListener('resize', report)
    return () => {
      v.removeEventListener('loadedmetadata', report)
      v.removeEventListener('resize', report)
      v.srcObject = null
    }
  }, [stream, onSize])

  return (
    <video
      ref={(n) => { el.current = n; videoRef?.(n) }}
      muted playsInline autoPlay
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      className={`h-full w-full bg-black ${cover ? 'object-cover' : 'object-contain'}`}
    />
  )
}
