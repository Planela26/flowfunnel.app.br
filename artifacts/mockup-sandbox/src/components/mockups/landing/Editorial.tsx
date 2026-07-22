import { ArrowRight, Check, Zap, TrendingUp, Crown, MessageCircle, BarChart3, Bot, Activity, ShieldCheck, ChevronRight, Star, Quote } from 'lucide-react'
import { useState, useEffect } from 'react'

export function Editorial() {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleSections(new Set(['hero', 'quote', 'features', 'pricing']))
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const fadeIn = (section: string) => visibleSections.has(section) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* NAV - Minimal */}
      <nav className="sticky top-0 z-50 bg-[#fafaf9]/90 backdrop-blur-md border-b border-stone-200/50">
        <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center">
              <span className="text-white font-bold text-xs">FF</span>
            </div>
            <span className="text-base font-bold text-stone-900 tracking-tight">FlowFunnel</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-sm font-medium text-stone-500 hover:text-stone-900 transition">Entrar</button>
            <button className="text-sm font-bold bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-full transition">Começar</button>
          </div>
        </div>
      </nav>

      {/* HERO - Editorial grande */}
      <section className="max-w-6xl mx-auto px-8 pt-20 pb-16">
        <div className={`transition-all duration-1000 ease-out ${fadeIn('hero')}`}>
          {/* Overline */}
          <p className="text-xs font-bold text-stone-400 uppercase tracking-[0.3em] mb-8">
            Plataforma de inteligência de funil
          </p>

          {/* Título editorial */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-stone-900 leading-[0.95] mb-8 tracking-tight max-w-4xl">
            Descubra onde seus leads desistem — e como recuperá-los
          </h1>

          {/* Subtítulo */}
          <p className="text-xl text-stone-500 leading-relaxed max-w-2xl mb-10">
            Conecte WhatsApp, Facebook Ads, Hotmart, Kiwify e mais. Veja a jornada completa do lead em um único painel com análise por IA.
          </p>

          {/* CTA + Social proof lado a lado */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12">
            <button className="inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-bold px-8 py-4 rounded-full text-base transition">
              Começar 7 dias grátis <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 text-sm text-stone-500">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-stone-300 border-2 border-white flex items-center justify-center text-xs font-bold text-stone-600">
                    {String.fromCharCode(64+i)}
                  </div>
                ))}
              </div>
              <span>+1.200 produtores já usam</span>
            </div>
          </div>

          {/* Badge de plataformas */}
          <div className="flex flex-wrap gap-2">
            {['WhatsApp','Facebook Ads','Hotmart','Kiwify','Eduzz','Monetizze'].map(p => (
              <span key={p} className="text-xs font-semibold text-stone-400 px-3 py-1.5 rounded-full bg-white border border-stone-200">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW - Full width */}
      <section className="px-6 pb-20">
        <div className={`max-w-6xl mx-auto transition-all duration-1000 delay-300 ease-out ${fadeIn('hero')}`}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-stone-300/50 border border-stone-200">
            <img 
              src="/__mockup/images/dashboard-preview.png" 
              alt="FlowFunnel Dashboard"
              className="w-full h-auto"
            />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-stone-900/60 to-transparent" />
            <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between">
              <div>
                <p className="text-white font-bold text-lg">Painel unificado</p>
                <p className="text-white/70 text-sm">Todas as suas plataformas em um lugar</p>
              </div>
              <button className="bg-white hover:bg-white/90 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition flex items-center gap-2">
                <Play className="w-4 h-4" /> Ver demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL - Quote editorial */}
      <section className="py-20 px-6 bg-white">
        <div className={`max-w-4xl mx-auto text-center transition-all duration-1000 delay-500 ease-out ${fadeIn('quote')}`}>
          <Quote className="w-10 h-10 text-stone-300 mx-auto mb-6" />
          <blockquote className="text-2xl sm:text-3xl font-medium text-stone-800 leading-relaxed mb-8">
            "Descobrimos que 40% dos nossos leads abandonavam no WhatsApp. Com o FlowFunnel, recuperamos R$ 12 mil em vendas no primeiro mês."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-stone-300 flex items-center justify-center text-sm font-bold text-stone-600">G</div>
            <div className="text-left">
              <p className="text-sm font-bold text-stone-900">Gabriel Souza</p>
              <p className="text-xs text-stone-400">Produtor digital, 3 funis ativos</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES - Editorial grid com números */}
      <section className="py-24 px-6">
        <div className={`max-w-6xl mx-auto transition-all duration-1000 delay-700 ease-out ${fadeIn('features')}`}>
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-[0.3em]">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 mt-4">Como o FlowFunnel funciona</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { num: '01', icon: <MessageCircle className="w-5 h-5" />, title: 'Rastreamento WhatsApp', desc: 'Cada conversa é rastreada até a origem da campanha. Saiba qual anúncio gerou cada lead.' },
              { num: '02', icon: <BarChart3 className="w-5 h-5" />, title: 'Dashboard Unificado', desc: 'Conversões, gargalos e taxa de abandono em um único painel visual e em tempo real.' },
              { num: '03', icon: <Bot className="w-5 h-5" />, title: 'IA Diagnóstica', desc: 'Algoritmo detecta automaticamente onde leads desistem e sugere ações para recuperá-los.' },
              { num: '04', icon: <TrendingUp className="w-5 h-5" />, title: 'Comparação de Períodos', desc: 'Compare semanas, meses e campanhas. Veja o que melhorou de um olhar.' },
              { num: '05', icon: <Activity className="w-5 h-5" />, title: 'Alertas Inteligentes', desc: 'Receba notificações quando métricas críticas mudam — sem ficar olhando o painel.' },
              { num: '06', icon: <ShieldCheck className="w-5 h-5" />, title: 'Segurança Total', desc: 'Dados criptografados e isolados por conta. Ninguém vê o que é seu.' },
            ].map((f) => (
              <div key={f.title} className="group">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-black text-stone-300">{f.num}</span>
                  <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 group-hover:bg-stone-900 group-hover:text-white transition-all duration-300">
                    {f.icon}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">{f.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM/SOLUTION - Split com stats */}
      <section className="py-24 px-6 bg-stone-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold text-stone-500 uppercase tracking-[0.3em]">O problema</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-4 mb-6">
                Você investe em anúncios, mas não sabe o que acontece depois
              </h2>
              <div className="space-y-4">
                {[
                  'Cada plataforma te mostra só um pedaço dos dados',
                  'Você toma decisões no escuro, sem visibilidade do funil',
                  'Dinheiro escorre pelo ralo enquanto concorrentes escalam',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs flex-shrink-0 mt-0.5">✕</span>
                    <p className="text-stone-400 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '40%', label: 'de leads perdidos recuperáveis' },
                { value: '1.200+', label: 'produtores usando' },
                { value: 'R$ 12k', label: 'média recuperada no 1º mês' },
                { value: '6', label: 'plataformas integradas' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                  <p className="text-2xl sm:text-3xl font-black text-white mb-1">{stat.value}</p>
                  <p className="text-xs text-stone-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING - Minimal */}
      <section className="py-24 px-6">
        <div className={`max-w-6xl mx-auto transition-all duration-1000 delay-500 ease-out ${fadeIn('pricing')}`}>
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-[0.3em]">Preços</span>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 mt-4">7 dias grátis em qualquer plano</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'START', price: '97', desc: 'Para quem está começando', features: ['Análise por IA','1.000 conversas/mês','1 WhatsApp','1 funil'], color: 'border-stone-200', cta: 'bg-stone-900 hover:bg-stone-800 text-white' },
              { name: 'PRO', price: '147', desc: 'Mais popular', features: ['Análise completa','3.000 conversas/mês','Diagnóstico IA','3 WhatsApps','3 funis','Comparação'], color: 'border-stone-900 bg-stone-900', cta: 'bg-white hover:bg-stone-100 text-stone-900', featured: true },
              { name: 'SCALE', price: '297', desc: 'Para agências', features: ['IA avançada','Conversas ilimitadas','WhatsApps ilimitados','Funis ilimitados','365 dias histórico'], color: 'border-stone-200', cta: 'bg-stone-900 hover:bg-stone-800 text-white' },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-2xl border-2 ${plan.color} p-8 ${plan.featured ? 'shadow-2xl' : 'hover:shadow-xl'} transition-all duration-300`}>
                {plan.featured && <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">Mais Popular</p>}
                <h3 className={`text-2xl font-black mb-1 ${plan.featured ? 'text-white' : 'text-stone-900'}`}>{plan.name}</h3>
                <p className={`text-sm mb-6 ${plan.featured ? 'text-stone-400' : 'text-stone-400'}`}>{plan.desc}</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm ${plan.featured ? 'text-stone-400' : 'text-stone-400'}`}>R$</span>
                    <span className={`text-5xl font-black ${plan.featured ? 'text-white' : 'text-stone-900'}`}>{plan.price}</span>
                  </div>
                  <span className={`text-xs ${plan.featured ? 'text-stone-400' : 'text-stone-400'}`}>/mês</span>
                </div>
                <button className={`w-full py-3 rounded-xl text-sm font-bold text-center transition mb-6 ${plan.cta}`}>Testar grátis</button>
                <div className="space-y-2.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <Check className={`w-3.5 h-3.5 flex-shrink-0 ${plan.featured ? 'text-stone-300' : 'text-emerald-500'}`} />
                      <span className={`text-sm ${plan.featured ? 'text-stone-300' : 'text-stone-600'}`}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Final editorial */}
      <section className="py-24 px-6 bg-stone-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">Pronto para recuperar vendas perdidas?</h2>
          <p className="text-stone-400 text-lg mb-10">7 dias grátis. Sem cartão. Suporte humano.</p>
          <button className="inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-stone-900 font-bold px-10 py-4 rounded-full text-base transition">
            Começar grátis agora <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* FOOTER - Minimal */}
      <footer className="bg-[#fafaf9] border-t border-stone-200 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center">
              <span className="text-white font-bold text-xs">FF</span>
            </div>
            <span className="text-stone-900 font-bold text-sm">FlowFunnel</span>
          </div>
          <div className="flex gap-8 text-sm text-stone-400">
            <span className="hover:text-stone-600 cursor-pointer transition">Termos</span>
            <span className="hover:text-stone-600 cursor-pointer transition">Privacidade</span>
            <span className="hover:text-stone-600 cursor-pointer transition">Contato</span>
          </div>
          <p className="text-stone-300 text-xs">© 2025 FlowFunnel</p>
        </div>
      </footer>
    </div>
  )
}

function Play({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
