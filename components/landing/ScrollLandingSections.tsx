import Link from 'next/link'
import {
  Sparkles, TrendingUp, AlertTriangle, BarChart2, Target, Brain, Zap,
  Bot, Activity, ShieldCheck, BarChart3, Check, X, ArrowRight, CheckCircle2,
} from 'lucide-react'
import SaraChatDemo from './SaraChatDemo'

const display = { fontFamily: 'var(--font-display), Inter, sans-serif' }

/* ─────────────────────────────────────────────────────────────────────────
   Blocos reutilizáveis
   ──────────────────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-400">
      {children}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-5 text-[2.1rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#F4F7FB] sm:text-[3.25rem]"
      style={display}
    >
      {children}
    </h2>
  )
}

function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-[1.6] text-slate-300/85 sm:text-[1.0625rem]">
      {children}
    </p>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Dados
   ──────────────────────────────────────────────────────────────────────── */

const PROBLEMAS = [
  {
    tag: 'Facebook Ads',
    text: 'Você vê cliques e CPM — mas não sabe se um único real investido virou conversa, lead ou venda.',
  },
  {
    tag: 'WhatsApp',
    text: 'As conversas chegam, mas você não sabe de qual campanha vieram nem quantas viraram dinheiro no bolso.',
  },
  {
    tag: 'Hotmart / Checkout',
    text: 'A venda foi confirmada — mas qual anúncio gerou? Qual copy converteu? Você simplesmente não sabe.',
  },
]

const SOLUCOES = [
  {
    icon: Bot,
    destaque: true,
    title: 'IA que diagnostica e orienta',
    desc: 'Ela lê seus números, identifica onde as vendas travam e diz — em português — exatamente o que mudar para converter mais.',
  },
  {
    icon: BarChart3,
    title: 'Veja onde cada venda nasce e morre',
    desc: 'Do primeiro clique no anúncio ao pagamento confirmado, numa linha do tempo visual com a taxa de conversão de cada etapa.',
  },
  {
    icon: Activity,
    title: 'Dados atualizados sem você fazer nada',
    desc: 'Esqueça planilhas manuais. Cada venda, lead e mensagem chega automaticamente ao painel em tempo real.',
  },
  {
    icon: ShieldCheck,
    title: 'Saiba antes que vire problema',
    desc: 'Alerta automático quando o custo sobe, a taxa de resposta cai ou uma campanha para de gerar resultado.',
  },
]

const SARA_FEATURES = [
  {
    icon: TrendingUp,
    title: 'Analisa seus funis sozinha',
    desc: 'Acompanha cada etapa e identifica os gargalos que reduzem sua conversão — sem você precisar pedir.',
  },
  {
    icon: AlertTriangle,
    title: 'Detecta problemas antes de você',
    desc: 'Webhook falhando, integração quebrada, API com timeout, pagamento com erro — a Sara avisa primeiro.',
  },
  {
    icon: BarChart2,
    title: 'Traduz métrica em linguagem simples',
    desc: 'Não só exibe números: explica o que cada métrica significa e o que você deve fazer com ela.',
  },
  {
    icon: Target,
    title: 'Encontra oportunidades de venda',
    desc: 'Aponta onde seus leads abandonam o processo e recomenda ações específicas para recuperá-los.',
  },
  {
    icon: Brain,
    title: 'Especialista em marketing digital',
    desc: 'Funis, tráfego pago, ROI, CAC, LTV, copywriting, lançamento, perpétuo e WhatsApp Marketing.',
  },
  {
    icon: Zap,
    title: 'Recomenda ações inteligentes',
    desc: 'Sugere melhorias para campanhas, funis, páginas e processos com base nos seus dados reais.',
  },
]

const SARA_INSIGHTS = [
  {
    nivel: 'Atenção urgente',
    tone: 'red' as const,
    titulo: 'Queda de conversão no checkout mobile',
    texto:
      'O checkout no mobile converte 38% menos que no desktop nos últimos 7 dias. Reduzir campos do formulário deve recuperar parte das vendas.',
  },
  {
    nivel: 'Recomendação',
    tone: 'amber' as const,
    titulo: 'TikTok Ads com o melhor ROI',
    texto:
      'TikTok está com ROI de 378% — bem acima da média da conta. Vale realocar parte do orçamento do Meta para escalar.',
  },
  {
    nivel: 'Recomendação',
    tone: 'amber' as const,
    titulo: 'CPC do Meta subiu 22% em 3 dias',
    texto:
      'O CPC saiu de R$ 2,30 para R$ 2,81. Provável saturação de público: renove os criativos e amplie a segmentação.',
  },
]

