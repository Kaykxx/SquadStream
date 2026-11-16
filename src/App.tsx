import { useEffect, useState } from 'react'
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
  const [updateReady, setUpdateReady] = useState(false)
  useEffect(() => {
    const on = () => setUpdateReady(true)
    window.addEventListener('ss:update', on)
    return () => window.removeEventListener('ss:update', on)
  }, [])

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

  const banner = updateReady && (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-xl border border-accent/50 bg-panel px-4 py-3 text-sm shadow-xl">
      <span>Nova versão disponível.</span>
      <button onClick={() => location.reload()} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold hover:brightness-110">
        Atualizar{session ? ' (reconecta à sala)' : ''}
      </button>
      <button onClick={() => setUpdateReady(false)} className="text-xs text-zinc-400 hover:text-zinc-200">Depois</button>
    </div>
  )

  return (
    <>
      {session ? <Room code={session.code} name={session.name} onLeave={leave} /> : <Lobby presetCode={init.preset} onJoin={join} />}
      {banner}
    </>
  )
}
