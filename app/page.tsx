import Link from 'next/link'
import { Inter_Tight } from 'next/font/google'
import ScrollVideoHero, { type Act } from '@/components/landing/ScrollVideoHero'
import ScrollLandingSections from '@/components/landing/ScrollLandingSections'

// Display: Inter Tight — desenhada para títulos, encaixa com a Inter do corpo.
const display = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

// As faixas de progresso vêm da análise de posição do monitor em cada frame:
// o texto fica SEMPRE no lado oposto ao monitor.
const ACTS: Act[] = [
  {
    at: [0.22, 0.4],
    side: 'right', // monitor à esquerda (centro em ~36%)
    eyebrow: 'Visão geral',
    title: 'Todo o dinheiro numa tela.',
    body:
      'Meta, Google e TikTok somados — e separados. Cliques, leads, CPC e ROI de cada fonte, atualizados sozinhos. E a Sara.AI apontando, em vermelho, o que está travando as vendas hoje.',
    bullets: [
      '5.018.300 impressões e 92.940 cliques somados',
      '6.284 leads com a origem já identificada',
      '“Queda de conversão no checkout mobile: −38%”',
    ],
    stats: [
      { value: '6,76%', label: 'Conversão', tone: 'sky' },
      { value: 'R$ 3,37', label: 'Para cada R$ 1', tone: 'green' },
    ],
  },
  {
    at: [0.43, 0.6],
    side: 'left', // monitor à direita (centro em ~85%)
    eyebrow: 'Leads & contatos',
    title: 'Cada lead com nome, origem e valor.',
    body:
      'De qual anúncio a pessoa veio, em que etapa ela parou e quanto já pagou. Acabou o “não sei de onde veio essa venda”.',
    bullets: [
      'Meta, Google ou TikTok marcado em cada contato',
      'Status: lead, checkout abandonado ou cliente',
      'Receita e nº de eventos por pessoa · exporta em CSV',
    ],
    stats: [
      { value: '75%', label: 'Lead → checkout', tone: 'sky' },
      { value: '50%', label: 'Lead → cliente', tone: 'green' },
    ],
  },
  {
    at: [0.66, 0.84],
    side: 'right', // monitor à esquerda (centro em ~29%)
    eyebrow: 'Funil de conversão',
    title: 'Onde o dinheiro escorre fica óbvio.',
    body:
      'Cinco etapas, uma embaixo da outra, com a porcentagem que sobrevive em cada degrau. Você não procura o vazamento: ele aparece.',
    bullets: [
      '2.847.300 impressões → 52.840 cliques',
      '6.284 conversas no WhatsApp → 2.318 checkouts',
      '2.318 checkouts → 1.186 vendas',
    ],
    stats: [
      { value: '1,9%', label: 'Impressão → clique', tone: 'sky' },
      { value: '51%', label: 'Checkout → venda', tone: 'green' },
    ],
  },
  {
    at: [0.87, 1],
    side: 'left', // monitor à direita (centro em ~72%)
    eyebrow: 'Analytics',
    title: 'Quanto entrou por cada real que saiu.',
    body:
      'Investimento e receita lado a lado, plataforma por plataforma. Com o WhatsApp e o checkout no mesmo relatório — pronto para exportar ou agendar.',
    bullets: [
      'Meta Ads · +R$ 310.252 · ROI 209%',
      'Google Ads · +R$ 147.396 · ROI 236%',
      'TikTok Ads · +R$ 109.262 · ROI 378%',
    ],
    stats: [
      { value: '87%', label: 'Resposta no WhatsApp', tone: 'green' },
      { value: 'R$ 497', label: 'Ticket médio' },
    ],
  },
]

export default function Home() {
  return (
    <main className={`${display.variable} bg-black text-white`}>
      {/* NAV — visível durante toda a experiência */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/15">
              <img src="/flowsara-logo.jpg" alt="FlowSara" className="h-full w-full object-cover" />
            </div>
            <span
              className="text-lg font-bold tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-display), Inter, sans-serif' }}
            >
              FlowSara
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white sm:px-4"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 sm:px-5"
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>

      <ScrollVideoHero frameCount={200} scrollHeightVh={700} acts={ACTS}>
        {/* HERO — ancorado no topo, acima do monitor */}
        <div className="mx-auto max-w-3xl text-center">
          <h1
            className="text-[2.7rem] font-extrabold leading-[1.01] tracking-[-0.04em] text-[#F4F7FB] sm:text-[4.75rem]"
            style={{ fontFamily: 'var(--font-display), Inter, sans-serif' }}
          >
            Seu funil inteiro.
            <br />
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
              Em uma tela só.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16.5px] leading-[1.55] text-slate-200/85 sm:text-[1.25rem]">
            Meta, Google e TikTok Ads conectados ao WhatsApp e aos seus checkouts —
            com ROI real, em tempo real.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-white/90"
            >
              Criar conta grátis
            </Link>
            <Link
              href="#depois"
              className="rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              Ver como funciona
            </Link>
          </div>
        </div>
      </ScrollVideoHero>

      {/* Landing completa, logo abaixo da experiência de vídeo */}
      <div id="depois">
        <ScrollLandingSections />
      </div>
    </main>
  )
}
