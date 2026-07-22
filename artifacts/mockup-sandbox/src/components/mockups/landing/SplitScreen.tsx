import { ArrowRight, Check, Zap, TrendingUp, Crown, MessageCircle, BarChart3, Bot, Activity, ShieldCheck, ChevronRight, Play, Pause } from 'lucide-react'
import { useState, useEffect } from 'react'

export function SplitScreen() {
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          setTimeout(() => setLoading(false), 300)
          return 100
        }
        return p + 2
      })
    }, 50)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-xl">FF</span>
        </div>
        <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-slate-500 text-sm">{progress < 100 ? 'Carregando painel...' : 'Quase pronto...'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">FF</span>
            </div>
            <span className="text-lg font-bold text-gray-900">FlowFunnel</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition">Entrar</button>
            <button className="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition">Começar Grátis</button>
          </div>
        </div>
      </nav>

      {/* HERO - Split Screen */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* LEFT: Texto */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              +1.200 produtores já usam
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.08] mb-6 tracking-tight">
              Veja exatamente onde seus leads desistem no funil
            </h1>

            <p className="text-gray-500 text-lg leading-relaxed mb-8">
              Conecte WhatsApp, Facebook Ads, Hotmart, Kiwify e mais — tudo em um painel. A IA identifica gargalos e sugere como recuperar vendas perdidas.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <button className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3.5 rounded-xl text-sm shadow-lg transition">
                Começar 7 dias grátis <ArrowRight className="w-4 h-4" />
              </button>
              <button className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3.5 rounded-xl text-sm transition">
                <Play className="w-4 h-4" /> Ver demo
              </button>
            </div>

            <div className="flex items-center gap-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Sem cartão</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Cancele quando quiser</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> PIX/Boleto/Cartão</span>
            </div>
          </div>

          {/* RIGHT: Screenshot do produto */}
          <div className="order-1 lg:order-2 relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-indigo-200/30 to-violet-200/30 rounded-3xl blur-2xl" />
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
              <img 
                src="/__mockup/images/dashboard-preview.png" 
                alt="FlowFunnel Dashboard Preview"
                className="w-full h-auto"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/80 to-transparent h-24" />
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR - Horizontal */}
      <section className="border-y border-gray-100 bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Integrações nativas</p>
          <div className="flex justify-center items-center gap-8 flex-wrap">
            {['Meta','WhatsApp','Hotmart','Eduzz','Monetizze','Kiwify'].map((brand) => (
              <span key={brand} className="text-gray-400 font-bold text-sm">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEMA - Timeline vertical */}
      <section className="py-24 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-white/5 border border-white/10 text-orange-400 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">⚠️ O problema</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-6">Você investe em anúncios, mas não sabe o que acontece depois</h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 to-rose-500" />
            
            {[
              { icon: '📊', title: 'Facebook Ads', desc: 'Você vê cliques e CPM — mas não sabe se virou conversa, lead ou venda.', num: '01' },
              { icon: '💬', title: 'WhatsApp', desc: 'As conversas chegam, mas você não sabe de qual campanha vieram.', num: '02' },
              { icon: '💳', title: 'Hotmart / Checkout', desc: 'A venda foi confirmada — mas qual anúncio gerou? Você não sabe.', num: '03' },
            ].map((item) => (
              <div key={item.title} className="relative flex items-start gap-8 mb-12 last:mb-0 pl-2">
                <div className="relative z-10 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20 flex-shrink-0">
                  {item.icon}
                </div>
                <div className="pt-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-black text-orange-500">{item.num}</span>
                    <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÃO - Cards com hover reveal */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider border border-indigo-100">✨ Como resolvemos</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-6 max-w-2xl mx-auto">Um painel unificado para todas as suas plataformas</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <MessageCircle className="w-6 h-6" />, title: 'Rastreamento WhatsApp', desc: 'Cada conversa rastreada até a origem da campanha. Saiba qual anúncio gerou cada lead.' },
              { icon: <BarChart3 className="w-6 h-6" />, title: 'Dashboard Unificado', desc: 'Conversões, gargalos e taxa de abandono em um único painel visual e em tempo real.' },
              { icon: <Bot className="w-6 h-6" />, title: 'IA Diagnóstica', desc: 'Algoritmo detecta automaticamente onde leads desistem e sugere ações para recuperá-los.' },
              { icon: <TrendingUp className="w-6 h-6" />, title: 'Comparação de Períodos', desc: 'Compare semanas, meses e campanhas. Veja o que melhorou de um olhar.' },
              { icon: <Activity className="w-6 h-6" />, title: 'Alertas Inteligentes', desc: 'Receba notificações quando métricas críticas mudam — sem ficar olhando o painel.' },
              { icon: <ShieldCheck className="w-6 h-6" />, title: 'Segurança Total', desc: 'Dados criptografados e isolados por conta. Ninguém vê o que é seu.' },
            ].map((f) => (
              <div key={f.title} className="group relative bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-violet-500/0 group-hover:from-indigo-500/5 group-hover:to-violet-500/5 transition-all duration-300" />
                <div className="relative w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-5 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-indigo-700 transition-colors">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS - Horizontal scroll cards */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-white border border-gray-200 text-indigo-600 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-sm">Preços</span>
            <h2 className="mt-6 text-3xl sm:text-4xl font-black text-gray-900">7 dias grátis em qualquer plano</h2>
            <p className="mt-3 text-gray-500">Teste sem custo. Cancele quando quiser.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* START */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Essencial</span>
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-1">START</h3>
              <p className="text-sm text-gray-400 mb-6">Para quem está começando</p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-gray-400">R$</span>
                  <span className="text-5xl font-black text-gray-900">97</span>
                </div>
                <span className="text-xs text-gray-400">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-gray-900 hover:bg-gray-800 text-white transition mb-6">Testar grátis</button>
              <div className="space-y-3 flex-1">
                {['Análise por IA do funil','Até 1.000 conversas/mês','1 número WhatsApp','1 funil ativo'].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PRO */}
            <div className="bg-gradient-to-b from-indigo-600 to-violet-700 rounded-2xl p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-white">Popular</span>
                  <TrendingUp className="w-5 h-5 text-indigo-300" />
                </div>
                <h3 className="text-2xl font-black text-white mb-1">PRO</h3>
                <p className="text-sm text-indigo-200 mb-6">Para quem anuncia todo dia</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-indigo-300">R$</span>
                    <span className="text-5xl font-black text-white">147</span>
                  </div>
                  <span className="text-xs text-indigo-300">/mês</span>
                </div>
                <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-white hover:bg-indigo-50 text-indigo-600 transition mb-6 shadow-lg">Testar grátis</button>
                <div className="space-y-3 flex-1">
                  {['Análise completa por IA','Até 3.000 conversas/mês','Diagnóstico + sugestões','Até 3 WhatsApps','Até 3 funis','Comparação de períodos'].map((f) => (
                    <div key={f} className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-white flex-shrink-0" />
                      <span className="text-sm text-white">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SCALE */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-50 text-purple-600 border border-purple-100">IA Avançada</span>
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-1">SCALE</h3>
              <p className="text-sm text-gray-400 mb-6">Para agências</p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-gray-400">R$</span>
                  <span className="text-5xl font-black text-gray-900">297</span>
                </div>
                <span className="text-xs text-gray-400">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-gray-900 hover:bg-gray-800 text-white transition mb-6">Testar grátis</button>
              <div className="space-y-3 flex-1">
                {['IA avançada completa','Conversas ilimitadas','WhatsApps ilimitados','Funis ilimitados','Histórico 365 dias'].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - Simples */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Pare de perder vendas no escuro.</h2>
          <p className="text-gray-400 text-lg mb-8">7 dias grátis. Sem cartão. Cancele quando quiser.</p>
          <button className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg transition">
            Começar grátis agora <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">FF</span>
            </div>
            <span className="text-gray-900 font-bold text-sm">FlowFunnel</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <span className="hover:text-gray-600 cursor-pointer transition">Termos</span>
            <span className="hover:text-gray-600 cursor-pointer transition">Privacidade</span>
            <span className="hover:text-gray-600 cursor-pointer transition">Contato</span>
          </div>
          <p className="text-gray-300 text-xs">© 2025 FlowFunnel</p>
        </div>
      </footer>
    </div>
  )
}
