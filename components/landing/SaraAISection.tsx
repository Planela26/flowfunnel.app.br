'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, TrendingUp, AlertTriangle, BarChart2, MessageCircle,
  Zap, Brain, Target, CheckCircle2, ChevronRight, ArrowRight,
} from 'lucide-react'

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Analisa seus funis automaticamente',
    desc: 'Acompanha cada etapa e identifica os gargalos que reduzem suas conversões — sem você precisar pedir.',
    iconBg: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    icon: AlertTriangle,
    title: 'Detecta problemas antes de você',
    desc: 'Falhas em webhooks, integrações quebradas, APIs com timeout, pagamentos com erro — Sara.AI avisa primeiro.',
    iconBg: 'bg-orange-50 border-orange-100',
    iconColor: 'text-orange-500',
  },
  {
    icon: BarChart2,
    title: 'Interpreta métricas em linguagem simples',
    desc: 'Não apenas exibe números. Explica o que cada métrica significa e o que você deve fazer com ela.',
    iconBg: 'bg-indigo-50 border-indigo-100',
    iconColor: 'text-indigo-600',
  },
  {
    icon: Target,
    title: 'Identifica oportunidades de vendas',
    desc: 'Encontra onde seus leads abandonam o processo e recomenda ações específicas para recuperá-los.',
    iconBg: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    icon: Brain,
    title: 'Especialista em marketing digital',
    desc: 'Funis, tráfego pago, ROI, CAC, LTV, copywriting, lançamentos, perpétuo, WhatsApp Marketing e muito mais.',
    iconBg: 'bg-cyan-50 border-cyan-100',
    iconColor: 'text-cyan-600',
  },
  {
    icon: Zap,
    title: 'Recomenda ações inteligentes',
    desc: 'Sugere melhorias para campanhas, funis, páginas e processos com base nos seus dados reais.',
    iconBg: 'bg-amber-50 border-amber-100',
    iconColor: 'text-amber-500',
  },
]

// ── Simulated chat conversation ───────────────────────────────────────────────
const CHAT_MESSAGES = [
  { role: 'user', text: 'Por que minhas vendas caíram esta semana?' },
  { role: 'sara', text: 'Analisei seus dados e identifiquei uma redução de 23% na conversão da etapa WhatsApp → Checkout. Também houve aumento no custo por clique nas campanhas da Meta. Recomendo revisar a campanha "Oferta Principal" e verificar a estabilidade da integração de webhook.' },
  { role: 'user', text: 'Como posso aumentar minha conversão?' },
  { role: 'sara', text: 'Seu funil tem uma taxa de abandono elevada após o primeiro contato. Sugiro 3 ações: (1) implementar uma sequência de recuperação via WhatsApp nas primeiras 2h, (2) revisar o copy da página de checkout, e (3) testar um desconto por tempo limitado para leads que já visitaram 2+ vezes.' },
  { role: 'user', text: 'Qual campanha tem melhor ROI?' },
  { role: 'sara', text: 'A campanha "Remarketing — Quem Visitou o Checkout" tem ROI de 4.8x, bem acima das demais. Seu custo por aquisição está em R$ 38, contra uma receita média de R$ 182 por cliente. Recomendo aumentar o budget dessa campanha em 30%.' },
]

// ── Knows everything grid ─────────────────────────────────────────────────────
const KNOWS = [
  'Funis', 'WhatsApp', 'Campanhas', 'Leads', 'Conversões', 'Produtos',
  'Vendas', 'Assinaturas', 'Cobranças', 'Dashboards', 'Integrações',
  'Automações', 'APIs', 'Webhooks', 'Banco de Dados', 'Eventos',
  'Histórico', 'Clientes', 'Performance', 'Relatórios',
]

