import { useState } from 'react'
import type { Participant, Quality } from '../types'
import StreamTile from './StreamTile'
import { ScreenIcon } from './Icons'

interface Props {
  streams: Participant[]
  screens: Record<string, MediaStream>
  quality: Quality
  onScreenVolume: (id: string, v: number) => void
}

export default function StreamGrid({ streams, screens, quality, onScreenVolume }: Props) {
  const [focusId, setFocusId] = useState<string | null>(null)
  const focus = streams.find((s) => s.id === focusId) ?? null

  if (streams.length === 0) {
    return (
      <div className="grid h-full place-items-center rounded-xl border border-dashed border-line text-center text-zinc-500">
        <div>
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-panel-2"><ScreenIcon /></div>
          <p className="font-medium text-zinc-300">Ninguém está transmitindo</p>
          <p className="text-sm">Clique em “Compartilhar tela” para começar.</p>
        </div>
      </div>
    )
  }

  const tile = (s: Participant, compact = false) => (
    <StreamTile
      key={s.id} p={s} stream={screens[s.id]} quality={quality} compact={compact}
      focused={focus?.id === s.id}
      onFocus={() => setFocusId(focus?.id === s.id ? null : s.id)}
      onScreenVolume={(v) => onScreenVolume(s.id, v)}
    />
  )

  if (focus) {
    const others = streams.filter((s) => s.id !== focus.id)
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="min-h-0 flex-1">{tile(focus)}</div>
        {others.length > 0 && (
          <div className="grid h-32 shrink-0 gap-3" style={{ gridTemplateColumns: `repeat(${others.length}, minmax(0, 1fr))` }}>
            {others.map((o) => (
              <div key={o.id} className="min-h-0 cursor-pointer" onClick={() => setFocusId(o.id)}>
                <div className="pointer-events-none h-full">{tile(o, true)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const cols = streams.length === 1 ? 1 : 2
  const rows = Math.ceil(streams.length / cols)
  return (
    <div
      className="grid h-full min-h-0 gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {streams.map((s) => tile(s))}
    </div>
  )
}
