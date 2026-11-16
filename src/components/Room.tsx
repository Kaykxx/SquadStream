import { useEffect, useMemo, useState } from 'react'
import type { ChatMessage, Participant, Quality } from '../types'
import StreamGrid from './StreamGrid'
import UserBar from './UserBar'
import ControlBar from './ControlBar'
import Chat from './Chat'
import { CopyIcon } from './Icons'
import { useAudio } from '../hooks/useAudio'
import { MIC_ENABLED } from '../features'
import { useRoom } from '../hooks/useRoom'
import { colorFor, getIdentity } from '../webrtc'

interface Props {
  code: string
  name: string
  onLeave: () => void
}

const fmt = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function Room({ code, name, onLeave }: Props) {
  const identity = useMemo(() => getIdentity(code), [code])
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [micSpeaking, setMicSpeaking] = useState(false)
  const [quality, setQuality] = useState<Quality>('1080p60')
  const [chatOpen, setChatOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [volumes, setVolumes] = useState<Record<string, { voice: number; screen: number }>>({})

  const { engine, micStream, micStatus, micError, audioState, retryMic, enableAudio } = useAudio({
    muted, deafened, onLocalSpeaking: setMicSpeaking,
  })
  const room = useRoom({ code, name, identity, engine, micStatus, micStream, muted, deafened })

  // Sliders -> GainNode (0–200%)
  useEffect(() => {
    if (!engine) return
    for (const [id, v] of Object.entries(volumes)) {
      engine.setGain(id, 'voice', v.voice)
      engine.setGain(id, 'screen', v.screen)
    }
  }, [engine, volumes])

  const setVol = (id: string, key: 'voice' | 'screen', v: number) =>
    setVolumes((vs) => ({ ...vs, [id]: { ...(vs[id] ?? { voice: 100, screen: 100 }), [key]: v } }))

  const users: Participant[] = useMemo(() => {
    const me: Participant = {
      id: identity.peerId, name, color: colorFor(identity.peerId), isMe: true,
      speaking: micSpeaking, muted, deafened, sharing: room.localSharing, voiceVolume: 100, screenVolume: 100,
    }
    const others = room.peers.map<Participant>((p) => ({
      id: p.id, name: p.name, color: p.color,
      speaking: Boolean(room.speaking[p.id]), muted: p.muted, deafened: p.deafened, sharing: p.sharing,
      voiceVolume: volumes[p.id]?.voice ?? 100, screenVolume: volumes[p.id]?.screen ?? 100,
      connection: p.connection,
    }))
    return [me, ...others]
  }, [identity.peerId, name, micSpeaking, muted, deafened, room.localSharing, room.peers, room.speaking, volumes])

  const messages: ChatMessage[] = useMemo(
    () => room.messages.map((m) => ({ id: m.id, authorId: m.from, name: m.name, color: m.color, text: m.text, time: fmt(m.ts) })),
    [room.messages],
  )
  const streams = useMemo(() => users.filter((u) => u.sharing), [users])

  // Contador de não lidas (mensagens de outros enquanto o chat está fechado)
  const [seen, setSeen] = useState(0)
  // Ao abrir ou fechar o chat, tudo o que existe até ali conta como lido.
  const toggleChat = (open: boolean) => { setSeen(room.messages.length); setChatOpen(open) }
  const unreadCount = chatOpen ? 0 : room.messages.slice(seen).filter((m) => m.from !== identity.peerId).length

  const toggleDeafen = () => {
    const next = !deafened
    setDeafened(next)
    if (next) setMuted(true)
  }

  const link = `${location.origin}/?sala=${code}`
  const copy = () => {
    navigator.clipboard?.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (room.full) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Sala cheia</h1>
          <p className="text-sm text-zinc-400">A sala <span className="font-mono text-accent-2">{code}</span> já tem 4 participantes, o limite do SquadStream.</p>
          <button onClick={onLeave} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold hover:brightness-110">Voltar ao início</button>
        </div>
      </div>
    )
  }

  const statusLabel =
    room.status === 'connected' ? null : room.status === 'connecting' ? 'Conectando à sala…' : room.status === 'closed' ? 'Desconectado. Reconectando…' : null

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <header className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 font-black">S</div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Sala <span className="font-mono tracking-widest text-accent-2">{code}</span></p>
            <p className="text-[11px] text-zinc-500">{users.length}/4 participantes · {streams.length} transmitindo</p>
          </div>
        </div>
        <button onClick={copy} className="flex items-center gap-2 rounded-lg bg-panel-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-line">
          <CopyIcon />{copied ? 'Link copiado!' : 'Copiar link'}
        </button>
      </header>

      {room.status === 'error' && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{room.statusDetail}</div>
      )}
      {statusLabel && <div className="rounded-xl border border-line bg-panel px-4 py-2 text-sm text-zinc-400">{statusLabel}</div>}
      {micStatus === 'error' && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          <span>{micError} Você entrou no modo “só ouvir”.</span>
          <button onClick={retryMic} className="shrink-0 rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-400">Tentar de novo</button>
        </div>
      )}
      {room.screenError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          <span>{room.screenError}</span>
          <button onClick={room.dismissMessages} className="shrink-0 text-xs text-red-300 underline">Fechar</button>
        </div>
      )}
      {room.notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          <span>{room.notice}</span>
          <button onClick={room.dismissMessages} className="shrink-0 text-xs text-amber-300 underline">Fechar</button>
        </div>
      )}
      {micStatus === 'starting' && (
        <div className="rounded-xl border border-line bg-panel px-4 py-2 text-sm text-zinc-400">Aguardando permissão do microfone…</div>
      )}
      {audioState === 'suspended' && (
        <button onClick={() => void enableAudio()} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-left text-sm text-amber-200 hover:bg-amber-500/20">
          O navegador bloqueou o áudio. Clique aqui para ativar.
        </button>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <StreamGrid streams={streams} screens={room.screens} quality={quality} onScreenVolume={(id, v) => setVol(id, 'screen', v)} />
        </div>
        {chatOpen && <Chat messages={messages} onSend={room.sendChat} onClose={() => toggleChat(false)} />}
      </div>

      <UserBar users={users} onVoiceVolume={(id, v) => setVol(id, 'voice', v)} />

      <ControlBar
        micEnabled={MIC_ENABLED} muted={muted} deafened={deafened} sharing={room.localSharing} quality={quality}
        chatOpen={chatOpen} unread={unreadCount}
        onMute={() => setMuted((m) => !m)} onDeafen={toggleDeafen}
        onShare={() => (room.localSharing ? room.stopScreen() : room.startScreen(quality))}
        onQuality={(q) => { setQuality(q); room.setScreenQuality(q) }}
        onChat={() => toggleChat(!chatOpen)}
        onLeave={onLeave}
      />
    </div>
  )
}