const SARA_KNOWS = [
  'Funis', 'WhatsApp', 'Campanhas', 'Leads', 'Conversões', 'Produtos',
  'Vendas', 'Assinaturas', 'Cobranças', 'Dashboards', 'Integrações',
  'Automações', 'APIs', 'Webhooks', 'Eventos', 'Histórico',
  'Clientes', 'Performance', 'Relatórios',
]

const PASSOS = [
  {
    n: '01',
    title: 'Crie sua conta grátis',
    desc: 'Cadastro em menos de 2 minutos, sem cartão de crédito. Você já entra direto no painel.',
  },
  {
    n: '02',
    title: 'Conecte WhatsApp, Ads e checkout',
    desc: 'Um assistente guia a integração passo a passo. É copiar uma URL e colar — sem precisar de técnico.',
  },
  {
    n: '03',
    title: 'Veja onde você perde vendas',
    desc: 'Os dados chegam em tempo real e a Sara aponta na hora onde o funil está travando e o que fazer.',
  },
]

const MARCAS = [
  { name: 'Meta', src: '/logos/meta.jpg' },
  { name: 'WhatsApp', src: '/logos/whatsapp.jpg' },
  { name: 'Hotmart', src: '/logos/hotmart.jpg' },
  { name: 'Eduzz', src: '/logos/eduzz.png' },
  { name: 'Monetizze', src: '/logos/monetizze.jpg' },
  { name: 'Kiwify', src: '/logos/kiwify.jpg' },
  { name: 'Instagram', src: '/logos/instagram.jpg' },
]

const DEPOIMENTOS = [
  {
    name: 'Rodrigo Alves', role: 'Produtor Digital · Hotmart', avatar: 'RA', metric: '+40% conversão',
    text: 'Em 3 dias já sabia exatamente onde meu funil estava perdendo vendas. Aumentei a conversão em 40% só ajustando o tempo de resposta no WhatsApp.',
  },
  {
    name: 'Lucas Mendonça', role: 'Infoprodutor · Kiwify', avatar: 'LM', metric: '+60% faturamento',
    text: 'A Sara.AI me apontou que 70% dos meus leads chegavam mas não recebiam follow-up. Corrigi isso e meu faturamento subiu 60% no mês seguinte.',
  },
  {
    name: 'Fernanda Costa', role: 'Gestora de Tráfego', avatar: 'FC', metric: '5h/semana economizadas',
    text: 'Antes eu cruzava 5 planilhas. Agora está tudo em um lugar. Economizo horas por semana e entrego relatórios muito mais completos.',
  },
  {
    name: 'Thiago Martins', role: 'Afiliado · Monetizze', avatar: 'TM', metric: 'ROI 3x em 30 dias',
    text: 'Descobri que meus melhores leads vinham de um único conjunto de anúncios. Concentrei o orçamento lá e meu ROI triplicou em 30 dias.',
  },
  {
    name: 'Ana Paula Rocha', role: 'Mentora de Negócios', avatar: 'AP', metric: 'Decisões em tempo real',
    text: 'Ver o funil completo do anúncio até o pix caindo na conta, em tempo real, mudou como eu tomo decisões de escala.',
  },
  {
    name: 'Juliana Ferreira', role: 'Produtora · Eduzz', avatar: 'JF', metric: 'Lançamento salvo',
    text: 'O alerta automático que avisa quando o WhatsApp para de receber mensagens me salvou de perder um lançamento inteiro.',
  },
]

