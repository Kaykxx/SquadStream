import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio'
import { RoomClient, type ScreenQuality, type ChatPayload, type Identity, type RemotePeer, type SignalingStatus } from '../webrtc'
import type { MicStatus } from './useAudio'

interface Options {
  code: string
  name: string
  identity: Identity
  engine: AudioEngine | null
  micStatus: MicStatus
  micStream: MediaStream | null
  muted: boolean
  deafened: boolean
}

/** Ponte React <-> src/webrtc: conecta à sala, recebe peers/chat e garante o cleanup. */
export function useRoom(o: Options) {
  const [status, setStatus] = useState<SignalingStatus>('connecting')
  const [statusDetail, setStatusDetail] = useState<string | undefined>()
  const [full, setFull] = useState(false)
  const [peers, setPeers] = useState<RemotePeer[]>([])
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({})
  const [messages, setMessages] = useState<ChatPayload[]>([])
  const [screens, setScreens] = useState<Record<string, MediaStream>>({})
  const [localSharing, setLocalSharing] = useState(false)
  const [screenError, setScreenError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const clientRef = useRef<RoomClient | null>(null)
  const latest = useRef(o)
  useEffect(() => { latest.current = o })

  const { code, name, identity, engine, micStatus, micStream } = o
  const ready = Boolean(engine) && micStatus !== 'starting'

  useEffect(() => {
    if (!engine || !ready) return
    const cur = latest.current
    let client: RoomClient | null = null
    // setTimeout 0: evita conectar duas vezes no remount do StrictMode (dev).
    const t = setTimeout(() => {
      client = new RoomClient({
        code, name, identity, engine, micStream,
        muted: cur.muted, deafened: cur.deafened,
        events: {
          onPeers: setPeers,
          onChat: (m) => setMessages((ms) => [...ms, m]),
          onStatus: (s, d) => { setStatus(s); setStatusDetail(d) },
          onFull: () => setFull(true),
          onScreen: (id, stream) => {
            setScreens((sc) => {
              if (!stream) { if (!(id in sc)) return sc; const { [id]: _drop, ...rest } = sc; return rest }
              return sc[id] === stream ? sc : { ...sc, [id]: stream }
            })
            if (id === cur.identity.peerId) setLocalSharing(Boolean(stream))
          },
          onLocalShareEnded: () => setLocalSharing(false),
          onScreenError: (m) => { setScreenError(m); setLocalSharing(false) },
          onNotice: setNotice,
          onSpeaking: (id, s) => setSpeaking((sp) => (sp[id] === s ? sp : { ...sp, [id]: s })),
        },
      })
      clientRef.current = client
      client.start()
    }, 0)
    const onHide = () => client?.destroy()
    window.addEventListener('pagehide', onHide)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pagehide', onHide)
      client?.destroy()
      clientRef.current = null
      setPeers([])
      setSpeaking({})
      setScreens({})
      setLocalSharing(false)
    }
  }, [code, name, identity, engine, ready, micStream])

  useEffect(() => {
    clientRef.current?.setLocalState({ muted: o.muted, deafened: o.deafened })
  }, [o.muted, o.deafened])

  const sendChat = (text: string) => {
    const msg = clientRef.current?.sendChat(text)
    if (msg) setMessages((ms) => [...ms, msg])
  }

  const startScreen = (q: ScreenQuality) => {
    setScreenError(null)
    setNotice(null)
    void clientRef.current?.startScreen(q)
  }
  const stopScreen = () => clientRef.current?.stopScreen()
  const setScreenQuality = (q: ScreenQuality) => { void clientRef.current?.setScreenQuality(q) }

  return { screens, localSharing, screenError, notice, dismissMessages: () => { setScreenError(null); setNotice(null) }, startScreen, stopScreen, setScreenQuality, status, statusDetail, full, peers, speaking, messages, sendChat }
}
