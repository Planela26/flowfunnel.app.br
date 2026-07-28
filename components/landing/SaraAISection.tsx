'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, TrendingUp, AlertTriangle, BarChart2, MessageCircle,
  Zap, Brain, Target, ShoppingCart, CheckCircle2, ChevronRight,
} from 'lucide-react'

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Analisa seus funis automaticamente',
    desc: 'Acompanha cada etapa e identifica os gargalos que reduzem suas conversões — sem você precisar pedir.',
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: AlertTriangle,
    title: 'Detecta problemas antes de você',
    desc: 'Falhas em webhooks, integrações quebradas, APIs com timeout, pagamentos com erro — Sara.AI avisa primeiro.',
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
    iconColor: 'text-orange-400',
  },
  {
    icon: BarChart2,
    title: 'Interpreta métricas em linguagem simples',
    desc: 'Não apenas exibe números. Explica o que cada métrica significa e o que você deve fazer com ela.',
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: Target,
    title: 'Identifica oportunidades de vendas',
    desc: 'Encontra onde seus leads abandonam o processo e recomenda ações específicas para recuperá-los.',
    color: 'from-green-500/20 to-green-600/10 border-green-500/20',
    iconColor: 'text-green-400',
  },
  {
    icon: Brain,
    title: 'Especialista em marketing digital',
    desc: 'Funis, tráfego pago, ROI, CAC, LTV, copywriting, lançamentos, perpétuo, WhatsApp Marketing e muito mais.',
    color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
  {
    icon: Zap,
    title: 'Recomenda ações inteligentes',
    desc: 'Sugere melhorias para campanhas, funis, páginas e processos com base nos seus dados reais.',
    color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20',
    iconColor: 'text-yellow-400',
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
        ${isUser
          ? 'bg-blue-600 text-white rounded-br-sm ml-auto'
          : 'bg-gray-800/80 border border-gray-700/50 text-gray-200 rounded-bl-sm'}`}>
        {!isUser && <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wide mb-1">Sara.AI</p>}
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
    <section className="relative py-24 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">

        {/* ── Section header ── */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Desenvolvida exclusivamente para o FlowSara
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Conheça a <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Sara.AI</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Sua especialista em funis, vendas e crescimento. Ela entende seu negócio, acompanha seus dados em tempo real e transforma métricas em decisões estratégicas.
          </p>
        </div>

        {/* ── Feature cards grid ── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-20">
          {FEATURES.map((f, i) => (
            <div key={i} className={`bg-gradient-to-br ${f.color} border rounded-2xl p-6 hover:scale-[1.02] transition-transform duration-300`}>
              <f.icon className={`w-6 h-6 ${f.iconColor} mb-3`} />
              <h3 className="text-white font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Chat simulation ── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h3 className="text-white text-3xl font-bold mb-2">Converse com a Sara</h3>
            <p className="text-gray-400">Perguntas reais, respostas baseadas nos seus dados</p>
          </div>

          <div className="max-w-2xl mx-auto bg-gray-900/60 border border-gray-700/60 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700/60 bg-gradient-to-r from-blue-900/40 to-gray-900">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-gray-900" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Sara.AI</p>
                <p className="text-emerald-400 text-xs">Online · Analisando seus dados</p>
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
              <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5">
                <span className="text-gray-500 text-sm flex-1">Pergunte algo sobre seu funil…</span>
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center opacity-50">
                  <MessageCircle className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sara knows everything ── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h3 className="text-white text-3xl font-bold mb-2">A Sara conhece toda a sua operação</h3>
            <p className="text-gray-400">Ela tem acesso a todas as partes do FlowSara para responder com precisão</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
            {KNOWS.map(item => (
              <span key={item} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-800/80 border border-gray-700 text-gray-300 text-sm hover:border-blue-500/50 hover:text-white transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── Differentiator quote ── */}
        <div className="mb-20 text-center">
          <blockquote className="max-w-3xl mx-auto bg-gradient-to-br from-blue-950/60 to-purple-950/40 border border-blue-500/20 rounded-2xl px-8 py-8">
            <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-4" />
            <p className="text-white text-xl font-medium leading-relaxed">
              "Enquanto outras IAs apenas respondem perguntas, a Sara.AI entende o funcionamento completo do FlowSara, analisa seus dados em tempo real e transforma informações em decisões estratégicas para o crescimento do seu negócio."
            </p>
          </blockquote>
        </div>

        {/* ── CTA ── */}
        <div className="text-center bg-gradient-to-br from-blue-900/40 to-purple-900/20 border border-blue-500/20 rounded-2xl px-6 py-12">
          <h3 className="text-white text-3xl font-bold mb-3">Deixe a Sara trabalhar ao seu lado</h3>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            Transforme dados em decisões inteligentes, identifique oportunidades de crescimento e acompanhe seus funis com uma IA desenvolvida para aumentar seus resultados.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all hover:scale-105 shadow-lg shadow-blue-500/30">
              <Sparkles className="w-4 h-4" />
              Experimentar o FlowSara
            </Link>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-gray-600 hover:border-blue-500 text-gray-300 hover:text-white font-semibold transition-all">
              Conhecer a Sara.AI
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}
