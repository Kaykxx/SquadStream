# Regras do Projeto SquadStream
- **Economia de Cota:** NUNCA dispare mais de 2 subagentes simultaneos. Construa uma etapa por vez e aguarde confirmacao antes de seguir.
- **Stack 100% Gratuita:** React + Vite + TypeScript + Tailwind CSS no frontend. WebRTC nativo (malha P2P para ate 4 usuarios) para audio/video e Supabase Realtime (plano gratuito) para sinalizacao, presenca e chat.
- **Qualidade de Codigo:** Mantenha o motor WebRTC e o gerenciador de audio (Web Audio API) separados da interface visual em src/webrtc/ e src/audio/.