// ── Animated chat bubble ──────────────────────────────────────────────────────
function ChatBubble({ msg, visible }: { msg: typeof CHAT_MESSAGES[0]; visible: boolean }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2.5 transition-all duration-500 ${isUser ? 'flex-row-reverse' : ''} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
        ${isUser
          ? 'bg-blue-600 text-white rounded-br-sm ml-auto'
          : 'bg-white/10 border border-white/10 text-blue-50 rounded-bl-sm backdrop-blur-sm'}`}>
        {!isUser && <p className="text-blue-300 text-[10px] font-bold uppercase tracking-wide mb-1">Sara.AI</p>}
        {msg.text}
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function SaraAISection() {
  const [visibleMessages, setVisibleMessages] = useState(0)

  // Animate chat messages in sequence
  useEffect(() => {
    if (visibleMessages >= CHAT_MESSAGES.length) return
    const delays = [0, 1200, 2600, 3800, 5200, 6400]
    const timer = setTimeout(() => setVisibleMessages(v => v + 1), delays[visibleMessages] ?? 1500)
    return () => clearTimeout(timer)
  }, [visibleMessages])

  return (
    <section className="relative bg-gradient-to-b from-gray-50 via-white to-gray-50 py-20 px-6 overflow-hidden">
      {/* Soft background glows — same style as ShowcaseSection */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-400/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto">

        {/* ── Section header ── */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 bg-white border border-gray-200 text-blue-700 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Desenvolvida exclusivamente para o FlowSara
          </span>
          <h2 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-4">
            Conheça a{' '}
            <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent">
              Sara.AI
            </span>
          </h2>
          <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Sua especialista em funis, vendas e crescimento. Ela entende seu negócio, acompanha seus dados em tempo real e transforma métricas em decisões estratégicas.
          </p>
        </div>

        {/* ── Feature cards grid ── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 hover:border-blue-200 transition-all duration-300"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.iconBg}`}>
                <f.icon className={`w-5 h-5 ${f.iconColor}`} />
              </div>
              <h3 className="text-gray-900 font-bold text-base mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Chat simulation — dark navy card, same identity as hero/showcase ── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h3 className="text-gray-900 text-2xl sm:text-3xl font-black mb-2">Converse com a Sara</h3>
            <p className="text-gray-500">Perguntas reais, respostas baseadas nos seus dados</p>
          </div>

          <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 rounded-2xl overflow-hidden ring-1 ring-gray-200 shadow-[0_20px_50px_-12px_rgba(30,64,175,0.35)]">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-300 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-blue-900" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Sara.AI</p>
                <p className="text-emerald-300 text-xs">Online · Analisando seus dados</p>
              </div>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-4 min-h-[280px]">
              {CHAT_MESSAGES.map((msg, i) => (
                <ChatBubble key={i} msg={msg} visible={i < visibleMessages} />
              ))}
            </div>

            {/* Fake input */}
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                <span className="text-blue-200/70 text-sm flex-1">Pergunte algo sobre seu funil…</span>
                <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sara knows everything ── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h3 className="text-gray-900 text-2xl sm:text-3xl font-black mb-2">A Sara conhece toda a sua operação</h3>
            <p className="text-gray-500">Ela tem acesso a todas as partes do FlowSara para responder com precisão</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
            {KNOWS.map(item => (
              <span
                key={item}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 text-sm shadow-sm hover:border-blue-300 hover:text-blue-700 hover:shadow transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── Differentiator quote ── */}
        <div className="mb-20 text-center">
          <blockquote className="max-w-3xl mx-auto bg-white border border-blue-100 rounded-2xl px-8 py-8 shadow-sm">
            <Sparkles className="w-8 h-8 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-800 text-lg sm:text-xl font-semibold leading-relaxed">
              "Enquanto outras IAs apenas respondem perguntas, a Sara.AI entende o funcionamento completo do FlowSara, analisa seus dados em tempo real e transforma informações em decisões estratégicas para o crescimento do seu negócio."
            </p>
          </blockquote>
        </div>

        {/* ── CTA — navy gradient, same identity as hero ── */}
        <div className="relative text-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 rounded-2xl px-6 py-12 overflow-hidden shadow-[0_20px_50px_-12px_rgba(30,64,175,0.4)]">
          <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative">
            <h3 className="text-white text-2xl sm:text-3xl font-black mb-3">Deixe a Sara trabalhar ao seu lado</h3>
            <p className="text-blue-200 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Transforme dados em decisões inteligentes, identifique oportunidades de crescimento e acompanhe seus funis com uma IA desenvolvida para aumentar seus resultados.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl transition">
                <Sparkles className="w-4 h-4" />
                Experimentar o FlowSara
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/register"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl border border-white/20 backdrop-blur-sm transition">
                Conhecer a Sara.AI
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <p className="text-blue-300/70 text-xs mt-4">7 dias grátis · Cancele quando quiser · Acesso imediato</p>
          </div>
        </div>

      </div>
    </section>
  )
}
