/**
 * Microfone/voz desativado por enquanto. Para reativar: defina VITE_ENABLE_MIC=true no .env.local
 * (e na Vercel) ou troque o padrão abaixo para true.
 */
export const MIC_ENABLED: boolean = import.meta.env.VITE_ENABLE_MIC === 'true'
