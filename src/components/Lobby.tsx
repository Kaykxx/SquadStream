import { useState } from 'react'
import { genRoomCode, parseRoomInput } from '../roomCode'

export default function Lobby({ onJoin, presetCode = '' }: { onJoin: (code: string, name: string) => void; presetCode?: string }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('ss:name') ?? '' } catch { return '' } })
  const [input, setInput] = useState(presetCode)
  const [error, setError] = useState('')

  const create = () => onJoin(genRoomCode(), name.trim() || 'Você')
  const join = (e: React.FormEvent) => {
    e.preventDefault()
    const code = parseRoomInput(input)
    if (code.length < 6) return setError('Informe um código ou link de sala válido.')
    onJoin(code, name.trim() || 'Você')
  }

  return (
    <main className="relative grid min-h-full place-items-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-2xl font-black shadow-lg shadow-accent/30">S</div>
          <h1 className="text-3xl font-bold tracking-tight">SquadStream</h1>
          <p className="mt-2 text-sm text-zinc-400">Voz e transmissão de tela para até 4 amigos. Grátis, direto no navegador.</p>
        </div>

        <div className="space-y-5 rounded-2xl border border-line bg-panel p-6 shadow-2xl">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Seu apelido</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Como te chamam?"
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </label>

          <button onClick={create} className="w-full rounded-lg bg-gradient-to-r from-accent to-accent-2 py-3 text-sm font-semibold text-white transition hover:brightness-110">
            Criar nova sala
          </button>

          <div className="flex items-center gap-3 text-xs text-zinc-600"><span className="h-px flex-1 bg-line" />ou entre em uma<span className="h-px flex-1 bg-line" /></div>

          <form onSubmit={join} className="space-y-2">
            <div className="flex gap-2">
              <input value={input} onChange={(e) => { setInput(e.target.value); setError('') }} placeholder="Código ou link da sala"
                className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <button className="rounded-lg bg-panel-2 px-5 text-sm font-semibold hover:bg-line">Entrar</button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-zinc-600">Até 4 pessoas por sala · conexão P2P</p>
      </div>
    </main>
  )
}