const PLANOS = [
  {
    nome: 'START',
    sub: 'Para quem está começando',
    preco: '97',
    destaque: false,
    inclui: ['Análise por IA do funil', 'Até 1.000 conversas/mês', 'Identificação de gargalos', 'Insights básicos', '1 número de WhatsApp', '1 funil ativo'],
    exclui: ['Comparação de períodos', 'Alertas automáticos', 'Multiusuário'],
  },
  {
    nome: 'PRO',
    sub: 'Para quem anuncia todo dia',
    preco: '147',
    destaque: true,
    inclui: ['Análise completa por IA', 'Até 3.000 conversas/mês', 'Diagnóstico + sugestões', 'Insights avançados', 'Até 3 números de WhatsApp', 'Até 3 funis ativos', 'Comparação de períodos'],
    exclui: ['Alertas automáticos', 'Multiusuário'],
  },
  {
    nome: 'SCALE',
    sub: 'Para agências e grandes operações',
    preco: '297',
    destaque: false,
    inclui: ['IA avançada: diagnóstico + sugestões', 'Conversas ilimitadas', 'Histórico de até 365 dias', 'WhatsApps ilimitados', 'Funis ilimitados', 'Comparação de períodos', 'Alertas automáticos', 'Multiusuário'],
    exclui: [],
  },
]

const FAQ = [
  { q: 'Preciso mexer em código para integrar?', a: 'Não. A interface guia você passo a passo na configuração dos webhooks. É copiar uma URL e colar nas configurações da sua plataforma. Leva menos de 5 minutos.' },
  { q: 'Funciona com Hotmart, Kiwify, Eduzz e Monetizze?', a: 'Sim, todas elas. Também integra com Meta Ads, Google Ads, TikTok Ads e WhatsApp Business API. Novos conectores entram regularmente, sem custo adicional.' },
  { q: 'O que é a Sara.AI?', a: 'É a assistente inteligente oficial do FlowSara. A cada atualização do painel ela analisa seus dados reais — conversas, cliques, vendas — e gera recomendações específicas: onde estão os gargalos e o que fazer para escalar.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim, sem multa e sem burocracia. Você gerencia a assinatura pelo próprio painel, com cancelamento em um clique. O acesso continua até o fim do período pago.' },
  { q: 'O que acontece se eu atingir o limite de conversas?', a: 'Você recebe um alerta por e-mail ao chegar em 80% do limite. Se atingir 100%, novos webhooks do WhatsApp são pausados automaticamente até o mês seguinte ou até você fazer upgrade.' },
  { q: 'Meus dados ficam protegidos?', a: 'Sim. Todo o tráfego é criptografado (HTTPS/TLS). Seguimos as diretrizes da LGPD e não compartilhamos seus dados com terceiros.' },
  { q: 'Tem período de teste ou garantia?', a: 'São 7 dias de garantia total. Se não ficar satisfeito por qualquer motivo, devolvemos 100% do valor sem perguntas.' },
]

/* ─────────────────────────────────────────────────────────────────────────
   Seções
   ──────────────────────────────────────────────────────────────────────── */

