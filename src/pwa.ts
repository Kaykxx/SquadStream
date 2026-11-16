/** PWA: registro do service worker, aviso de nova versão e botão "Instalar app". */
import { useEffect, useState } from 'react'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function registerServiceWorker(onUpdate: () => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    notify()
  })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        worker?.addEventListener('statechange', () => {
          // Só avisa se já havia uma versão rodando (não na primeira instalação).
          if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdate()
        })
      })
      // Procura versão nova de tempos em tempos e quando a janela volta a ficar visível.
      const check = () => { void reg.update().catch(() => {}) }
      setInterval(check, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    }).catch(() => { /* sem SW o app funciona normalmente */ })
  })
}

/** Retorna uma função para abrir o instalador do navegador, ou null se não disponível/já instalado. */
export function useInstall(): (() => Promise<void>) | null {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  if (!deferred) return null
  return async () => {
    const ev = deferred
    if (!ev) return
    await ev.prompt()
    await ev.userChoice
    deferred = null
    notify()
  }
}
