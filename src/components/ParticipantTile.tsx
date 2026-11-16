import { useRef, useState } from 'react'
import type { Participant } from '../types'
import ScreenVideo from './ScreenVideo'
import VolumeSlider from './VolumeSlider'
import { FocusIcon, FullscreenIcon, GridIcon, HeadphonesOffIcon, MicOffIcon, PipIcon, ScreenIcon, VolumeIcon } from './Icons'

interface Props {
  p: Participant
  /** câmera, se estiver ligada; sem ela mostra o avatar */
  stream?: MediaStream
  focused: boolean
  /** miniatura da faixa lateral: um clique foca, sem botões extras */
  compact?: boolean
  onFocus: () => void
  onVoiceVolume: (v: number) => void
}

const btn = 'grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-zinc-100 backdrop-blur transition hover:bg-accent'

/** Tile de pessoa: câmera (com PiP, tela cheia e foco) ou avatar, com estado de voz e conexão. */
export default function ParticipantTile({ p, stream, focused, compact, onFocus, onVoiceVolume }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement | null>(null)
  const [volOpen, setVolOpen] = useState(false)
  const quiet = p.muted || p.deafened
  const speaking = p.speaking && !quiet

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
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

  const status =
    p.connection === 'failed' ? 'falha na conexão'
    : p.connection === 'reconnecting' ? 'reconectando…'
    : p.connection === 'connecting' ? 'conectando…'
    : null

  return (
    <div
      ref={box}
      onClick={compact ? onFocus : undefined}
      className={`group relative h-full min-h-0 overflow-hidden rounded-lg bg-[#1e1f22] ${compact ? 'cursor-pointer' : ''}`}
      style={speaking ? { boxShadow: '0 0 0 2px var(--color-live)' } : undefined}
    >
      {stream ? (
        <ScreenVideo stream={stream} mirror={p.isMe} videoRef={(el) => { video.current = el }} />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <span
            className={`grid place-items-center rounded-full font-bold text-black transition-all ${compact ? 'h-12 w-12 text-lg' : 'h-24 w-24 text-4xl'}`}
            style={{
              background: p.color,
              boxShadow: speaking ? '0 0 0 3px var(--color-live), 0 0 18px 2px rgba(61,220,132,.55)' : '0 0 0 3px transparent',
            }}
          >
            {p.name[0]}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1.5 rounded-md bg-black/65 px-2 py-0.5 text-xs">
        {quiet && <span className="text-red-400 [&_svg]:h-3.5 [&_svg]:w-3.5">{p.deafened ? <HeadphonesOffIcon /> : <MicOffIcon />}</span>}
        {p.sharing && <span className="text-accent-2 [&_svg]:h-3.5 [&_svg]:w-3.5"><ScreenIcon /></span>}
        <span className="truncate font-medium">{p.name}</span>
        {status && <span className="shrink-0 text-amber-300">{status}</span>}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-1.5 p-2 opacity-0 transition group-hover:opacity-100">
        {!p.isMe && (
          <div className="relative">
            {volOpen && (
              <div className="absolute bottom-10 right-0 z-20 w-52 rounded-xl border border-line bg-panel p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <VolumeSlider label="Volume da voz" value={p.voiceVolume} onChange={onVoiceVolume} />
              </div>
            )}
            <button className={btn} title="Volume da voz" onClick={(e) => { e.stopPropagation(); setVolOpen((o) => !o) }}><VolumeIcon /></button>
          </div>
        )}
        {!compact && stream && <button className={btn} title="Picture-in-Picture" onClick={(e) => { e.stopPropagation(); void pip() }}><PipIcon /></button>}
        {!compact && stream && <button className={btn} title={focused ? 'Voltar à grade' : 'Ampliar'} onClick={(e) => { e.stopPropagation(); onFocus() }}>{focused ? <GridIcon /> : <FocusIcon />}</button>}
        {!compact && stream && <button className={btn} title="Tela cheia" onClick={(e) => { e.stopPropagation(); fullscreen() }}><FullscreenIcon /></button>}
      </div>
    </div>
  )
}
