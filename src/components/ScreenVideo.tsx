import { useEffect, useRef } from 'react'

interface Props {
  stream: MediaStream
  videoRef?: (el: HTMLVideoElement | null) => void
  onSize?: (w: number, h: number) => void
}

/** Vídeo da transmissão. Sempre mudo: o áudio da tela passa pelo AudioEngine (ganho 0–200%). */
export default function ScreenVideo({ stream, videoRef, onSize }: Props) {
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
      className="h-full w-full bg-black object-contain"
    />
  )
}
