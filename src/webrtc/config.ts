export const MAX_PEERS = 4

const STUN_ONLY: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

/**
 * Busca os servidores ICE na função /api/turn (credenciais TURN temporárias, nunca embutidas no site).
 * Nunca falha: sem a função (ex.: npm run dev) ou com erro, cai para STUN apenas.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const r = await fetch('/api/turn', { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!r.ok) throw new Error(String(r.status))
    const data = (await r.json()) as { iceServers?: RTCIceServer[] }
    if (Array.isArray(data.iceServers) && data.iceServers.length) return data.iceServers
  } catch {
    console.info('[ice] /api/turn indisponível; usando apenas STUN')
  }
  return STUN_ONLY
}

export type ScreenQuality = '720p30' | '1080p60' | 'text'

export interface QualityProfile {
  width: number
  height: number
  fps: number
  /** bits/s do codec de vídeo no RTCRtpSender */
  maxBitrate: number
  contentHint: 'motion' | 'detail' | 'text'
  /** O que sacrificar quando a rede aperta */
  degradation: 'maintain-framerate' | 'maintain-resolution' | 'balanced'
}

export const QUALITY_PROFILES: Record<ScreenQuality, QualityProfile> = {
  '720p30': { width: 1280, height: 720, fps: 30, maxBitrate: 2_500_000, contentHint: 'motion', degradation: 'balanced' },
  '1080p60': { width: 1920, height: 1080, fps: 60, maxBitrate: 6_000_000, contentHint: 'motion', degradation: 'maintain-framerate' },
  // Texto: menos fps, mais detalhe por quadro
  text: { width: 1920, height: 1080, fps: 15, maxBitrate: 4_000_000, contentHint: 'text', degradation: 'maintain-resolution' },
}
