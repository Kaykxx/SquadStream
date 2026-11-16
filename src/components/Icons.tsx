import type { ReactNode } from 'react'

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const I = ({ children }: { children: ReactNode }) => <svg {...base}>{children}</svg>

export const MicIcon = () => <I><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></I>
export const MicOffIcon = () => <I><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2M15 10V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3" /></I>
export const HeadphonesIcon = () => <I><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></I>
export const HeadphonesOffIcon = () => <I><path d="M3 3l18 18M4 15v-3a8 8 0 0 1 12.5-6.6M20 12v3" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></I>
export const ScreenIcon = () => <I><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></I>
export const PhoneOffIcon = () => <I><path d="M3 3l18 18M10 6.5C8.5 7 7 8 6 9.5c-2 3 0 7.5 3.5 10M14 14.5c1.5 1 3 1.4 4.5 1v-3.5l-3-1-1.5 1.5" /></I>
export const ChatIcon = () => <I><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" /></I>
export const FullscreenIcon = () => <I><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></I>
export const PipIcon = () => <I><rect x="2" y="4" width="20" height="16" rx="2" /><rect x="12" y="12" width="7" height="5" rx="1" /></I>
export const FocusIcon = () => <I><circle cx="12" cy="12" r="3" /><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></I>
export const GridIcon = () => <I><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></I>
export const VolumeIcon = () => <I><path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></I>
export const SendIcon = () => <I><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></I>
export const CopyIcon = () => <I><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></I>
export const CloseIcon = () => <I><path d="M18 6 6 18M6 6l12 12" /></I>
export const CameraIcon = () => <I><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></I>
export const CameraOffIcon = () => <I><path d="M3 3l18 18M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.7 0H14a2 2 0 0 1 2 2v3.3l1 1L23 7v10" /></I>