export default function ScrollLandingSections() {
  return (
    <>
      {/* ── PROBLEMA ────────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-[#05070d] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <Eyebrow>Por que você ainda perde vendas</Eyebrow>
            <SectionTitle>
              Você investe em anúncios,
              <br />
              <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                mas não sabe o que acontece depois do clique.
              </span>
            </SectionTitle>
            <Lead>
              Cada plataforma mostra só um pedaço. Você olha números isolados e decide no escuro —
              enquanto o dinheiro escorre pelo ralo.
            </Lead>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {PROBLEMAS.map((p) => (
              <div
                key={p.tag}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <span className="inline-block rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                  {p.tag}
                </span>
                <p className="mt-4 text-[15px] leading-[1.6] text-slate-300/85">{p.text}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-6 text-center text-[15px] leading-relaxed text-slate-200 sm:text-base">
            Sem visibilidade do funil, você paga para aprender o que já deveria saber —{' '}
            <span className="text-sky-300">
              e quem tem essa visão está escalando enquanto você fica no escuro.
            </span>
          </p>
        </div>
      </section>

      {/* ── SOLUÇÃO ─────────────────────────────────────────────────────── */}
      <section className="bg-black px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <Eyebrow>Como o FlowSara resolve</Eyebrow>
            <SectionTitle>
              Tudo conectado, tudo visível,
              <br />
              <span className="text-slate-400">do anúncio até o dinheiro na conta.</span>
            </SectionTitle>
            <Lead>
              Você não precisa entender de analytics. A IA lê tudo por você e fala em português
              o que precisa mudar para vender mais.
            </Lead>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUCOES.map((s) => (
              <div
                key={s.title}
                className={[
                  'rounded-2xl border p-7 transition',
                  s.destaque
                    ? 'border-sky-400/30 bg-gradient-to-b from-sky-500/15 to-sky-500/[0.03]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                ].join(' ')}
              >
                <div
                  className={[
                    'mb-5 grid h-11 w-11 place-items-center rounded-xl border',
                    s.destaque
                      ? 'border-sky-400/30 bg-sky-400/15 text-sky-300'
                      : 'border-white/10 bg-white/[0.06] text-slate-300',
                  ].join(' ')}
                >
                  <s.icon className="h-5 w-5" />
                </div>
                {s.destaque && (
                  <span className="mb-2 inline-block text-[10px] font-bold uppercase tracking-widest text-sky-400">
                    Nosso diferencial
                  </span>
                )}
                <h3 className="text-[17px] font-bold tracking-[-0.02em] text-white">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-[1.55] text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SARA.AI ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-white/10 bg-[#05070d] px-6 py-24 sm:py-32">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <Eyebrow>
              <Sparkles className="h-3.5 w-3.5" />
              Desenvolvida para o FlowSara
            </Eyebrow>
            <SectionTitle>
              Conheça a{' '}
              <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
                Sara.AI
              </span>
            </SectionTitle>
            <Lead>
              Sua especialista em funis, vendas e crescimento. Ela entende seu negócio, acompanha
              seus dados em tempo real e transforma métrica em decisão.
            </Lead>
          </div>

          {/* o que ela faz */}
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SARA_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:-translate-y-1 hover:border-sky-400/30 hover:bg-white/[0.05]"
              >
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-[17px] font-bold tracking-[-0.02em] text-white">{f.title}</h3>
                <p className="mt-2 text-[14.5px] leading-[1.55] text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* insights reais */}
          <div className="mt-24">
            <div className="text-center">
              <h3
                className="text-[1.6rem] font-extrabold tracking-[-0.03em] text-white sm:text-[2.1rem]"
                style={display}
              >
                Ela não espera você perguntar
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-400">
                Insights que aparecem sozinhos no painel, com o problema, o número e o que fazer.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-3xl space-y-3">
              {SARA_INSIGHTS.map((i) => (
                <div
                  key={i.titulo}
                  className={[
                    'rounded-xl border px-6 py-5',
                    i.tone === 'red'
                      ? 'border-red-500/25 bg-red-500/[0.07]'
                      : 'border-amber-500/25 bg-amber-500/[0.06]',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3.5">
                    <AlertTriangle
                      className={[
                        'mt-0.5 h-4.5 w-4.5 shrink-0',
                        i.tone === 'red' ? 'text-red-400' : 'text-amber-400',
                      ].join(' ')}
                    />
                    <div>
                      <p
                        className={[
                          'text-[10.5px] font-bold uppercase tracking-[0.16em]',
                          i.tone === 'red' ? 'text-red-400' : 'text-amber-400',
                        ].join(' ')}
                      >
                        {i.nivel}
                      </p>
                      <p className="mt-1.5 text-[15.5px] font-bold text-white">{i.titulo}</p>
                      <p className="mt-1.5 text-[14.5px] leading-[1.55] text-slate-300/80">
                        {i.texto}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* chat */}
          <div className="mt-24">
            <div className="mb-10 text-center">
              <h3
                className="text-[1.6rem] font-extrabold tracking-[-0.03em] text-white sm:text-[2.1rem]"
                style={display}
              >
                E responde qualquer pergunta
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-400">
                Perguntas reais, respostas baseadas nos seus dados.
              </p>
            </div>
            <SaraChatDemo />
          </div>

          {/* conhece tudo */}
          <div className="mt-24 text-center">
            <h3
              className="text-[1.6rem] font-extrabold tracking-[-0.03em] text-white sm:text-[2.1rem]"
              style={display}
            >
              A Sara conhece toda a sua operação
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-400">
              Ela acessa todas as partes do FlowSara para responder com precisão.
            </p>
            <div className="mx-auto mt-9 flex max-w-3xl flex-wrap justify-center gap-2.5">
              {SARA_KNOWS.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13.5px] text-slate-300 transition hover:border-sky-400/40 hover:text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* citação */}
          <blockquote className="mx-auto mt-20 max-w-3xl rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] px-8 py-9 text-center">
            <Sparkles className="mx-auto mb-5 h-7 w-7 text-sky-400" />
            <p className="text-[17px] font-semibold leading-[1.6] text-slate-100 sm:text-[19px]">
              Enquanto outras IAs apenas respondem perguntas, a Sara.AI entende o funcionamento
              completo do FlowSara, analisa seus dados em tempo real e transforma informação em
              decisão de crescimento.
            </p>
          </blockquote>
        </div>
      </section>

      {/* ── COMO FUNCIONA ───────────────────────────────────────────────── */}
      <section className="bg-black px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <Eyebrow>Simples e rápido</Eyebrow>
            <SectionTitle>
              Do zero ao funil rodando{' '}
              <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                em 5 minutos
              </span>
            </SectionTitle>
            <Lead>Sem instalar nada, sem precisar de técnico. Só conectar e ver os dados chegarem.</Lead>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PASSOS.map((p) => (
              <div
                key={p.n}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition hover:border-white/20"
              >
                <span
                  className="pointer-events-none absolute -top-4 right-4 select-none text-[5.5rem] font-extrabold leading-none text-white/[0.05]"
                  style={display}
                >
                  {p.n}
                </span>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-400">
                  Passo {p.n}
                </p>
                <h3 className="mt-3 text-[19px] font-bold tracking-[-0.02em] text-white">
                  {p.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-[1.55] text-slate-400">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Começar agora — é grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── INTEGRAÇÕES ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden border-y border-white/10 bg-[#05070d] py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400">
            Funciona com as plataformas que você já usa — sem código
          </p>
        </div>

        <style>{`
          @keyframes lpMarquee { from { transform: translateX(0) } to { transform: translateX(-33.3333%) } }
          .lp-marquee { animation: lpMarquee 32s linear infinite; will-change: transform }
          .lp-marquee-wrap:hover .lp-marquee { animation-play-state: paused }
        `}</style>

        <div className="lp-marquee-wrap mt-10">
          <div className="lp-marquee flex w-max">
            {[0, 1, 2].map((dup) => (
              <div key={dup} className="flex shrink-0" aria-hidden={dup > 0}>
                {MARCAS.map((m) => (
                  <div
                    key={`${dup}-${m.name}`}
                    className="mx-1.5 grid h-24 w-36 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-white/25 hover:bg-white/[0.07]"
                  >
                    <img
                      src={m.src}
                      alt={m.name}
                      className="h-auto max-h-14 w-auto max-w-[104px] object-contain"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl px-6 text-center">
          <p className="text-[15px] leading-relaxed text-slate-400">
            Todas as ferramentas num único painel — integração rápida, sem precisar de desenvolvedor.
          </p>
        </div>
      </section>

      {/* ── DEPOIMENTOS ─────────────────────────────────────────────────── */}
      <section className="bg-black px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <Eyebrow>Resultados de quem já usa</Eyebrow>
            <SectionTitle>O que dizem nossos clientes</SectionTitle>
            <Lead>Mais de 1.200 produtores digitais e gestores de tráfego usam diariamente.</Lead>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DEPOIMENTOS.map((d) => (
              <div
                key={d.name}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-7 pt-8 transition hover:border-white/20"
              >
                <span className="absolute -top-2.5 left-7 rounded-full border border-sky-400/30 bg-[#0b1220] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  {d.metric}
                </span>
                <div className="mb-4 flex gap-0.5 text-sky-400">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
                <p className="text-[14.5px] leading-[1.6] text-slate-200/90">“{d.text}”</p>
                <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 text-[13px] font-bold text-white">
                    {d.avatar}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-white">{d.name}</p>
                    <p className="text-[12px] text-slate-400">{d.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ──────────────────────────────────────────────────────── */}
      <section id="planos" className="border-t border-white/10 bg-[#05070d] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <Eyebrow>Planos</Eyebrow>
            <SectionTitle>
              7 dias grátis{' '}
              <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                em qualquer plano
              </span>
            </SectionTitle>
            <Lead>
              Teste sem custo e cancele quando quiser — ou pague na hora com PIX, boleto ou cartão.
            </Lead>
          </div>

          <div className="mt-14 grid items-start gap-5 md:grid-cols-3">
            {PLANOS.map((p) => (
              <div
                key={p.nome}
                className={[
                  'flex flex-col rounded-2xl border p-8',
                  p.destaque
                    ? 'border-sky-400/40 bg-gradient-to-b from-sky-500/15 to-sky-500/[0.02] md:-mt-4'
                    : 'border-white/10 bg-white/[0.03]',
                ].join(' ')}
              >
                {p.destaque && (
                  <span className="mb-5 self-start rounded-full bg-sky-400 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
                    Mais popular
                  </span>
                )}
                <h3
                  className="text-[1.6rem] font-extrabold tracking-[-0.02em] text-white"
                  style={display}
                >
                  {p.nome}
                </h3>
                <p className="mt-1 text-[13.5px] text-slate-400">{p.sub}</p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-sm text-slate-400">R$</span>
                  <span
                    className="text-[3rem] font-extrabold leading-none tracking-[-0.04em] text-white"
                    style={display}
                  >
                    {p.preco}
                  </span>
                  <span className="text-sm text-slate-400">/mês</span>
                </div>

                <Link
                  href={`/register?plan=${p.nome}`}
                  className={[
                    'mt-7 rounded-xl py-3 text-center text-sm font-semibold transition',
                    p.destaque
                      ? 'bg-white text-black hover:bg-white/90'
                      : 'border border-white/15 bg-white/[0.06] text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  Testar grátis 7 dias
                </Link>
                <Link
                  href={`/checkout?plan=${p.nome}`}
                  className="mt-2 rounded-xl py-2.5 text-center text-[12.5px] font-medium text-slate-400 transition hover:text-white"
                >
                  Pagar agora (PIX / boleto / cartão)
                </Link>

                <div className="mt-7 space-y-2.5 border-t border-white/10 pt-6">
                  {p.inclui.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-[13.5px] leading-snug text-slate-300">{f}</span>
                    </div>
                  ))}
                  {p.exclui.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                      <span className="text-[13.5px] leading-snug text-slate-600 line-through">
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="bg-black px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Eyebrow>Dúvidas frequentes</Eyebrow>
            <SectionTitle>Perguntas frequentes</SectionTitle>
            <Lead>Tudo que você precisa saber antes de começar.</Lead>
          </div>

          <div className="mt-14 space-y-3">
            {FAQ.map((f, i) => (
              <details
                key={f.q}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition open:border-sky-400/30"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
                  <span className="flex items-center gap-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-400/15 text-[11px] font-bold text-sky-300">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[15.5px] font-semibold tracking-[-0.01em] text-white">
                      {f.q}
                    </span>
                  </span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-lg leading-none text-slate-300 transition group-open:rotate-45 group-open:border-sky-400/40 group-open:text-sky-300">
                    +
                  </span>
                </summary>
                <div className="border-t border-white/10 px-6 pb-6 pt-5 text-[14.5px] leading-[1.65] text-slate-300/85">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/10 bg-[#05070d] px-6 py-28 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl">
          <h2
            className="text-[2.1rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-white sm:text-[3rem]"
            style={display}
          >
            Pronto para descobrir onde seu dinheiro está indo embora?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-slate-300/85 sm:text-[1.0625rem]">
            Crie sua conta gratuitamente e veja seu funil completo em minutos.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Criar conta e ver meu funil
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#planos"
              className="rounded-xl border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Ver planos
            </Link>
          </div>
          <p className="mt-5 text-[12.5px] text-slate-500">
            7 dias grátis · cancele quando quiser · acesso imediato
          </p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-black px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/10">
              <img src="/flowsara-logo.jpg" alt="FlowSara" className="h-full w-full object-cover" />
            </div>
            <span className="text-[15px] font-bold text-slate-200">FlowSara</span>
          </div>
          <div className="flex gap-6 text-[13px]">
            <Link href="/termos" className="text-slate-500 transition hover:text-white">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="text-slate-500 transition hover:text-white">
              Privacidade
            </Link>
            <Link href="/lgpd" className="text-slate-500 transition hover:text-white">
              LGPD
            </Link>
          </div>
          <p className="text-[13px] text-slate-600">© 2026 FlowSara</p>
        </div>
      </footer>
    </>
  )
}
