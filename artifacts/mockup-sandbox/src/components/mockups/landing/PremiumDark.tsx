import { ArrowRight, Check, Zap, TrendingUp, Crown, MessageCircle, BarChart3, Bot, Activity, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react'

export function PremiumDark() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">FlowFunnel</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-white/60 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition">Entrar</button>
            <button className="text-sm font-bold bg-white hover:bg-white/90 text-black px-5 py-2 rounded-lg transition">Começar Grátis</button>
          </div>
        </div>
      </nav>

      {/* HERO - Premium Dark */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.15),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(236,72,153,0.1),_transparent_50%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 text-xs font-semibold px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            WhatsApp · Facebook Ads · Hotmart · Kiwify · Eduzz · Monetizze
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] mb-6 tracking-tight">
            Descubra exatamente onde<br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">você perde vendas</span>
          </h1>

          <p className="text-white/50 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            Conecte suas plataformas e veja em tempo real onde seus leads desistem — com uma IA que identifica gargalos e sugere como aumentar sua conversão.
          </p>

          <p className="text-emerald-400 text-sm font-semibold mb-8">
            +1.200 produtores e gestores já usam para escalar vendas
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <button className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-violet-500/25 transition">
              Ver onde estou perdendo vendas <ArrowRight className="w-5 h-5" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-xl text-base border border-white/10 backdrop-blur-sm transition">
              Já tenho conta <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/30 text-xs">7 dias grátis · Cancele quando quiser · Acesso imediato</p>
        </div>
      </section>

      {/* PLANOS - Glassmorphism */}
      <section className="py-20 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#13131f] to-[#0a0a0f]" />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-white/5 border border-white/10 text-violet-300 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">Escolha o plano</span>
            <h2 className="mt-6 text-4xl sm:text-5xl font-black text-white">7 dias grátis em qualquer plano</h2>
            <p className="mt-3 text-white/40">Teste sem custo e cancele quando quiser.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* START */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] hover:border-white/20 hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 text-white/60">Essencial</span>
                <Zap className="w-5 h-5 text-white/30" />
              </div>
              <h3 className="text-2xl font-black text-white mb-1">START</h3>
              <p className="text-sm text-white/30 mb-6">Para quem está começando</p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-white/30">R$</span>
                  <span className="text-5xl font-black text-white">97</span>
                </div>
                <span className="text-xs text-white/30">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-white/10 hover:bg-white/20 text-white transition mb-2 border border-white/10">Testar grátis 7 dias</button>
              <div className="space-y-3 mt-6">
                {['Análise por IA do funil','Até 1.000 conversas/mês','1 número WhatsApp','1 funil ativo'].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-white/60">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PRO - Glow */}
            <div className="bg-gradient-to-b from-violet-600/20 to-fuchsia-600/20 backdrop-blur-xl border border-violet-500/30 rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 to-fuchsia-500/10" />
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-500/20 text-violet-300">Popular</span>
                  <TrendingUp className="w-5 h-5 text-violet-300" />
                </div>
                <h3 className="text-2xl font-black text-white mb-1">PRO</h3>
                <p className="text-sm text-white/30 mb-6">Para quem anuncia todo dia</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-white/30">R$</span>
                    <span className="text-5xl font-black text-white">147</span>
                  </div>
                  <span className="text-xs text-white/30">/mês</span>
                </div>
                <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white transition mb-2 shadow-lg shadow-violet-500/25">Testar grátis 7 dias</button>
                <div className="space-y-3 mt-6">
                  {['Análise completa por IA','Até 3.000 conversas/mês','Diagnóstico + sugestões','Até 3 WhatsApps','Até 3 funis','Comparação de períodos'].map((f) => (
                    <div key={f} className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-violet-300 flex-shrink-0" />
                      <span className="text-sm text-white">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SCALE */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] hover:border-white/20 hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 text-white/60">IA Avançada</span>
                <Crown className="w-5 h-5 text-white/30" />
              </div>
              <h3 className="text-2xl font-black text-white mb-1">SCALE</h3>
              <p className="text-sm text-white/30 mb-6">Para agências e grandes operações</p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-white/30">R$</span>
                  <span className="text-5xl font-black text-white">297</span>
                </div>
                <span className="text-xs text-white/30">/mês</span>
              </div>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-center bg-white/10 hover:bg-white/20 text-white transition mb-2 border border-white/10">Testar grátis 7 dias</button>
              <div className="space-y-3 mt-6">
                {['IA avançada completa','Conversas ilimitadas','WhatsApps ilimitados','Funis ilimitados','Histórico 365 dias','Comparação de períodos'].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-white/60">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARCAS */}
      <section className="py-16 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6 text-center mb-8">
          <p className="text-lg font-bold uppercase tracking-[0.2em] text-white/20">Integrações nativas</p>
        </div>
        <div className="flex justify-center gap-6 flex-wrap px-6">
          {['Meta','WhatsApp','Hotmart','Eduzz','Monetizze','Kiwify'].map((brand) => (
            <div key={brand} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-semibold hover:bg-white/10 hover:text-white/60 transition">{brand}</div>
          ))}
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-white/5 border border-white/10 text-white/40 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">⚠️ O problema</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mt-6 leading-tight">
              Você investe em anúncios,<br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">mas não sabe o que acontece depois.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '📊', title: 'Facebook Ads', desc: 'Você vê cliques e CPM — mas não sabe se virou conversa, lead ou venda.' },
              { icon: '💬', title: 'WhatsApp', desc: 'As conversas chegam, mas você não sabe de qual campanha vieram.' },
              { icon: '💳', title: 'Hotmart', desc: 'A venda foi confirmada — mas qual anúncio gerou? Você não sabe.' },
            ].map((c) => (
              <div key={c.title} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] hover:border-white/20 transition backdrop-blur-sm">
                <span className="text-3xl mb-4 block">{c.icon}</span>
                <h3 className="text-lg font-bold text-white mb-3">{c.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-24 px-6 bg-[#0f0f1a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block bg-violet-500/10 text-violet-300 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider border border-violet-500/20">✨ A solução</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mt-6">Um painel. Todas as plataformas. Decisões inteligentes.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <MessageCircle className="w-5 h-5" />, title: 'Rastreamento WhatsApp', desc: 'Cada conversa rastreada até a origem da campanha.', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Dashboard real-time', desc: 'Acompanhe conversões e gargalos em um painel unificado.', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
              { icon: <Bot className="w-5 h-5" />, title: 'IA inteligente', desc: 'Detecta onde leads desistem e sugere ações.', color: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' },
              { icon: <TrendingUp className="w-5 h-5" />, title: 'Comparação de períodos', desc: 'Compare semanas, meses e campanhas.', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
              { icon: <Activity className="w-5 h-5" />, title: 'Alertas inteligentes', desc: 'Receba notificações quando métricas críticas mudam.', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
              { icon: <ShieldCheck className="w-5 h-5" />, title: '100% seguro', desc: 'Dados criptografados e isolados por conta.', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
            ].map((f) => (
              <div key={f.title} className="group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] hover:border-white/20 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm">
                <div className={`w-11 h-11 rounded-xl ${f.color} border flex items-center justify-center mb-4`}>{f.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f1a] to-[#0a0a0f]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">Pare de perder vendas no escuro.</h2>
          <p className="text-white/40 text-lg mb-10">Teste 7 dias grátis. Veja onde seus leads desistem.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-violet-500/25 transition">
              Começar grátis 7 dias <ArrowRight className="w-5 h-5" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-xl text-base border border-white/10 transition">
              Já tenho conta <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm">FlowFunnel</span>
          </div>
          <div className="flex gap-6 text-sm text-white/30">
            <span className="hover:text-white/60 cursor-pointer transition">Termos</span>
            <span className="hover:text-white/60 cursor-pointer transition">Privacidade</span>
            <span className="hover:text-white/60 cursor-pointer transition">Contato</span>
          </div>
          <p className="text-white/20 text-xs">© 2025 FlowFunnel</p>
        </div>
      </footer>
    </div>
  )
}
