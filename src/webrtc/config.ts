export const MAX_PEERS = 4

export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ]
  const url = import.meta.env.VITE_TURN_URL as string | undefined
  if (url) {
    servers.push({
      urls: url.split(','),
      username: (import.meta.env.VITE_TURN_USERNAME as string | undefined) ?? '',
      credential: (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) ?? '',
    })
  }
  return servers
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
