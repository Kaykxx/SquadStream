import { useCallback, useRef, useState } from 'react'
import type { Participant, Quality } from '../types'
import { QUALITY_LABEL } from '../types'
import ScreenVideo from './ScreenVideo'
import VolumeSlider from './VolumeSlider'
import { FocusIcon, FullscreenIcon, GridIcon, PipIcon, VolumeIcon } from './Icons'

interface Props {
  p: Participant
  stream?: MediaStream
  quality: Quality
  focused: boolean
  compact?: boolean
  onFocus: () => void
  onScreenVolume: (v: number) => void
}

/**
 * Alturas padrão. A captura pode chegar reduzida pela escala do Windows (125% => 1080/1.25 = 864,
 * 854 etc.), então valores a ~2% de S/1.25 também são exibidos como S.
 */
const STANDARD_HEIGHTS = [360, 480, 720, 1080, 1440, 2160]
function resolutionLabel(h: number): string {
  if (!h) return '—'
  const near = (a: number, b: number) => Math.abs(a - b) / b <= 0.02
  const match = STANDARD_HEIGHTS.find((std) => near(h, std) || near(h, std / 1.25))
  return `${match ?? h}p`
}

const btn = 'grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-zinc-100 backdrop-blur transition hover:bg-accent'

export default function StreamTile({ p, stream, quality, focused, compact, onFocus, onScreenVolume }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const [volOpen, setVolOpen] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  const onSize = useCallback((w: number, h: number) => setSize({ w, h }), [])

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else box.current?.requestFullscreen().catch(() => {})
  }
  const pip = async () => {
    const v = video.current
    if (!v) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await v.requestPictureInPicture()
    } catch { /* PiP não suportado */ }
  }

  return (
    <div
      ref={box}
      className="group relative h-full min-h-0 overflow-hidden rounded-lg bg-black"
      style={p.speaking && !p.muted && !p.deafened ? { boxShadow: '0 0 0 2px var(--color-live)' } : undefined}
    >
      {stream ? (
        <ScreenVideo stream={stream} videoRef={(el) => { video.current = el }} onSize={onSize} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-panel text-sm text-zinc-400">
          <div className="flex items-center gap-2"><span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />Conectando stream…</div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wide">AO VIVO</span>
          <span className="drop-shadow">{p.isMe ? 'Sua tela' : `Tela de ${p.name}`}</span>
        </div>
        <span className="rounded bg-black/60 px-2 py-0.5 text-[11px] text-zinc-300">{p.isMe ? QUALITY_LABEL[quality] : size ? resolutionLabel(size.h) : '—'}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2.5 opacity-0 transition group-hover:opacity-100">
        {!p.isMe && (
          <div className="relative">
            {volOpen && (
              <div className="absolute bottom-10 right-0 w-52 rounded-xl border border-line bg-panel p-3 shadow-xl">
                <VolumeSlider label="Volume da tela" value={p.screenVolume} onChange={onScreenVolume} />
              </div>
            )}
            <button className={btn} title="Volume da transmissão" onClick={() => setVolOpen((o) => !o)}><VolumeIcon /></button>
          </div>
        )}
        {!compact && <button className={btn} title="Picture-in-Picture" onClick={pip}><PipIcon /></button>}
        <button className={btn} title={focused ? 'Voltar à grade' : 'Modo foco'} onClick={onFocus}>{focused ? <GridIcon /> : <FocusIcon />}</button>
        <button className={btn} title="Tela cheia" onClick={fullscreen}><FullscreenIcon /></button>
      </div>
    </div>
  )
}
