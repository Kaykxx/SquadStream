import type { ReactNode } from 'react'
import type { Quality } from '../types'
import { QUALITY_LABEL } from '../types'
import { CameraIcon, CameraOffIcon, ChatIcon, HeadphonesIcon, HeadphonesOffIcon, MicIcon, MicOffIcon, PhoneOffIcon, ScreenIcon } from './Icons'

interface Props {
  micEnabled: boolean
  muted: boolean
  deafened: boolean
  sharing: boolean
  camera: boolean
  onCamera: () => void
  quality: Quality
  chatOpen: boolean
  unread: number
  onMute: () => void
  onDeafen: () => void
  onShare: () => void
  onQuality: (q: Quality) => void
  onChat: () => void
  onLeave: () => void
}

type Tone = 'default' | 'active' | 'muted' | 'leave'

/** Botão redondo só com ícone, como a barra de chamada do Discord. */
function Btn({ children, title, tone = 'default', onClick }: { children: ReactNode; title: string; tone?: Tone; onClick: () => void }) {
  const styles: Record<Tone, string> = {
    default: 'bg-panel-2 text-zinc-100 hover:bg-line',
    active: 'bg-white text-zinc-900 hover:bg-zinc-200', // ligado: câmera, transmissão, chat aberto
    muted: 'bg-panel-2 text-red-400 hover:bg-line', // mudo / ensurdecido
    leave: 'bg-red-500 text-white hover:bg-red-400 px-6',
  }
  return (
    <button
      onClick={onClick} title={title} aria-label={title}
      className={`grid h-12 place-items-center rounded-full transition ${tone === 'leave' ? '' : 'w-12'} ${styles[tone]}`}
    >
      {children}
    </button>
  )
}

export default function ControlBar(p: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {p.micEnabled && (
        <Btn title={p.muted ? 'Ativar microfone' : 'Silenciar microfone'} tone={p.muted ? 'muted' : 'default'} onClick={p.onMute}>
          {p.muted ? <MicOffIcon /> : <MicIcon />}
        </Btn>
      )}
      <Btn title={p.deafened ? 'Ativar áudio' : 'Desativar áudio'} tone={p.deafened ? 'muted' : 'default'} onClick={p.onDeafen}>
        {p.deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
      </Btn>
      <Btn title={p.camera ? 'Desligar câmera' : 'Ligar câmera'} tone={p.camera ? 'active' : 'default'} onClick={p.onCamera}>
        {p.camera ? <CameraIcon /> : <CameraOffIcon />}
      </Btn>
      <Btn title={p.sharing ? 'Parar transmissão' : 'Compartilhar tela'} tone={p.sharing ? 'active' : 'default'} onClick={p.onShare}>
        <ScreenIcon />
      </Btn>

      <select
        value={p.quality}
        onChange={(e) => p.onQuality(e.target.value as Quality)}
        title="Qualidade da transmissão"
        className="h-12 cursor-pointer rounded-full border border-line bg-panel-2 px-4 text-sm text-zinc-200 outline-none hover:bg-line focus:border-accent"
      >
        {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
          <option key={q} value={q}>{QUALITY_LABEL[q]}</option>
        ))}
      </select>

      <div className="relative">
        <Btn title={p.chatOpen ? 'Fechar chat' : 'Abrir chat'} tone={p.chatOpen ? 'active' : 'default'} onClick={p.onChat}><ChatIcon /></Btn>
        {p.unread > 0 && !p.chatOpen && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold">{p.unread}</span>
        )}
      </div>
      <Btn title="Desconectar" tone="leave" onClick={p.onLeave}><PhoneOffIcon /></Btn>
    </div>
  )
}
