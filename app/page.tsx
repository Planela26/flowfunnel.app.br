import Link from 'next/link'
import {
  BarChart3,
  MessageCircle,
  TrendingUp,
  Zap,
  Check,
  X,
  Crown,
  ArrowRight,
  Bot,
  ShieldCheck,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { authPatternUrl, authPatternSize } from '@/lib/authPattern'
import ShowcaseSection from '@/components/landing/ShowcaseSection'

const encoded = authPatternUrl

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0c1426] border-b border-white/5 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full overflow-hidden flex-shrink-0">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-base sm:text-xl font-extrabold text-white tracking-tight leading-none">FlowFunnel</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-2">
            <Link href="/login"
              className="text-sm font-medium text-blue-200 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10 transition">
              Entrar
            </Link>
            <Link href="/register"
              className="text-sm font-bold bg-white text-blue-800 hover:bg-blue-50 px-5 py-2 rounded-lg transition shadow-sm">
              Começar Grátis
            </Link>
          </nav>
          {/* Mobile nav */}
          <nav className="flex sm:hidden items-center gap-2">
            <Link href="/login"
              className="text-xs font-medium text-blue-200 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition">
              Entrar
            </Link>
            <Link href="/register"
              className="text-xs font-bold bg-white text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition shadow-sm">
              Começar
            </Link>
          </nav>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 overflow-hidden">
        {/* animated brand-logo pattern */}
        <style>{`
          @keyframes heroPattern {
            from { background-position: 0px 0px; }
            to   { background-position: 240px 240px; }
          }
          .hero-pattern {
            background-image: ${encoded};
            background-size: ${authPatternSize};
            animation: heroPattern 18s linear infinite;
          }
        `}</style>
        <div className="hero-pattern absolute inset-0 opacity-60 pointer-events-none" />
        {/* bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-32 sm:pb-52 text-center">
          {/* badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-blue-100 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            WhatsApp · Facebook Ads · Hotmart · Kiwify · Eduzz · Monetizze
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-[1.1] mb-4 sm:mb-6 tracking-tight">
            Descubra exatamente onde você está perdendo vendas no seu funil
          </h1>

          <p className="text-blue-200 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-6 sm:mb-10 leading-relaxed font-bold px-2 sm:px-0">
            Conecte suas plataformas e veja em tempo real onde seus leads desistem — com uma IA que identifica gargalos e sugere como aumentar sua conversão.
          </p>

          <p className="text-emerald-200 text-sm md:text-base font-bold mb-2">
            +1.200 produtores e gestores já usam para escalar vendas
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center mb-6 px-2 sm:px-0">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base shadow-xl transition">
              Ver onde estou perdendo vendas
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base border border-white/20 backdrop-blur-sm transition">
              Já tenho conta
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-blue-300/70 text-xs">
            7 dias grátis · Cancele quando quiser · Acesso imediato
          </p>
        </div>
      </section>

      {/* ── PLANOS (overlapping hero) ─────────────────────────────────────── */}
      <section className="bg-gray-50 px-6 pb-16">
        <div className="max-w-5xl mx-auto -mt-40">

          {/* section label */}
          <div className="text-center mb-8">
            <span className="inline-block bg-white border border-gray-200 text-blue-700 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm uppercase tracking-wider">
              Escolha o plano e comece a recuperar vendas perdidas hoje
            </span>
            <p className="mt-5 text-3xl sm:text-4xl font-black text-gray-900">
              7 dias grátis <span className="text-blue-600">em qualquer plano</span>
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Teste sem custo e cancele quando quiser — ou pague na hora com PIX, Boleto ou Cartão.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">

            {/* START */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-7 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Essencial</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Zap className="w-4.5 h-4.5" />
                  </div>
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 mb-1">START</h3>
                <p className="text-sm text-gray-400 mb-5">Para quem está começando</p>
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-gray-400">R$</span>
                    <span className="text-5xl font-black text-gray-900">97</span>
                  </div>
                  <span className="text-xs text-gray-400">/mês · cancele quando quiser</span>
                </div>
                <a href="/register?plan=START"
                  className="w-full py-3 rounded-xl text-sm font-bold text-center bg-blue-600 hover:bg-blue-700 text-white transition mb-2 block shadow-sm">
                  Testar grátis 7 dias
                </a>
                <a href="/checkout?plan=START"
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-center border border-gray-200 text-gray-600 hover:bg-gray-50 transition mb-2 flex items-center justify-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Pagar agora (PIX/Boleto/Cartão)
                </a>
                <p className="text-center text-[11px] text-gray-400 mb-6">7 dias grátis · cancele quando quiser</p>
                <div className="space-y-2.5">
                  {['Análise por IA do funil','Até 1.000 conversas iniciadas/mês','Identificação de gargalos','Insights básicos','1 número de WhatsApp','1 funil ativo'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="flex-shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center bg-emerald-50">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </span>
                      <span className="text-sm text-gray-600">{f}</span>
                    </div>
                  ))}
                  {['Comparação de períodos','Alertas automáticos (em breve)','Multiusuário (em breve)'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="flex-shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center bg-gray-50">
                        <X className="w-3 h-3 text-gray-300" />
                      </span>
                      <span className="text-sm text-gray-300 line-through">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PRO — destaque */}
            <div className="bg-gradient-to-b from-blue-700 to-blue-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:-mt-6 z-10 relative ring-2 ring-blue-400/40">
              <div className="bg-gradient-to-r from-emerald-500 to-blue-400 text-white text-xs font-black uppercase tracking-widest text-center py-2.5">
                ⭐ Mais Popular
              </div>
              <div className="p-7 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-white border border-white/20">Popular</span>
                  <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/20 flex items-center justify-center text-white">
                    <TrendingUp className="w-4.5 h-4.5" />
                  </div>
                </div>
                <h3 className="text-2xl font-extrabold text-white mb-1">PRO</h3>
                <p className="text-sm text-blue-200 mb-5">Para quem anuncia todo dia</p>
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-blue-200">R$</span>
                    <span className="text-5xl font-black text-white">147</span>
                  </div>
                  <span className="text-xs text-blue-300">/mês · cancele quando quiser</span>
                </div>
                <a href="/register?plan=PRO"
                  className="w-full py-3 rounded-xl text-sm font-bold text-center bg-white text-blue-700 hover:bg-blue-50 transition mb-2 block shadow-sm">
                  Testar grátis 7 dias
                </a>
                <a href="/checkout?plan=PRO"
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-center border border-white/30 text-white/90 hover:bg-white/10 transition mb-2 flex items-center justify-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Pagar agora (PIX/Boleto/Cartão)
                </a>
                <p className="text-center text-[11px] text-blue-200/80 mb-6">7 dias grátis · cancele quando quiser</p>
                <div className="space-y-2.5">
                  {['Análise completa por IA','Até 3.000 conversas iniciadas/mês','Diagnóstico + sugestões','Insights avançados','Até 3 números de WhatsApp','Até 3 funis ativos','Comparação de períodos'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="flex-shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center bg-white/20">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                      <span className="text-sm text-white">{f}</span>
                    </div>
                  ))}
                  {['Alertas automáticos (em breve)','Multiusuário (em breve)'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="flex-shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center bg-white/10">
                        <X className="w-3 h-3 text-blue-300/50" />
                      </span>
                      <span className="text-sm text-blue-300/50 line-through">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SCALE */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-7 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">IA Avançada</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Crown className="w-4.5 h-4.5" />
                  </div>
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 mb-1">SCALE</h3>
                <p className="text-sm text-gray-400 mb-5">Para agências e grandes operações</p>
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-gray-400">R$</span>
                    <span className="text-5xl font-black text-gray-900">297</span>
                  </div>
                  <span className="text-xs text-gray-400">/mês · cancele quando quiser</span>
                </div>
                <a href="/register?plan=SCALE"
                  className="w-full py-3 rounded-xl text-sm font-bold text-center bg-blue-600 hover:bg-blue-700 text-white transition mb-2 block shadow-sm">
                  Testar grátis 7 dias
                </a>
                <a href="/checkout?plan=SCALE"
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-center border border-gray-200 text-gray-600 hover:bg-gray-50 transition mb-2 flex items-center justify-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Pagar agora (PIX/Boleto/Cartão)
                </a>
                <p className="text-center text-[11px] text-gray-400 mb-6">7 dias grátis · cancele quando quiser</p>
                <div className="space-y-2.5">
                  {['IA avançada (sugestões + diagnóstico)','Conversas iniciadas ilimitadas','Análise de tendências (em breve)','Histórico estendido (até 365 dias)','WhatsApps ilimitados','Funis ilimitados','Comparação de períodos','Alertas automáticos (em breve)','Multiusuário (em breve)'].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="flex-shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center bg-emerald-50">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </span>
                      <span className="text-sm text-gray-600">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── SHOWCASE VISUAL DA PLATAFORMA ─────────────────────────────────── */}
      <ShowcaseSection />

      {/* ── CARROSSEL DE MARCAS ──────────────────────────────────────────── */}
      <section className="bg-white border-y border-gray-100 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 pt-10 text-center">
          <p className="text-base sm:text-lg md:text-xl font-black uppercase tracking-[0.28em] text-blue-800">
            Funciona com as principais plataformas do mercado — sem código
          </p>
        </div>
        <style>{`
          @keyframes marqueeLeft {
            from { transform: translateX(0); }
            to { transform: translateX(-33.3333%); }
          }
          .brand-carousel { animation: marqueeLeft 35s linear infinite; will-change: transform; }
          .brand-carousel-wrap:hover .brand-carousel { animation-play-state: paused; }
          .brand-card { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease, background 0.35s ease; }
          .brand-card:hover { transform: translateY(-8px) scale(1.08); background: linear-gradient(135deg, #eff6ff, #ffffff); box-shadow: 0 20px 40px -12px rgba(30, 64, 175, 0.35); }
          .brand-card:hover .brand-img { transform: scale(1.1); filter: none; }
          .brand-card:hover .brand-label { opacity: 1; transform: translateY(0); }
          .brand-img { transition: transform 0.35s ease, filter 0.35s ease; filter: grayscale(0%); }
          .brand-label { opacity: 0; transform: translateY(4px); transition: all 0.3s ease; }
        `}</style>
        <div className="py-10 brand-carousel-wrap">
          <div className="brand-carousel flex w-max">
            {[0, 1, 2].map((dup) => (
              <div key={dup} className="flex shrink-0" aria-hidden={dup > 0}>
                {[
                  { name: 'Meta', src: '/logos/meta.jpg', url: 'https://about.meta.com' },
                  { name: 'WhatsApp', src: '/logos/whatsapp.jpg', url: 'https://www.whatsapp.com' },
                  { name: 'Hotmart', src: '/logos/hotmart.jpg', url: 'https://www.hotmart.com' },
                  { name: 'Eduzz', src: '/logos/eduzz.png', url: 'https://www.eduzz.com' },
                  { name: 'Monetizze', src: '/logos/monetizze.jpg', url: 'https://www.monetizze.com.br' },
                  { name: 'Kiwify', src: '/logos/kiwify.jpg', url: 'https://kiwify.com.br' },
                  { name: 'Instagram', src: '/logos/instagram.jpg', url: 'https://www.instagram.com' },
                ].map((brand) => (
                  <a
                    key={`${dup}-${brand.name}`}
                    href={brand.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visitar site oficial da ${brand.name}`}
                    className="brand-card flex-shrink-0 w-36 h-24 mx-1 rounded-2xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    <img
                      src={brand.src}
                      alt={brand.name}
                      className="brand-img max-h-16 max-w-[110px] w-auto h-auto object-contain"
                    />
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 pb-10 text-center">
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gray-600">
            Todas as ferramentas que você já usa, em um único painel — integração rápida, sem precisar de desenvolvedor.
          </p>
        </div>
      </section>

      {/* ── PROBLEMA ─────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
        <div className="hero-pattern absolute inset-0 opacity-60 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-10 sm:mb-16">
            <span className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 text-blue-100 text-[10px] sm:text-xs font-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-full uppercase tracking-widest shadow-lg">⚠️ Por que você ainda perde vendas?</span>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mt-4 sm:mt-5 tracking-tight leading-[1.1]">
              Você investe em anúncios,<br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-blue-300 via-blue-200 to-white bg-clip-text text-transparent">mas não sabe o que acontece depois do clique.</span>
            </h2>
            <p className="text-blue-200 text-sm sm:text-lg mt-3 sm:mt-5 font-medium max-w-2xl mx-auto px-2 sm:px-0">Cada plataforma te mostra só um pedaço. Você olha para números isolados e toma decisões no escuro — enquanto o dinheiro escorre pelo ralo.</p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 mb-6 sm:mb-10">
            {[
              { icon: '📊', platform: 'Facebook Ads', problem: 'Você vê cliques e CPM — mas não sabe se um único real investido virou conversa, lead ou venda.', accent: 'from-blue-700 to-blue-500' },
              { icon: '💬', platform: 'WhatsApp', problem: 'As conversas chegam, mas você não sabe de qual campanha vieram nem quantas viraram dinheiro no bolso.', accent: 'from-blue-600 to-blue-400' },
              { icon: '💳', platform: 'Hotmart / Checkout', problem: 'A venda foi confirmada — mas qual anúncio gerou? Qual copy converteu? Você simplesmente não sabe.', accent: 'from-blue-800 to-blue-600' },
            ].map((c) => (
              <div key={c.platform} className="group relative bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-7 hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-1 transition-all duration-300 shadow-2xl">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${c.accent} flex items-center justify-center text-xl sm:text-2xl mb-4 sm:mb-5 shadow-xl group-hover:scale-110 transition-transform`}>
                  <span>{c.icon}</span>
                </div>
                <span className={`text-[10px] sm:text-xs font-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r ${c.accent} text-white inline-block mb-3 sm:mb-4 shadow-lg uppercase tracking-wider`}>{c.platform}</span>
                <p className="text-blue-100 text-sm sm:text-[15px] leading-relaxed font-medium">{c.problem}</p>
              </div>
            ))}
          </div>

          <div className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 border-2 border-blue-400/30 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-center shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-blue-300/10 to-blue-400/10 animate-pulse" />
            <p className="relative text-white text-sm sm:text-xl font-black tracking-tight">
              <span className="inline-block mr-2 text-xl sm:text-2xl">💸</span>
              Sem visibilidade do funil, você continua pagando para aprender o que já deveria saber — e <span className="text-blue-200">seus concorrentes que têm essa visão estão escalando enquanto você fica no escuro.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── SOLUÇÃO ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-blue-700/30">🧠 Como o FlowFunnel resolve isso</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mt-5 mb-5 tracking-tight leading-[1.1]">
              Tudo conectado,{' '}
              <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent">tudo visível,</span>
              <br />
              <span className="text-gray-700">do anúncio até o dinheiro na conta.</span>
            </h2>
            <p className="text-gray-500 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Não precisa entender de analytics ou métricas complicadas.{' '}
              <span className="font-semibold text-gray-800">Nossa IA lê tudo por você e fala em português o que precisa mudar para vender mais.</span>
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card destaque — IA (renderizado separado para visual diferente) */}
            <div className="group relative bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 shadow-xl shadow-purple-500/20 hover:shadow-2xl hover:shadow-purple-500/30 hover:-translate-y-1 transition-all text-white order-first sm:order-none lg:order-none">
              <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full mb-3">⭐ Nosso diferencial</span>
              <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white mb-2">IA que Diagnostica e Orienta</h3>
              <p className="text-purple-100 text-sm leading-relaxed">Ela lê seus números, identifica onde as vendas travam e te diz — em linguagem simples — exatamente o que mudar para converter mais.</p>
            </div>
            {[
              { icon: <BarChart3 className="w-5 h-5" />, light: 'bg-blue-50', text: 'text-blue-600', title: 'Veja onde cada venda nasce e morre', desc: 'Do primeiro clique no anúncio até o pagamento confirmado — tudo em uma linha do tempo visual, com a taxa de conversão de cada etapa.' },
              { icon: <Activity className="w-5 h-5" />, light: 'bg-emerald-50', text: 'text-emerald-600', title: 'Dados atualizados sem você fazer nada', desc: 'Esqueça planilhas manuais. Cada venda, lead e mensagem chega automaticamente ao painel em tempo real.' },
              { icon: <ShieldCheck className="w-5 h-5" />, light: 'bg-orange-50', text: 'text-orange-500', title: 'Saiba antes que vire problema', desc: 'Receba um alerta automático quando o custo subir, a taxa de resposta cair ou uma campanha parar de gerar resultado.' },
            ].map((f) => (
              <div key={f.title} className="group border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:border-gray-200 transition-all bg-white">
                <div className={`${f.light} w-10 h-10 rounded-xl flex items-center justify-center ${f.text} mb-4 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-b from-gray-50 via-white to-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #1e3a8a 0%, transparent 40%), radial-gradient(circle at 80% 50%, #10b981 0%, transparent 40%)' }} />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <span className="inline-block bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-blue-700/30">⚡ Simples e Rápido</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mt-5 tracking-tight">
              Do zero ao seu funil rodando <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 bg-clip-text text-transparent">em 5 minutos</span>
            </h2>
            <p className="text-gray-600 text-lg mt-4 font-medium">Sem instalar nada, sem precisar de técnico. Só conectar e ver os dados chegarem.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* linha conectora desktop */}
            <div className="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-1 bg-gradient-to-r from-blue-900 via-blue-600 to-blue-900 rounded-full opacity-20" />

            {[
              { step: '01', title: 'Crie sua conta grátis', desc: 'Cadastro em menos de 2 minutos, sem cartão de crédito. Você já entra direto no painel.', icon: '🚀', accent: 'from-blue-900 to-blue-700', shadow: 'shadow-blue-900/40' },
              { step: '02', title: 'Conecte WhatsApp, Meta e checkout', desc: 'Nosso assistente guia a integração passo a passo com instruções simples — sem precisar de técnico ou conhecimento técnico.', icon: '🔗', accent: 'from-blue-800 to-blue-600', shadow: 'shadow-blue-700/40' },
              { step: '03', title: 'Veja onde você perde vendas', desc: 'Os dados chegam em tempo real e a IA aponta imediatamente onde seu funil está travando e o que fazer.', icon: '📊', accent: 'from-blue-700 to-blue-500', shadow: 'shadow-blue-600/40' },
            ].map((s) => (
              <div key={s.step} className="relative group">
                <div className="relative bg-white border-2 border-gray-100 rounded-3xl p-7 shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:border-blue-200 transition-all duration-300 h-full">
                  <div className="text-[7rem] font-black text-gray-200 absolute -top-2 right-3 select-none leading-none group-hover:text-blue-100 transition-colors">{s.step}</div>
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-3xl mb-5 shadow-xl ${s.shadow} group-hover:scale-110 transition-transform`}>
                      <span className="drop-shadow-sm">{s.icon}</span>
                    </div>
                    <h3 className="font-black text-gray-900 mb-3 text-xl tracking-tight">{s.title}</h3>
                    <p className="text-gray-700 text-sm leading-relaxed font-medium">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black px-8 py-4 rounded-2xl text-base shadow-xl shadow-blue-600/30 transition-all hover:scale-105">
              Começar agora — é grátis
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-b from-white via-blue-50/30 to-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #1e3a8a 0%, transparent 50%)' }} />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <span className="inline-block bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-blue-700/30">⭐ Resultados reais de quem já usa</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mt-5 tracking-tight">
              O que dizem <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 bg-clip-text text-transparent">nossos clientes</span>
            </h2>
            <p className="text-gray-600 text-lg mt-4 font-medium">Mais de 1.200 produtores digitais e gestores de tráfego usam diariamente.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                name: 'Rodrigo Alves',
                role: 'Produtor Digital · Hotmart',
                avatar: 'RA',
                accent: 'from-blue-900 to-blue-700',
                text: 'Em 3 dias já sabia exatamente onde meu funil estava perdendo vendas. Aumentei minha taxa de conversão em 40% só ajustando o tempo de resposta no WhatsApp.',
                metric: '+40% conversão',
              },
              {
                name: 'Fernanda Costa',
                role: 'Gestora de Tráfego',
                avatar: 'FC',
                accent: 'from-blue-800 to-blue-600',
                text: 'Antes eu usava 5 planilhas para cruzar dados. Agora tudo está em um lugar. Economizo horas por semana e entrego relatórios muito mais completos para meus clientes.',
                metric: '5h/semana economizadas',
              },
              {
                name: 'Lucas Mendonça',
                role: 'Infoprodutor · Kiwify',
                avatar: 'LM',
                accent: 'from-blue-700 to-blue-500',
                text: 'A análise do ChatGPT-4 me apontou que 70% dos meus leads chegavam mas não recebiam follow-up. Corrigi isso e meu faturamento subiu 60% no mês seguinte.',
                metric: '+60% faturamento',
              },
              {
                name: 'Ana Paula Rocha',
                role: 'Mentora de Negócios',
                avatar: 'AP',
                accent: 'from-blue-900 to-blue-600',
                text: 'Simplesmente incrível. Ver o funil completo do anúncio até o pix caindo na conta, tudo em tempo real, mudou como eu tomo decisões de escala.',
                metric: 'Decisões em tempo real',
              },
              {
                name: 'Thiago Martins',
                role: 'Afiliado · Monetizze',
                avatar: 'TM',
                accent: 'from-blue-800 to-blue-500',
                text: 'Descobri que meus melhores leads vinham de um único conjunto de anúncios. Concentrei o orçamento lá e meu ROI triplicou em 30 dias.',
                metric: 'ROI 3x em 30 dias',
              },
              {
                name: 'Juliana Ferreira',
                role: 'Produtora · Eduzz',
                avatar: 'JF',
                accent: 'from-blue-900 to-blue-700',
                text: 'O alerta automático que me avisa quando o WhatsApp para de receber mensagens me salvou de perder um lançamento inteiro. Imprescindível.',
                metric: 'Lançamento salvo',
              },
            ].map((t) => (
              <div key={t.name} className="group relative bg-white rounded-3xl p-7 border-2 border-gray-100 shadow-lg hover:shadow-2xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300">
                <div className={`absolute -top-3 left-7 bg-gradient-to-r ${t.accent} text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg`}>
                  {t.metric}
                </div>
                <div className="flex gap-1 mb-4 mt-1">
                  {[1,2,3,4,5].map((i) => (
                    <span key={i} className="text-blue-600 text-base">★</span>
                  ))}
                </div>
                <p className="text-gray-800 text-[15px] leading-relaxed mb-6 font-medium">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.accent} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-lg`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500 font-medium">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gradient-to-b from-gray-50 via-blue-50/30 to-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e3a8a 0%, transparent 50%)' }} />
        <div className="max-w-3xl mx-auto relative">
          <div className="text-center mb-16">
            <span className="inline-block bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-blue-700/30">💬 Dúvidas Frequentes</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mt-5 tracking-tight">
              Perguntas <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 bg-clip-text text-transparent">frequentes</span>
            </h2>
            <p className="text-gray-600 text-lg mt-4 font-medium">Tudo que você precisa saber antes de começar.</p>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'Preciso mexer em código para integrar?',
                a: 'Não. Nossa interface guia você passo a passo na configuração dos webhooks. É só copiar uma URL e colar nas configurações da sua plataforma. Leva menos de 5 minutos.',
              },
              {
                q: 'Funciona com Hotmart, Kiwify, Eduzz e Monetizze?',
                a: 'Sim, todas elas. Também integra com Facebook Ads (Meta) e WhatsApp Business API. Novos conectores são adicionados regularmente sem custo adicional.',
              },
              {
                q: 'O que é a "análise por ChatGPT-4"?',
                a: 'A cada atualização do seu painel, a IA analisa seus dados reais (conversas, cliques, vendas) e gera recomendações específicas para melhorar seu funil — onde estão os gargalos e o que fazer para escalar.',
              },
              {
                q: 'Posso cancelar quando quiser?',
                a: 'Sim, sem multa e sem burocracia. Você gerencia sua assinatura diretamente pelo painel, incluindo cancelamento com um clique. Seu acesso continua até o fim do período pago.',
              },
              {
                q: 'O que acontece se eu atingir o limite de conversas?',
                a: 'Você recebe um alerta por email quando chegar a 80% do limite. Se atingir 100%, novos webhooks do WhatsApp são pausados automaticamente até o mês seguinte ou até você fazer upgrade.',
              },
              {
                q: 'Meus dados ficam protegidos?',
                a: 'Sim. Todos os dados trafegam criptografados (HTTPS/TLS). Seguimos as diretrizes da LGPD e não compartilhamos seus dados com terceiros.',
              },
              {
                q: 'Tem período de teste ou garantia?',
                a: 'Oferecemos 7 dias de garantia total. Se não ficar satisfeito por qualquer motivo, devolvemos 100% do valor sem perguntas.',
              },
            ].map((faq, i) => (
              <details key={i} className="group bg-white border-2 border-gray-100 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:border-blue-200 transition-all duration-300 open:border-blue-300 open:shadow-xl">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer font-bold text-gray-900 text-base list-none select-none gap-4">
                  <div className="flex items-center gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 text-white text-xs font-black flex items-center justify-center shadow-lg shadow-blue-600/30">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="tracking-tight">{faq.q}</span>
                  </div>
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-700 group-open:bg-blue-700 group-open:text-white group-open:rotate-180 transition-all flex items-center justify-center text-xl leading-none font-bold">+</span>
                </summary>
                <div className="px-6 pb-6 text-[15px] text-gray-700 leading-relaxed border-t border-blue-100 pt-5 font-medium ml-12 mr-2">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 py-24 px-6 text-center overflow-hidden">
        <div className="hero-pattern absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
            Pronto para descobrir onde seu dinheiro está sendo perdido?
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Crie sua conta gratuitamente e veja seu funil completo em minutos.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-10 py-4 rounded-xl text-base shadow-xl transition">
            Criar conta e ver meu funil agora
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-blue-300/60 text-xs mt-4">7 dias grátis · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-bold text-gray-200">FlowFunnel</span>
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/termos" className="text-gray-500 hover:text-white transition">Termos de Uso</Link>
            <Link href="/privacidade" className="text-gray-500 hover:text-white transition">Privacidade</Link>
            <Link href="/lgpd" className="text-gray-500 hover:text-white transition">LGPD</Link>
          </div>
          <p className="text-gray-600 text-sm">© 2026 FlowFunnel</p>
        </div>
      </footer>

    </main>
  )
}
