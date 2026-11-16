import { useState } from 'react'
import type { Participant, Quality } from '../types'
import StreamTile from './StreamTile'
import ParticipantTile from './ParticipantTile'
import FitGrid from './FitGrid'

interface Props {
  users: Participant[]
  screens: Record<string, MediaStream>
  cameras: Record<string, MediaStream>
  quality: Quality
  onScreenVolume: (id: string, v: number) => void
  onVoiceVolume: (id: string, v: number) => void
}

interface Tile { key: string; kind: 'screen' | 'person'; p: Participant }

/**
 * Palco estilo Discord:
 *  - sem tela transmitindo: pessoas (câmera ou avatar) ocupam a grade principal;
 *  - com tela(s): as telas ficam na grade principal e as pessoas numa faixa de miniaturas;
 *  - qualquer tile pode ser ampliado (foco): os demais vão para a faixa.
 */
export default function Stage({ users, screens, cameras, quality, onScreenVolume, onVoiceVolume }: Props) {
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const screenTiles: Tile[] = users.filter((u) => u.sharing).map((p) => ({ key: `screen:${p.id}`, kind: 'screen', p }))
  const personTiles: Tile[] = users.map((p) => ({ key: `person:${p.id}`, kind: 'person', p }))
  const all = [...screenTiles, ...personTiles]
  const focus = all.find((t) => t.key === focusKey) ?? null

  const render = (t: Tile, compact = false) => {
    const focused = focus?.key === t.key
    const toggle = () => setFocusKey(focused ? null : t.key)
    return t.kind === 'screen' ? (
      <StreamTile
        key={t.key} p={t.p} stream={screens[t.p.id]} quality={quality} focused={focused} compact={compact}
        onFocus={toggle} onScreenVolume={(v) => onScreenVolume(t.p.id, v)}
      />
    ) : (
      <ParticipantTile
        key={t.key} p={t.p} stream={cameras[t.p.id]} focused={focused} compact={compact}
        onFocus={toggle} onVoiceVolume={(v) => onVoiceVolume(t.p.id, v)}
      />
    )
  }

  const strip = (tiles: Tile[]) => (
    <div className="grid h-28 shrink-0 auto-cols-[199px] grid-flow-col justify-center gap-3 overflow-x-auto">
      {tiles.map((t) => (
        <div key={t.key} className="min-h-0">
          {/* Em miniatura, o clique inteiro amplia (telas ignoram os botões internos). */}
          {t.kind === 'screen' ? (
            <div className="h-full cursor-pointer" onClick={() => setFocusKey(t.key)}>
              <div className="pointer-events-none h-full">{render(t, true)}</div>
            </div>
          ) : render(t, true)}
        </div>
      ))}
    </div>
  )

  const grid = (tiles: Tile[]) => <FitGrid tiles={tiles.map((t) => ({ key: t.key, node: render(t) }))} />

  let main: React.ReactNode
  let side: Tile[] = []
  if (focus) {
    main = grid([focus])
    side = all.filter((t) => t.key !== focus.key)
  } else if (screenTiles.length > 0) {
    main = grid(screenTiles)
    side = personTiles
  } else {
    main = grid(personTiles)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-xl bg-black p-3">
      <div className="min-h-0 flex-1">{main}</div>
      {side.length > 0 && strip(side)}
    </div>
  )
}
