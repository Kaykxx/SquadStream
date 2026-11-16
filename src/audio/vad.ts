/**
 * Detecção de atividade de voz (VAD) via AnalyserNode.
 * RMS do sinal com histerese: liga acima de ON_LEVEL, só desliga após HOLD_MS abaixo de OFF_LEVEL.
 */
const ON_LEVEL = 0.02
const OFF_LEVEL = 0.012
const HOLD_MS = 350
const POLL_MS = 60

export interface Vad {
  readonly analyser: AnalyserNode
  isSpeaking: () => boolean
  dispose: () => void
}

export function createVad(ctx: AudioContext, source: AudioNode, onChange: (speaking: boolean) => void): Vad {
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  source.connect(analyser)
  const buf = new Float32Array(analyser.fftSize)
  let speaking = false
  let lastLoud = 0

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    const rms = Math.sqrt(sum / buf.length)
    const now = performance.now()
    if (rms > (speaking ? OFF_LEVEL : ON_LEVEL)) lastLoud = now
    const next = speaking ? now - lastLoud < HOLD_MS : rms > ON_LEVEL
    if (next !== speaking) {
      speaking = next
      onChange(speaking)
    }
  }, POLL_MS)

  return {
    analyser,
    isSpeaking: () => speaking,
    dispose() {
      clearInterval(timer)
      try { source.disconnect(analyser) } catch { /* já desconectado */ }
      analyser.disconnect()
      if (speaking) onChange(false)
    },
  }
}
