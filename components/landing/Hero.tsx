'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'

const display = { fontFamily: 'var(--font-display), Inter, sans-serif' }

/**
 * Herói estático — sem scroll-jacking. O vídeo é uma peça central com
 * play button, não um mecanismo de scroll. Tipografia em px/clamp() (não
 * rem) porque a raiz do site é 14px/12px — ver app/globals.css.
 */
export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const handlePlay = () => {
    const video = videoRef.current
    if (!video) return
    video.play()
    setPlaying(true)
  }

  return (
    <section className="relative overflow-hidden bg-black px-6 pb-20 pt-36 sm:pb-28 sm:pt-44">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-[clamp(11px,0.75vw,13px)] font-bold uppercase tracking-[0.22em] text-sky-400">
          FlowSara
        </span>

        <h1
          className="mx-auto mt-6 max-w-3xl text-balance text-[clamp(40px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.03em] text-[#F4F7FB]"
          style={display}
        >
          Veja o caminho completo{' '}
          <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
            entre o investimento e a venda.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-[600px] text-pretty text-[clamp(16px,1.2vw,20px)] leading-[1.55] text-slate-300/90">
          Meta, Google, TikTok, WhatsApp e checkout conectados num só
          painel. Você sabe de onde veio cada cliente, quanto ele gerou e
          onde as vendas estão travando.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-white/90"
          >
            Criar conta grátis
          </Link>
          <Link
            href="#planos"
            className="rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            Ver planos
          </Link>
        </div>

        <p className="mt-6 text-[13px] text-slate-500">
          ✓ 1.200+ clientes ativos desde 2023 · 25% crescimento mensal · 99.9% uptime
        </p>
      </div>

      {/* ── Player de demonstração ──────────────────────────────────────── */}
      <div className="relative mx-auto mt-14 max-w-4xl sm:mt-16">
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_40px_120px_-40px_rgba(56,189,248,0.35)]">
          <video
            ref={videoRef}
            className="block aspect-video w-full bg-black"
            src="/media/demo-video-web.mp4"
            poster="/media/demo-poster.jpg"
            controls={playing}
            playsInline
            preload="metadata"
          />
          {!playing && (
            <button
              type="button"
              onClick={handlePlay}
              aria-label="Assistir demonstração"
              className="absolute inset-0 flex items-center justify-center bg-black/25 transition hover:bg-black/35"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-xl transition group-hover:scale-105 sm:h-20 sm:w-20">
                <Play className="ml-1 h-6 w-6 fill-black sm:h-7 sm:w-7" />
              </span>
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-[13px] text-slate-500">
          48 segundos · como o painel mostra investimento, funil e vendas em
          tempo real
        </p>
      </div>
    </section>
  )
}
