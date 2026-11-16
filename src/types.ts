import type { LinkState, ScreenQuality } from './webrtc'

export type Quality = ScreenQuality

export interface Participant {
  id: string
  name: string
  color: string
  isMe?: boolean
  speaking: boolean
  muted: boolean
  deafened: boolean
  sharing: boolean
  /** 0–200 (%) volume da voz deste participante */
  voiceVolume: number
  /** 0–200 (%) volume da transmissão de tela deste participante */
  screenVolume: number
  /** Estado da conexão P2P (somente remotos) */
  connection?: LinkState
}

export interface ChatMessage {
  id: string
  authorId: string
  name: string
  color: string
  text: string
  time: string
}

export const QUALITY_LABEL: Record<Quality, string> = {
  '720p30': '720p · 30 fps',
  '1080p60': '1080p · 60 fps',
  text: 'Nitidez de Texto',
}
