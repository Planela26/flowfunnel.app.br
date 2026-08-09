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

// `at` é a janela de scroll em que o vídeo está PARADO nesta etapa (ver
// VIDEO_STAGES em ScrollVideoHero). Ela sozinha não decide quando o texto
// aparece: o componente ainda exige que a imagem esteja parada E estabilizada
// nesta etapa — por isso um scroll rápido nunca joga texto sobre o monitor
// enquanto ele muda de posição.
// `side` é o lado LIVRE do quadro naquela parada, medido no próprio vídeo;
// o monitor fica sempre do lado oposto.
const ACTS: Act[] = [
  {
    at: [0.02, 0.18],
    side: 'right', // 16s · monitor ocupa 3–67%, livre à direita
    free: 0.33,
    eyebrow: 'Visão geral',
    title: 'Do anúncio à venda. Tudo conectado.',
    body:
      'Meta, Google, TikTok, leads, WhatsApp, checkout e receita em uma única visão. E quando os números mudam, a Sara.AI ajuda a identificar o que merece sua atenção.',
    bullets: [
      { label: 'Tráfego consolidado', value: '5.018.300 impressões e 92.940 cliques' },
      { label: 'Atribuição', value: '6.284 leads com origem já identificada' },
      {
        label: 'Insight da Sara.AI',
        value: 'Queda de conversão no checkout mobile: −38%',
      },
    ],
    stats: [
      { value: '6,76%', label: 'Conversão', tone: 'sky' },
      { value: 'R$ 3,37', label: 'Para cada R$ 1 investido', tone: 'green' },
    ],
    note: 'Números da demonstração exibida — cada operação tem os seus.',
  },
  {
    at: [0.17, 0.33],
    side: 'left', // 24s · monitor ocupa 52–100%, livre à esquerda
    free: 0.52,
    eyebrow: 'Leads & contatos',
    // Duas frases, uma por linha: deixá-las se misturarem partia a primeira ao
    // meio e jogava o ponto final para o início da linha seguinte.
    title: ['De onde veio cada cliente.', 'Quanto ele gerou.'],
    body:
      'Relacione origem, etapa e receita no mesmo contato. Assim, aquela venda que antes parecia impossível de atribuir passa a ter contexto.',
    bullets: [
      'Origem do lead identificada por canal',
      'Etapa do funil e status de cada contato',
      'Receita e eventos associados à jornada',
    ],
    kicker: 'Menos achismo. Mais atribuição.',
    stats: [
      { value: '75%', label: 'Lead → checkout', tone: 'sky' },
      { value: '50%', label: 'Lead → cliente', tone: 'green' },
    ],
    note: 'Números da demonstração exibida — cada operação tem os seus.',
  },
  {
    at: [0.32, 0.48],
    side: 'left', // 30s · monitor ocupa 45–100%, livre à esquerda
    free: 0.45,
    eyebrow: 'Funil de conversão',
    title: 'Descubra exatamente onde suas vendas estão travando.',
    body:
      'Do primeiro clique ao pagamento, o FlowSara mostra quantas pessoas avançam — e onde elas deixam de avançar.',
    bullets: [
      { from: '2.847.300 impressões', to: '52.840 cliques' },
      { from: '6.284 conversas no WhatsApp', to: '2.318 checkouts' },
      { from: '2.318 checkouts', to: '1.186 vendas' },
    ],
    stats: [
      { value: '1,9%', label: 'Impressão → clique', tone: 'sky' },
      { value: '51%', label: 'Checkout → venda', tone: 'green' },
    ],
    note: 'Números da demonstração exibida — cada operação tem os seus.',
  },
  {
    at: [0.47, 0.63],
    side: 'right', // 38s · monitor ocupa 0–60%, livre à direita
    free: 0.4,
    eyebrow: 'Analytics',
    title: 'Saiba quanto cada real investido realmente devolve.',
    body:
      'Compare investimento, receita e ROI em um só lugar. O FlowSara conecta suas fontes de tráfego às vendas para mostrar quais canais geram dinheiro — e quais só consomem orçamento.',
    bullets: [
      { label: 'Meta Ads', value: '+R$ 310.252 · ROI 209%' },
      { label: 'Google Ads', value: '+R$ 147.396 · ROI 236%' },
      { label: 'TikTok Ads', value: '+R$ 109.262 · ROI 378%' },
    ],
    stats: [
      { value: '87%', label: 'Respostas no WhatsApp', tone: 'green' },
      { value: 'R$ 497', label: 'Ticket médio' },
    ],
  },
  {
    // Vai até o fim: depois da última parada o texto segura a cena enquanto o
    // visitante rola o restante da seção e sai para o corpo da página.
    at: [0.62, 1],
    side: 'left', // 47s · monitor ocupa 48–98%, livre à esquerda
    free: 0.48,
    eyebrow: 'O dia seguinte',
    title: 'Você abre o painel e a decisão já está pronta.',
    body:
      'Investimento, receita e conversão do período fechados no mesmo relatório — cada número já comparado com o anterior. Você não interpreta planilha: escolhe onde colocar o próximo real.',
    bullets: [
      'Variação de cada métrica contra o período anterior',
      'PDF na hora ou por e-mail, no dia que você marcar',
      'Histórico completo para repetir o que deu certo',
    ],
    stats: [
      { value: '1.165', label: 'Vendas no período', tone: 'green' },
      { value: '+38%', label: 'vs. período anterior', tone: 'sky' },
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

      <ScrollVideoHero scrollHeightVh={700} acts={ACTS}>
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
