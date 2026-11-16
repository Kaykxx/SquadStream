import { useState } from 'react'
import type { Participant } from '../types'
import VolumeSlider from './VolumeSlider'
import { HeadphonesOffIcon, MicOffIcon, ScreenIcon } from './Icons'

interface Props {
  users: Participant[]
  onVoiceVolume: (id: string, v: number) => void
}

export default function UserBar({ users, onVoiceVolume }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-4 px-1">
      {users.map((u) => {
        const quiet = u.muted || u.deafened
        const active = u.speaking && !quiet
        return (
          <div key={u.id} className="relative">
            <button
              onClick={() => !u.isMe && setOpen(open === u.id ? null : u.id)}
              className="flex items-center gap-2.5 rounded-full bg-panel py-1.5 pl-1.5 pr-4 transition hover:bg-panel-2"
              title={u.isMe ? u.name : 'Ajustar volume'}
            >
              <span
                className="relative grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-black transition-all"
                style={{
                  background: u.color,
                  boxShadow: active ? '0 0 0 3px var(--color-live), 0 0 14px 2px rgba(61,220,132,.55)' : '0 0 0 3px transparent',
                }}
              >
                {u.name[0]}
                {quiet && (
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white [&_svg]:h-3 [&_svg]:w-3">
                    {u.deafened ? <HeadphonesOffIcon /> : <MicOffIcon />}
                  </span>
                )}
              </span>
              <span className="text-left leading-tight">
                <span className="block text-sm font-medium">{u.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  {u.connection && u.connection !== 'connected'
                    ? (u.connection === 'failed' ? 'falha na conexão' : u.connection === 'reconnecting' ? 'reconectando…' : 'conectando…')
                    : u.sharing ? <><ScreenIcon />ao vivo</> : u.isMe ? 'conectado' : `${u.voiceVolume}%`}
                </span>
              </span>
            </button>
            {open === u.id && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-line bg-panel p-3 shadow-xl">
                <p className="mb-2 text-xs font-semibold text-zinc-300">{u.name}</p>
                <VolumeSlider label="Volume da voz" value={u.voiceVolume} onChange={(v) => onVoiceVolume(u.id, v)} />
                <p className="mt-2 text-[10px] text-zinc-600">Duplo clique no controle volta para 100%.</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
