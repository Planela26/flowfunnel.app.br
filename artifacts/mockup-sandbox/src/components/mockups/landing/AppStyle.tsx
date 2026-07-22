import { ArrowRight, Check, Zap, TrendingUp, Crown, MessageCircle, BarChart3, Bot, Activity, ShieldCheck, ChevronRight, Menu, X, Sparkles, Play } from 'lucide-react'
import { useState, useEffect } from 'react'

export function AppStyle() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setDots(d => (d + 1) % 4), 400)
    const timer = setTimeout(() => {
      clearInterval(interval)
      setLoading(false)
    }, 2000)
    return () => { clearInterval(interval); clearTimeout(timer) }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex flex-col items-center justify-center gap-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center animate-pulse shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -inset-2 bg-indigo-500/20 rounded-2xl blur-xl animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-white/60 text-sm font-medium">Inicializando FlowFunnel</p>
          <p className="text-white/30 text-xs mt-1">{'Carregando'.padEnd(11 + dots, '.')}</p>
        </div>
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-[shimmer_2s_infinite]" 
               style={{ width: '60%', animation: 'shimmer 2s infinite linear' }} />
        </div>
        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* MOBILE MENU OVERLAY */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <span className="text-lg font-bold text-slate-900">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="space-y-1">
              {['Entrar','Começar Grátis','Preços','Funcionalidades','Suporte'].map(item => (
                <button key={item} className="w-full text-left px-4 py-3 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NAV - App style com blur */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-slate-900">FlowFunnel</span>
          </div>
          
          {/* Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <button className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-xl hover:bg-slate-50 transition">Entrar</button>
            <button className="text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl transition">Começar Grátis</button>
          </div>
          
          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(true)} className="md:hidden w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </nav>

      {/* HERO - App-style com floating elements */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pt-12 pb-20">
        <div className="absolute top-20 right-10 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-10 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-5 gap-8 items-center">
            {/* Texto - 3 cols */}
            <div className="lg:col-span-3">
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2 rounded-full mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                +1.200 produtores já usam
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.05] mb-6 tracking-tight">
                Veja onde seus leads desistem — e como recuperá-los
              </h1>

              <p className="text-slate-500 text-lg leading-relaxed mb-8 max-w-lg">
                Conecte WhatsApp, Facebook Ads, Hotmart e mais. A IA identifica gargalos e sugere ações para aumentar sua conversão.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3.5 rounded-xl text-sm shadow-lg transition">
                  Começar 7 dias grátis <ArrowRight className="w-4 h-4" />
                </button>
                <button className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3.5 rounded-xl text-sm border border-slate-200 transition">
                  <Play className="w-4 h-4" /> Ver demo (2min)
                </button>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-500" /> Sem cartão</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-500" /> Cancele quando quiser</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-500" /> PIX/Boleto/Cartão</span>
              </div>
            </div>

            {/* Visual - 2 cols com floating cards */}
            <div className="lg:col-span-2 relative">
              <div className="relative">
                <img 
                  src="/__mockup/images/dashboard-preview.png" 
                  alt="Dashboard"
                  className="w-full rounded-2xl shadow-2xl border border-slate-200"
                />
                {/* Floating card */}
                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-48 animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Vendas</span>
                  </div>
                  <p className="text-xl font-black text-slate-900">R$ 4.230</p>
                  <p className="text-xs text-emerald-600">+12% essa semana</p>
                </div>
                {/* Another floating card */}
                <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl border border-slate-100 p-3 w-40 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                  <p className="text-xs text-slate-500">Conversão</p>
                  <p className="text-lg font-black text-slate-900">23.4%</p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                    <div className="w-3/4 h-full bg-indigo-500 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRAÇÕES - Horizontal scroll pills */}
      <section className="bg-slate-50 border-y border-slate-100 py-6 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Integrações nativas</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide justify-center flex-wrap">
            {['Meta','WhatsApp','Hotmart','Eduzz','Monetizze','Kiwify','Instagram'].map((brand) => (
              <div key={brand} className="flex-shrink-0 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-sm font-semibold text-slate-600 shadow-sm">
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM - Cards com gradient border */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-bold px-4 py-2 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              O problema que resolvemos
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 max-w-2xl mx-auto">
              Cada plataforma mostra um pedaço. Você não vê o funil inteiro.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: '📊', title: 'Facebook Ads', desc: 'Você vê cliques e CPM — mas não sabe se virou conversa, lead ou venda.', border: 'from-blue-500 to-blue-300' },
              { icon: '💬', title: 'WhatsApp', desc: 'As conversas chegam, mas você não sabe de qual campanha vieram.', border: 'from-green-500 to-green-300' },
              { icon: '💳', title: 'Hotmart', desc: 'A venda foi confirmada — mas qual anúncio gerou? Você não sabe.', border: 'from-orange-500 to-orange-300' },
            ].map((c) => (
              <div key={c.title} className="relative bg-white rounded-2xl p-1">
                <div className={`absolute inset-0 bg-gradient-to-br ${c.border} rounded-2xl opacity-20`} />
                <div className="relative bg-white rounded-xl p-6 h-full">
                  <span className="text-3xl mb-3 block">{c.icon}</span>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{c.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES - Grid com icon hover */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-4">Um painel. Todas as plataformas.</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <MessageCircle className="w-5 h-5" />, title: 'Rastreamento WhatsApp', desc: 'Rastreie cada conversa até a origem da campanha.', color: 'bg-emerald-50 text-emerald-600' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Dashboard Real-time', desc: 'Conversões e gargalos em um painel unificado.', color: 'bg-indigo-50 text-indigo-600' },
              { icon: <Bot className="w-5 h-5" />, title: 'IA Diagnóstica', desc: 'Detecta onde leads desistem e sugere ações.', color: 'bg-violet-50 text-violet-600' },
              { icon: <TrendingUp className="w-5 h-5" />, title: 'Comparação', desc: 'Compare semanas, meses e campanhas.', color: 'bg-blue-50 text-blue-600' },
              { icon: <Activity className="w-5 h-5" />, title: 'Alertas', desc: 'Notificações quando métricas mudam.', color: 'bg-amber-50 text-amber-600' },
              { icon: <ShieldCheck className="w-5 h-5" />, title: 'Segurança', desc: 'Dados criptografados e isolados.', color: 'bg-rose-50 text-rose-600' },
            ].map((f) => (
              <div key={f.title} className="group bg-white rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-slate-100">
                <div className={`w-10 h-10 rounded-lg ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING - Cards com sticky highlight */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">Preços</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-4">7 dias grátis em qualquer plano</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* START */}
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-8 hover:border-slate-300 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">Essencial</span>
                <Zap className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">START</h3>
              <p className="text-sm text-slate-400 mb-6">Para quem está começando</p>
              <div className="mb-6">
                <span className="text-sm text-slate-400">R$</span>
                <span className="text-5xl font-black text-slate-900 ml-1">97</span>
                <span className="text-xs text-slate-400">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-slate-900 hover:bg-slate-800 text-white transition mb-6">Testar grátis</button>
              <div className="space-y-2.5">
                {['Análise por IA','1.000 conversas/mês','1 WhatsApp','1 funil'].map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PRO - Destaque sticky */}
            <div className="bg-gradient-to-b from-indigo-600 to-violet-700 rounded-2xl p-8 shadow-2xl shadow-indigo-200 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute top-4 right-4">
                <span className="text-xs font-bold bg-white/20 text-white px-3 py-1 rounded-full">Popular</span>
              </div>
              <div className="flex items-center justify-between mb-5 mt-2">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-white">Recomendado</span>
                <TrendingUp className="w-5 h-5 text-indigo-300" />
              </div>
              <h3 className="text-2xl font-black text-white mb-1">PRO</h3>
              <p className="text-sm text-indigo-200 mb-6">Para quem anuncia todo dia</p>
              <div className="mb-6">
                <span className="text-sm text-indigo-300">R$</span>
                <span className="text-5xl font-black text-white ml-1">147</span>
                <span className="text-xs text-indigo-300">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-white hover:bg-indigo-50 text-indigo-600 transition mb-6 shadow-lg">Testar grátis</button>
              <div className="space-y-2.5">
                {['Análise completa','3.000 conversas/mês','Diagnóstico IA','3 WhatsApps','3 funis','Comparação'].map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span className="text-sm text-white">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SCALE */}
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-8 hover:border-slate-300 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-50 text-purple-600">IA Avançada</span>
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">SCALE</h3>
              <p className="text-sm text-slate-400 mb-6">Para agências</p>
              <div className="mb-6">
                <span className="text-sm text-slate-400">R$</span>
                <span className="text-5xl font-black text-slate-900 ml-1">297</span>
                <span className="text-xs text-slate-400">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-slate-900 hover:bg-slate-800 text-white transition mb-6">Testar grátis</button>
              <div className="space-y-2.5">
                {['IA avançada','Conversas ilimitadas','WhatsApps ilimitados','Funis ilimitados','365 dias'].map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - App style bottom sheet feel */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Pare de perder vendas no escuro.</h2>
          <p className="text-slate-400 text-lg mb-8">7 dias grátis. Sem cartão. Cancele quando quiser.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-bold px-8 py-4 rounded-xl text-base shadow-xl transition">
              Começar grátis agora <ArrowRight className="w-5 h-5" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-xl text-base border border-white/10 transition">
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER - App tabs style */}
      <footer className="bg-white border-t border-slate-100 py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-900 font-bold text-sm">FlowFunnel</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-400">
              <span className="hover:text-slate-600 cursor-pointer">Termos</span>
              <span className="hover:text-slate-600 cursor-pointer">Privacidade</span>
              <span className="hover:text-slate-600 cursor-pointer">Suporte</span>
            </div>
            <p className="text-slate-300 text-xs">© 2025</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
