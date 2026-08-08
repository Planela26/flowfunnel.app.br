'use client'

import { useEffect, useRef, useState } from 'react'

export type Act = {
  /** Faixa de progresso (0–1) em que o bloco fica visível. */
  at: [number, number]
  /** Lado da tela — sempre o OPOSTO ao monitor naquele trecho. */
  side: 'left' | 'right'
  eyebrow: string
  title: string
  body: string
  /** Detalhes do que está na tela — uma linha cada. */
  bullets?: string[]
  stats?: { value: string; label: string; tone?: 'green' | 'sky' | 'plain' }[]
}

type Props = {
  frameCount: number
  scrollHeightVh?: number
  /** Suavização (0–1). Menor = mais suave, maior = mais direto. */
  smoothing?: number
  /** Progresso em que o hero começa e termina de sumir. */
  fadeStart?: number
  fadeEnd?: number
  acts?: Act[]
  /** Hero — renderizado ACIMA do monitor, nunca sobre a tela. */
  children?: React.ReactNode
}

const framePath = (i: number) =>
  `/scroll-frames/frame_${String(i).padStart(4, '0')}.jpg`

const toneClass = {
  green: 'text-emerald-400',
  sky: 'text-sky-400',
  plain: 'text-slate-100',
} as const

export default function ScrollVideoHero({
  frameCount,
  scrollHeightVh = 700,
  smoothing = 0.12,
  fadeStart = 0.1,
  fadeEnd = 0.2,
  acts = [],
  children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const actRefs = useRef<(HTMLDivElement | null)[]>([])
  const [loaded, setLoaded] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const images: HTMLImageElement[] = new Array(frameCount)
    let done = 0
    let alive = true

    // ── Pré-carga com concorrência limitada ───────────────────────────────
    let next = 0
    const CONCURRENCY = 8
    function loadNext() {
      if (!alive) return
      const i = next++
      if (i >= frameCount) return
      const img = new Image()
      img.decoding = 'async'
      img.onload = img.onerror = () => {
        done++
        if (alive) setLoaded(done)
        if (done === 1) draw(0)
        if (done === Math.min(24, frameCount) && alive) setReady(true)
        loadNext()
      }
      img.src = framePath(i + 1)
      images[i] = img
    }
    for (let k = 0; k < CONCURRENCY; k++) loadNext()

    // ── Canvas em tamanho de tela ─────────────────────────────────────────
    let cw = 0
    let ch = 0
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      cw = Math.round(window.innerWidth * dpr)
      ch = Math.round(window.innerHeight * dpr)
      canvas!.width = cw
      canvas!.height = ch
      canvas!.style.width = window.innerWidth + 'px'
      canvas!.style.height = window.innerHeight + 'px'
      draw(Math.round(cur))
    }

    let lastDrawn = -1
    const isReady = (i: number) => {
      const im = images[i]
      return !!im && im.complete && im.naturalWidth > 0
    }

    function draw(index: number) {
      // Se o frame pedido ainda não carregou, usa o mais próximo disponível —
      // sem isso o canvas congela no último frame desenhado durante um scroll
      // rápido, mostrando a cena errada.
      let use = index
      if (!isReady(use)) {
        let found = -1
        for (let d = 1; d < frameCount; d++) {
          if (isReady(index - d)) { found = index - d; break }
          if (isReady(index + d)) { found = index + d; break }
        }
        if (found < 0) return
        use = found
      }
      const img = images[use]
      if (!img || !img.complete || img.naturalWidth === 0) return
      const ir = img.naturalWidth / img.naturalHeight
      const cr = cw / ch
      let dw: number
      let dh: number
      if (ir > cr) {
        dh = ch
        dw = ch * ir
      } else {
        dw = cw
        dh = cw / ir
      }
      ctx!.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
      // Guarda o que foi REALMENTE desenhado: se foi um substituto, o tick
      // seguinte tenta de novo até o frame correto ficar disponível.
      lastDrawn = use
    }

    // ── Curva de entrada/saída de cada ato ────────────────────────────────
    function actOpacity(p: number, start: number, end: number) {
      if (p < start || p > end) return 0
      const span = end - start
      const inT = Math.min(0.22, span * 0.3)
      const outT = Math.min(0.22, span * 0.3)
      if (p < start + inT) return (p - start) / inT
      if (p > end - outT) return (end - p) / outT
      return 1
    }

    // ── Loop rAF ──────────────────────────────────────────────────────────
    let cur = 0
    let raf = 0
    function tick() {
      if (!alive) return
      const rect = wrap!.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0

      const target = p * (frameCount - 1)
      cur += (target - cur) * smoothing
      if (Math.abs(target - cur) < 0.01) cur = target
      const idx = Math.round(cur)
      if (idx !== lastDrawn) draw(idx)

      // Hero some conforme a câmera entra na tela
      const hero = heroRef.current
      if (hero) {
        const f = (p - fadeStart) / Math.max(0.001, fadeEnd - fadeStart)
        const o = 1 - Math.min(1, Math.max(0, f))
        hero.style.opacity = String(o)
        hero.style.transform = `translate3d(0,${(1 - o) * -28}px,0)`
        hero.style.pointerEvents = o < 0.05 ? 'none' : ''
      }

      // Blocos de texto por ato
      for (let i = 0; i < acts.length; i++) {
        const el = actRefs.current[i]
        if (!el) continue
        const [s, e] = acts[i].at
        const o = actOpacity(p, s, e)
        el.style.opacity = String(o)
        const dir = acts[i].side === 'left' ? -1 : 1
        el.style.transform = `translate3d(${(1 - o) * 26 * dir}px,0,0)`
        el.style.visibility = o <= 0.001 ? 'hidden' : 'visible'
      }

      raf = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(tick)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [frameCount, smoothing, fadeStart, fadeEnd, acts])

  const pct = Math.round((loaded / frameCount) * 100)

  return (
    <div
      ref={wrapRef}
      style={{ height: `${scrollHeightVh}vh` }}
      className="relative w-full bg-black"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        <canvas ref={canvasRef} className="block h-full w-full" />

        {!ready && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black">
            <div className="flex w-56 flex-col items-center gap-3">
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-white/80 transition-[width] duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                {pct}%
              </p>
            </div>
          </div>
        )}

        {/* ── HERO — acima do monitor ─────────────────────────────────── */}
        {children && (
          <div
            ref={heroRef}
            className="absolute inset-x-0 top-0 z-20 will-change-[opacity,transform]"
          >
            {/* scrim superior para legibilidade */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[130%] bg-gradient-to-b from-black/85 via-black/45 to-transparent" />
            <div className="relative px-6 pt-24 sm:pt-28">{children}</div>
          </div>
        )}

        {/* ── ATOS — texto sempre no lado oposto ao monitor ────────────── */}
        {acts.map((act, i) => (
          <div
            key={act.title}
            ref={(el) => {
              actRefs.current[i] = el
            }}
            style={{ opacity: 0, visibility: 'hidden' }}
            className={[
              'absolute z-20 flex will-change-[opacity,transform]',
              // Mobile: o monitor ocupa o quadro inteiro — não há lado livre,
              // então o texto ancora no rodapé. Desktop: lado oposto ao monitor.
              'inset-0 items-end sm:inset-y-0 sm:inset-x-auto sm:items-center',
              act.side === 'left' ? 'sm:left-0' : 'sm:right-0',
            ].join(' ')}
          >
            {/* scrim mobile: de baixo para cima */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/85 to-transparent sm:hidden" />
            {/* scrim desktop: direcional */}
            <div
              className={[
                'pointer-events-none absolute inset-0 -z-10 hidden sm:block',
                act.side === 'left'
                  ? 'bg-gradient-to-r from-black/90 via-black/60 to-transparent'
                  : 'bg-gradient-to-l from-black/90 via-black/60 to-transparent',
              ].join(' ')}
            />
            <div
              className={[
                'w-full px-6 pb-9 pt-8 sm:w-[min(28rem,37vw)] sm:px-11 sm:py-10',
                act.side === 'left' ? 'text-left' : 'text-left sm:text-right',
              ].join(' ')}
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-sky-400">
                {act.eyebrow}
              </p>
              <h2
                className="mt-3 text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.032em] text-[#F4F7FB] sm:mt-4 sm:text-[3.15rem]"
                style={{ fontFamily: 'var(--font-display), Inter, sans-serif' }}
              >
                {act.title}
              </h2>
              <p className="mt-3.5 text-[15px] leading-[1.55] text-slate-200/85 sm:mt-5 sm:text-[1.0625rem] sm:leading-[1.6]">
                {act.body}
              </p>

              {act.bullets && (
                <ul className="mt-5 space-y-2 border-t border-white/12 pt-4 sm:mt-7 sm:space-y-3 sm:pt-6">
                  {act.bullets.map((b) => (
                    <li
                      key={b}
                      className="text-[13.5px] leading-[1.4] text-slate-300/80 sm:text-[15.5px] sm:leading-[1.45]"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {act.stats && (
                <div
                  className={[
                    'mt-6 flex gap-8 sm:mt-8 sm:gap-10',
                    act.side === 'right' ? 'sm:justify-end' : '',
                  ].join(' ')}
                >
                  {act.stats.map((s) => (
                    <div key={s.label}>
                      <div
                        className={[
                          'text-[1.4rem] font-bold tabular-nums tracking-[-0.02em] sm:text-[2.1rem]',
                          toneClass[s.tone ?? 'plain'],
                        ].join(' ')}
                      >
                        {s.value}
                      </div>
                      <div className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-400/85">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
