import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import { CloseIcon, SendIcon } from './Icons'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
}

export default function Chat({ messages, onSend, onClose }: Props) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Chat da sala</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" title="Fechar"><CloseIcon /></button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-xs text-zinc-600">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-black" style={{ background: m.color }}>{m.name[0]}</span>
            <div className="min-w-0">
              <p className="text-xs"><span className="font-semibold" style={{ color: m.color }}>{m.name}</span> <span className="text-zinc-600">{m.time}</span></p>
              <p className="break-words text-sm text-zinc-200">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={text} onChange={(e) => setText(e.target.value)} placeholder="Enviar mensagem…" maxLength={500}
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-white hover:brightness-110" title="Enviar"><SendIcon /></button>
      </form>
    </aside>
  )
}
