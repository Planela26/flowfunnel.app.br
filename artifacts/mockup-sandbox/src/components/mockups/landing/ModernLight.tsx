import { ArrowRight, Check, Zap, TrendingUp, Crown, MessageCircle, BarChart3, Bot, Activity, ShieldCheck, ChevronRight } from 'lucide-react'

export function ModernLight() {
  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <span className="text-white font-bold text-sm">FF</span>
            </div>
            <span className="text-lg font-bold text-slate-900">FlowFunnel</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-50 transition">Entrar</button>
            <button className="text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg transition">Começar Grátis</button>
          </div>
        </div>
      </nav>

      {/* HERO - Minimalista */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.08),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.05),_transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            WhatsApp · Facebook Ads · Hotmart · Kiwify · Eduzz · Monetizze
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.05] mb-6 tracking-tight">
            Descubra exatamente onde<br />
            <span className="text-indigo-600">você perde vendas</span>
          </h1>

          <p className="text-slate-500 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            Conecte suas plataformas e veja em tempo real onde seus leads desistem — com uma IA que identifica gargalos e sugere como aumentar sua conversão.
          </p>

          <p className="text-emerald-600 text-sm font-semibold mb-8">
            +1.200 produtores e gestores já usam para escalar vendas
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <button className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-indigo-200 transition">
              Ver onde estou perdendo vendas <ArrowRight className="w-5 h-5" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-8 py-4 rounded-xl text-base transition">
              Já tenho conta <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-400 text-xs">7 dias grátis · Cancele quando quiser · Acesso imediato</p>
        </div>
      </section>

      {/* PLANOS - Minimal */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-white border border-slate-200 text-indigo-600 text-xs font-bold px-4 py-2 rounded-full shadow-sm uppercase tracking-wider">Escolha o plano</span>
            <h2 className="mt-6 text-4xl sm:text-5xl font-black text-slate-900">7 dias grátis em qualquer plano</h2>
            <p className="mt-3 text-slate-500">Teste sem custo e cancele quando quiser.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* START */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">Essencial</span>
                <Zap className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">START</h3>
              <p className="text-sm text-slate-400 mb-6">Para quem está começando</p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-slate-400">R$</span>
                  <span className="text-5xl font-black text-slate-900">97</span>
                </div>
                <span className="text-xs text-slate-400">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-slate-900 hover:bg-slate-800 text-white transition mb-2">Testar grátis 7 dias</button>
              <div className="space-y-3 mt-6">
                {['Análise por IA do funil','Até 1.000 conversas/mês','1 número WhatsApp','1 funil ativo'].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PRO - Destaque */}
            <div className="bg-indigo-600 rounded-2xl p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full -translate-y-16 translate-x-16 opacity-50" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
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
                <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-white hover:bg-indigo-50 text-indigo-600 transition mb-2">Testar grátis 7 dias</button>
                <div className="space-y-3 mt-6">
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
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">IA Avançada</span>
                <Crown className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">SCALE</h3>
              <p className="text-sm text-slate-400 mb-6">Para agências e grandes operações</p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-slate-400">R$</span>
                  <span className="text-5xl font-black text-slate-900">297</span>
                </div>
                <span className="text-xs text-slate-400">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-slate-900 hover:bg-slate-800 text-white transition mb-2">Testar grátis 7 dias</button>
              <div className="space-y-3 mt-6">
                {['IA avançada completa','Conversas ilimitadas','WhatsApps ilimitados','Funis ilimitados','Histórico 365 dias','Comparação de períodos'].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CARROSSEL MARCAS */}
      <section className="bg-white py-16 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 text-center mb-8">
          <p className="text-lg font-bold uppercase tracking-[0.2em] text-slate-400">Integrações nativas</p>
        </div>
        <div className="flex justify-center gap-6 flex-wrap px-6">
          {['Meta','WhatsApp','Hotmart','Eduzz','Monetizze','Kiwify'].map((brand) => (
            <div key={brand} className="px-6 py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-sm font-semibold">{brand}</div>
          ))}
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="bg-slate-900 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-slate-800 border border-slate-700 text-slate-300 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">⚠️ O problema</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mt-6 leading-tight">
              Você investe em anúncios,<br />
              <span className="text-indigo-400">mas não sabe o que acontece depois.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '📊', title: 'Facebook Ads', desc: 'Você vê cliques e CPM — mas não sabe se virou conversa, lead ou venda.' },
              { icon: '💬', title: 'WhatsApp', desc: 'As conversas chegam, mas você não sabe de qual campanha vieram.' },
              { icon: '💳', title: 'Hotmart', desc: 'A venda foi confirmada — mas qual anúncio gerou? Você não sabe.' },
            ].map((c) => (
              <div key={c.title} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:bg-slate-800 transition">
                <span className="text-3xl mb-4 block">{c.icon}</span>
                <h3 className="text-lg font-bold text-white mb-3">{c.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">✨ A solução</span>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mt-6">Um painel. Todas as plataformas. Decisões inteligentes.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <MessageCircle className="w-5 h-5" />, title: 'Rastreamento WhatsApp', desc: 'Cada conversa rastreada até a origem da campanha.', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Dashboard real-time', desc: 'Acompanhe conversões e gargalos em um painel unificado.', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
              { icon: <Bot className="w-5 h-5" />, title: 'IA inteligente', desc: 'Detecta onde leads desistem e sugere ações.', color: 'bg-violet-50 text-violet-600 border-violet-100' },
              { icon: <TrendingUp className="w-5 h-5" />, title: 'Comparação de períodos', desc: 'Compare semanas, meses e campanhas.', color: 'bg-blue-50 text-blue-600 border-blue-100' },
              { icon: <Activity className="w-5 h-5" />, title: 'Alertas inteligentes', desc: 'Receba notificações quando métricas críticas mudam.', color: 'bg-amber-50 text-amber-600 border-amber-100' },
              { icon: <ShieldCheck className="w-5 h-5" />, title: '100% seguro', desc: 'Dados criptografados e isolados por conta.', color: 'bg-rose-50 text-rose-600 border-rose-100' },
            ].map((f) => (
              <div key={f.title} className="group bg-white border border-slate-100 rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className={`w-11 h-11 rounded-xl ${f.color} border flex items-center justify-center mb-4`}>{f.icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">Pare de perder vendas no escuro.</h2>
          <p className="text-slate-400 text-lg mb-10">Teste 7 dias grátis. Veja onde seus leads desistem.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg transition">
              Começar grátis 7 dias <ArrowRight className="w-5 h-5" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-8 py-4 rounded-xl text-base transition">
              Já tenho conta <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <span className="text-white font-bold text-xs">FF</span>
            </div>
            <span className="text-slate-900 font-bold text-sm">FlowFunnel</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <span className="hover:text-slate-600 cursor-pointer">Termos</span>
            <span className="hover:text-slate-600 cursor-pointer">Privacidade</span>
            <span className="hover:text-slate-600 cursor-pointer">Contato</span>
          </div>
          <p className="text-slate-300 text-xs">© 2025 FlowFunnel</p>
        </div>
      </footer>
    </div>
  )
}
