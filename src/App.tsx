import { useState } from 'react'
import Lobby from './components/Lobby'
import Room from './components/Room'
import { parseRoomInput } from './roomCode'
import { clearIdentity } from './webrtc'

interface Session { code: string; name: string }
const KEY = 'ss:session'

function loadInitial(): { session: Session | null; preset: string } {
  const q = new URLSearchParams(location.search).get('sala')
  const preset = q ? parseRoomInput(q) : ''
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw && preset) {
      const s = JSON.parse(raw) as Session
      // F5 com ?sala=CODIGO na mesma aba: volta direto para a sala (mesma identidade, sem fantasma).
      if (s.code === preset) return { session: s, preset }
    }
  } catch { /* ignore */ }
  return { session: null, preset }
}

export default function App() {
  const [init] = useState(loadInitial)
  const [session, setSession] = useState<Session | null>(init.session)

  const join = (code: string, name: string) => {
    const s = { code, name }
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); localStorage.setItem('ss:name', name) } catch { /* ignore */ }
    history.replaceState(null, '', `?sala=${code}`)
    setSession(s)
  }
  const leave = () => {
    try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
    clearIdentity()
    history.replaceState(null, '', location.pathname)
    setSession(null)
  }

  if (!session) return <Lobby presetCode={init.preset} onJoin={join} />
  return <Room code={session.code} name={session.name} onLeave={leave} />
}
