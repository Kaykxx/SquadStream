import { useCallback, useEffect, useRef, useState } from 'react'
import { MIC_ENABLED } from '../features'
import { AudioEngine, MicError, startMic, type MicHandle } from '../audio'

export type MicStatus = 'starting' | 'ready' | 'error' | 'disabled'

interface Options {
  muted: boolean
  deafened: boolean
  /** Atividade de voz local (já vinda do VAD, sem considerar mudo). */
  onLocalSpeaking: (speaking: boolean) => void
}

/** Ponte React <-> src/audio: cria o motor, abre o microfone e garante o cleanup ao sair. */
export function useAudio({ muted, deafened, onLocalSpeaking }: Options) {
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [micStatus, setMicStatus] = useState<MicStatus>('starting')
  const [micError, setMicError] = useState<string | null>(null)
  const [audioState, setAudioState] = useState<AudioContextState>('suspended')
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const micRef = useRef<MicHandle | null>(null)
  const speakingCb = useRef(onLocalSpeaking)
  useEffect(() => { speakingCb.current = onLocalSpeaking })

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const eng = new AudioEngine()
    // Adiado em microtask: o motor é um recurso externo, e o estado só espelha o ciclo de vida dele.
    queueMicrotask(() => {
      if (cancelled) return
      setEngine(eng)
      setAudioState(eng.state)
    })
    const offState = eng.onStateChange(setAudioState)
    const offGesture = eng.autoResumeOnGesture()
    void eng.resume()
    let stopVad = () => {}

    if (!MIC_ENABLED) {
      // Sem pedir permissão nem abrir o microfone. O áudio de transmissões e a voz de quem tem mic continuam funcionando.
      queueMicrotask(() => {
        if (cancelled) return
        setMicStatus('disabled')
        setMicError(null)
      })
    } else {
      queueMicrotask(() => {
        if (cancelled) return
        setMicStatus('starting')
        setMicError(null)
      })
      startMic()
        .then((mic) => {
          if (cancelled) { mic.stop(); return }
          micRef.current = mic
          stopVad = eng.watchLocalVoice(mic.stream, (s) => speakingCb.current(s))
          setMicStream(mic.stream)
          setMicStatus('ready')
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setMicStatus('error')
          setMicError(e instanceof MicError ? e.message : 'Erro inesperado ao abrir o microfone.')
        })
    }

    const onHide = () => { micRef.current?.stop() }
    window.addEventListener('pagehide', onHide)

    return () => {
      cancelled = true
      window.removeEventListener('pagehide', onHide)
      offGesture()
      offState()
      stopVad()
      micRef.current?.stop()
      micRef.current = null
      eng.dispose()
      setEngine(null)
      setMicStream(null)
    }
  }, [attempt])

  // Mudo / Ensurdecido: aplica na track e no volume mestre.
  useEffect(() => { micRef.current?.setMuted(muted || deafened) }, [muted, deafened, micStatus])
  useEffect(() => { engine?.setDeafened(deafened) }, [deafened, engine])

  const retryMic = useCallback(() => { setAttempt((a) => a + 1) }, [])
  const enableAudio = useCallback(() => engine?.resume(), [engine])

  return { engine, micStream, micStatus, micError, audioState, retryMic, enableAudio }
}
