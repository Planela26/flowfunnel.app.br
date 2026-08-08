'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send } from 'lucide-react'

const MESSAGES: { role: 'user' | 'sara'; text: string }[] = [
  { role: 'user', text: 'Por que minhas vendas caíram esta semana?' },
  {
    role: 'sara',
    text:
      'Identifiquei uma queda de 23% na conversão da etapa WhatsApp → Checkout, junto com alta no CPC das campanhas da Meta. Recomendo revisar a campanha “Oferta Principal” e checar a estabilidade do webhook.',
  },
  { role: 'user', text: 'Qual campanha tem o melhor ROI?' },
  {
    role: 'sara',
    text:
      'A “Remarketing — Quem Visitou o Checkout” está com ROI de 4,8x, bem acima das demais. Seu CAC ali é R$ 38 contra receita média de R$ 182 por cliente. Vale subir o orçamento dela em 30%.',
  },
]

export default function SaraChatDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(0)
  const [started, setStarted] = useState(false)

  // Só começa a animar quando a seção entra na tela.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!started || shown >= MESSAGES.length) return
    const delay = shown === 0 ? 300 : MESSAGES[shown - 1].role === 'user' ? 900 : 1500
    const t = setTimeout(() => setShown((v) => v + 1), delay)
    return () => clearTimeout(t)
  }, [started, shown])

  return (
    <div
      ref={ref}
      className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/50 backdrop-blur-sm"
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
        <div className="relative">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-300">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080b14] bg-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Sara.AI</p>
          <p className="text-xs text-emerald-400">Online · analisando seus dados</p>
        </div>
      </div>

      {/* mensagens */}
      <div className="min-h-[320px] space-y-4 p-5">
        {MESSAGES.map((m, i) => {
          const visible = i < shown
          const isUser = m.role === 'user'
          return (
            <div
              key={i}
              className={[
                'flex gap-2.5 transition-all duration-500',
                isUser ? 'flex-row-reverse' : '',
                visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
              ].join(' ')}
            >
              {!isUser && (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-300">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div
                className={[
                  'max-w-[82%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed',
                  isUser
                    ? 'ml-auto rounded-br-sm bg-sky-600 text-white'
                    : 'rounded-bl-sm border border-white/10 bg-white/[0.06] text-slate-200',
                ].join(' ')}
              >
                {!isUser && (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    Sara.AI
                  </p>
                )}
                {m.text}
              </div>
            </div>
          )
        })}

        {/* indicador de digitação */}
        {started && shown < MESSAGES.length && MESSAGES[shown]?.role === 'sara' && (
          <div className="flex gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-300">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.06] px-4 py-3.5">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400/80"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* input decorativo */}
      <div className="px-5 pb-5">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
          <span className="flex-1 text-sm text-slate-400/80">
            Pergunte algo sobre seu funil…
          </span>
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500">
            <Send className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
