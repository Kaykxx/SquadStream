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

function Btn({ children, label, on, danger, disabled, title, onClick }: { children: ReactNode; label: string; on?: boolean; danger?: boolean; disabled?: boolean; title?: string; onClick: () => void }) {
  const tone = danger ? 'bg-red-500 text-white hover:bg-red-400' : on ? 'bg-accent text-white hover:brightness-110' : 'bg-panel-2 text-zinc-200 hover:bg-line'
  return (
    <button onClick={onClick} disabled={disabled} title={title ?? label} className={`flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}>
      {children}
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}

export default function ControlBar(p: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {p.micEnabled && <Btn label={p.muted ? 'Desmutar' : 'Mutar'} on={p.muted} onClick={p.onMute}>{p.muted ? <MicOffIcon /> : <MicIcon />}</Btn>}
      <Btn label={p.deafened ? 'Ouvir' : 'Ensurdecer'} on={p.deafened} onClick={p.onDeafen}>{p.deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}</Btn>
      <Btn label={p.camera ? 'Desligar câmera' : 'Câmera'} on={p.camera} onClick={p.onCamera}>{p.camera ? <CameraIcon /> : <CameraOffIcon />}</Btn>
      <Btn label={p.sharing ? 'Parar transmissão' : 'Compartilhar tela'} on={p.sharing}  onClick={p.onShare}><ScreenIcon /></Btn>

      <select
        value={p.quality}
        onChange={(e) => p.onQuality(e.target.value as Quality)}
        title="Qualidade da transmissão"
        className="h-12 cursor-pointer rounded-xl border border-line bg-panel-2 px-3 text-sm text-zinc-200 outline-none hover:bg-line focus:border-accent"
      >
        {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
          <option key={q} value={q}>{QUALITY_LABEL[q]}</option>
        ))}
      </select>

      <div className="relative">
        <Btn label="Chat" on={p.chatOpen} onClick={p.onChat}><ChatIcon /></Btn>
        {p.unread > 0 && !p.chatOpen && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold">{p.unread}</span>
        )}
      </div>
      <Btn label="Sair" danger onClick={p.onLeave}><PhoneOffIcon /></Btn>
    </div>
  )
}
