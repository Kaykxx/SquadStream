import { useEffect, useRef, useState, type ReactNode } from 'react'

const GAP = 12
const RATIO = 16 / 9

/** Maior tile 16:9 que permite acomodar n tiles na área W×H (mesma ideia da chamada do Discord). */
function fit(n: number, W: number, H: number) {
  let best = { w: 0, h: 0 }
  if (n < 1 || W <= 0 || H <= 0) return best
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    let w = (W - GAP * (cols - 1)) / cols
    let h = w / RATIO
    if (h * rows + GAP * (rows - 1) > H) {
      h = (H - GAP * (rows - 1)) / rows
      w = h * RATIO
    }
    if (w > best.w) best = { w, h }
  }
  return { w: Math.floor(best.w), h: Math.floor(best.h) }
}

/**
 * Tiles sempre 16:9 (sem esticar nem cortar o vídeo), do maior tamanho possível,
 * centralizados e quebrando em linhas conforme a janela.
 */
export default function FitGrid({ tiles }: { tiles: { key: string; node: ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const size = fit(tiles.length, box.w, box.h)
  return (
    <div ref={ref} className="flex h-full w-full flex-wrap content-center items-center justify-center" style={{ gap: GAP }}>
      {size.w > 0 && tiles.map((t) => (
        <div key={t.key} style={{ width: size.w, height: size.h }}>{t.node}</div>
      ))}
    </div>
  )
}
