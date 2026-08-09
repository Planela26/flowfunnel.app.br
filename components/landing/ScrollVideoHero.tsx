'use client'

import { useEffect, useRef } from 'react'
import { useVideoStages } from '@/hooks/useVideoStages'

export type Act = {
  /** Faixa de progresso (0–1) em que o bloco fica visível. */
  at: [number, number]
  /** Lado da tela — sempre o OPOSTO ao monitor naquele trecho. */
  side: 'left' | 'right'
  /**
   * Fração da largura do quadro que está LIVRE nesta parada (0–1), medida no
   * próprio vídeo. O bloco usa esse espaço para se dimensionar: onde o monitor
   * deixa muita parede, o texto respira mais; onde ele ocupa quase tudo, o
   * bloco encolhe em vez de encostar nele.
   */
  free: number
  eyebrow: string
  /**
   * Título. Como `string`, quebra livremente. Como lista, cada item é uma
   * linha que NUNCA se mistura com a seguinte — use quando o título tem duas
   * frases e deixá-las se misturar produziria quebra feia (frase partida ao
   * meio, ponto final órfão no início da linha). Dentro de cada item o texto
   * ainda quebra sozinho se a coluna for estreita.
   */
  title: string | string[]
  body: string
  /**
   * Detalhes do que está na tela. Três formas:
   *  - `string`        → linha corrida, com marcador (uso geral);
   *  - `{label,value}` → linha de dado financeiro: rótulo discreto em cima,
   *    número em destaque embaixo. Serve para comparativos por canal, em que
   *    a leitura é "qual fonte" seguida de "quanto rendeu";
   *  - `{from,to}`     → etapa de funil. A origem sai apagada e o destino vem
   *    destacado: o próprio contraste mostra quanta gente sobrou de um degrau
   *    para o outro, sem precisar desenhar tabela.
   */
  bullets?: (
    | string
    | { label: string; value: string }
    | { from: string; to: string }
  )[]
  /**
   * Frase curta ENTRE os detalhes e os indicadores. Serve de ponte: fecha o
   * argumento logo antes de o olho bater nos números.
   */
  kicker?: string
  /**
   * Legenda curta abaixo dos indicadores. Existe para deixar explícito quando
   * os números são da demonstração exibida, e não uma promessa de resultado.
   */
  note?: string
  stats?: { value: string; label: string; tone?: 'green' | 'sky' | 'plain' }[]
}

type Props = {
  scrollHeightVh?: number
  /** Progresso em que o hero começa e termina de sumir. */
  fadeStart?: number
  fadeEnd?: number
  acts?: Act[]
  /** Hero — renderizado ACIMA do monitor, nunca sobre a tela. */
  children?: React.ReactNode
}

const toneClass = {
  green: 'text-emerald-400',
  sky: 'text-sky-400',
  plain: 'text-slate-100',
} as const

/* ──────────────────────────────────────────────────────────────────────────
   CONFIGURAÇÃO DAS ETAPAS DO VÍDEO — único lugar a mexer.

   `time`  = onde o vídeo fica parado (segundos).
   `enter` = progresso do herói (0–1) em que a transição para essa etapa começa.

   Cada parada foi escolhida analisando o vídeo quadro a quadro, cruzando DUAS
   coisas: a tela que o monitor exibe naquele instante e para que lado do
   quadro ele está deslocado — porque o texto ocupa o lado LIVRE.

     0s   câmera aberta, monitor ao centro ....... herói (texto centralizado)
     16s  monitor 3–67%, livre 33% à direita ..... dashboard geral  → ato 1
     24s  monitor 52–100%, livre 52% à esquerda .. Leads & Contatos → ato 2
     30s  monitor 45–100%, livre 45% à esquerda .. Funil de Conversão → ato 3
     38s  monitor 0–60%, livre 40% à direita ..... Analytics → ato 4
     47s  monitor 48–98%, livre 48% à esquerda ... Analytics (fecho) → ato 5

   RITMO — a etapa 1 dispara no primeiro toque do scroll (2%), e daí em diante
   cada parada seguinte entra a cada 15% de rolagem. Ou seja: o visitante
   encosta na roda e a cena já vai para o primeiro texto; lê; rola ~15%; a cena
   anda sozinha até o próximo texto; e assim por diante.

   As faixas `at` dos ACTS (app/page.tsx) ficam DENTRO da janela em que o vídeo
   está parado, nunca em cima de uma transição: o texto só aparece com a cena
   já assentada.

   Os timestamps são validados contra a duração real do arquivo em runtime;
   qualquer valor acima dela é ajustado sozinho.
   ────────────────────────────────────────────────────────────────────────── */
const STEP = 0.15
const FIRST = 0.02
const VIDEO_STAGES = [
  { time: 0, enter: 0 },
  { time: 16, enter: FIRST },
  { time: 24, enter: FIRST + STEP },
  { time: 30, enter: FIRST + STEP * 2 },
  { time: 38, enter: FIRST + STEP * 3 },
  { time: 47, enter: FIRST + STEP * 4 },
]

/* ── Sincronia texto ↔ imagem ──────────────────────────────────────────────
   O texto de um ato NÃO entra por posição de scroll: ele espera a cena parar.
   Sem isso, um scroll rápido atravessa a faixa em milissegundos e o texto
   aparece por cima do monitor enquanto ele ainda está mudando de lugar.      */

/** Calma exigida depois que a imagem para, antes de o texto começar a entrar. */
const SETTLE_DELAY = 160
/** Velocidade de entrada do texto (por frame) — suave. */
const GATE_IN = 0.075
/** Saída bem mais rápida: assim que a imagem se mexe, o texto some na frente. */
const GATE_OUT = 0.26
/** O herói sai mais rápido ainda: num salto de scroll (âncora, barra puxada)
 *  ele não chega a percorrer o fade e precisa limpar o quadro na hora. */
const HERO_GATE_OUT = 0.45

/* Servidos por app/media/[name]/route.ts — a Hostinger não serve `public/`,
   então a mídia passa por route handler (mesmo motivo dos logos e dos frames).
   O handler responde a Range, sem o que o vídeo não consegue buscar timestamp. */

/** Arquivo servido ao visitante — versão web, gerada do master 2560×1440. */
const VIDEO_SRC = '/media/demo-video-web.mp4'
/** Quadro 1 extraído do próprio vídeo: a cena aparece já no primeiro paint,
 *  então o lead nunca vê tela preta nem aviso de carregamento. */
const POSTER = '/media/demo-poster.jpg'

export default function ScrollVideoHero({
  scrollHeightVh = 700,
  // Termina em 0.02 — exatamente o `enter` da etapa 1. O herói agora entrega a
  // tela no primeiro toque do scroll: apaga e a cena já parte para o texto 1.
  fadeStart = 0,
  fadeEnd = FIRST,
  acts = [],
  children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const actRefs = useRef<(HTMLDivElement | null)[]>([])

  // A máquina de etapas não guarda estado em React: ela recebe o progresso do
  // rAF abaixo, o mesmo que anima os textos. Zero re-render durante o scroll.
  const { onProgress, stateRef } = useVideoStages({
    videoRef,
    stages: VIDEO_STAGES,
    debug: false,
  })

  // Portão de cada ato (0–1), suavizado quadro a quadro.
  const gates = useRef<number[]>([])
  // O herói é o texto da etapa 0 e segue a mesma regra — começa aberto.
  const heroGate = useRef(1)

  // Animações de scroll para hero e textos
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    let raf = 0
    let alive = true

    // Curva de entrada/saída de cada ato
    function actOpacity(p: number, start: number, end: number) {
      if (p < start || p > end) return 0
      const span = end - start
      const inT = Math.min(0.22, span * 0.3)
      const outT = Math.min(0.22, span * 0.3)
      if (p < start + inT) return (p - start) / inT
      if (p > end - outT) return (end - p) / outT
      return 1
    }

    function tick() {
      if (!alive) return
      const rect = wrap!.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0

      // Mesmo progresso que move os textos decide quando o vídeo muda de etapa.
      onProgress(p)

      const st = stateRef.current
      const now = performance.now()

      // Herói: fade de scroll × portão da etapa 0. O portão é o que garante a
      // troca limpa — assim que a imagem começa a sair do plano aberto, o
      // herói some, e só então o ato 1 tem permissão de entrar. Sem isso os
      // dois textos coexistem por um instante sobre o monitor.
      const hero = heroRef.current
      if (hero) {
        const f = (p - fadeStart) / Math.max(0.001, fadeEnd - fadeStart)
        const scrollFade = 1 - Math.min(1, Math.max(0, f))

        const target = st.stage === 0 && !st.transitioning ? 1 : 0
        const prev = heroGate.current
        const speed = target > prev ? GATE_IN : HERO_GATE_OUT
        let g = prev + (target - prev) * speed
        if (Math.abs(target - g) < 0.002) g = target
        heroGate.current = g

        const o = scrollFade * g
        hero.style.opacity = String(o)
        hero.style.transform = `translate3d(0,${(1 - o) * -28}px,0)`
        hero.style.pointerEvents = o < 0.05 ? 'none' : ''
      }

      // Textos dos atos: faixa de scroll × estado real da imagem.
      for (let i = 0; i < acts.length; i++) {
        const el = actRefs.current[i]
        if (!el) continue

        // O ato `i` pertence à etapa `i + 1` (a etapa 0 é o herói).
        // Só libera com a cena parada NESSA etapa e já estabilizada.
        const mine =
          st.stage === i + 1 &&
          !st.transitioning &&
          st.settledAt > 0 &&
          now - st.settledAt >= SETTLE_DELAY

        const prev = gates.current[i] ?? 0
        const target = mine ? 1 : 0
        const speed = target > prev ? GATE_IN : GATE_OUT
        let g = prev + (target - prev) * speed
        if (Math.abs(target - g) < 0.002) g = target
        gates.current[i] = g

        const [s, e] = acts[i].at
        const o = actOpacity(p, s, e) * g
        el.style.opacity = String(o)
        const dir = acts[i].side === 'left' ? -1 : 1
        el.style.transform = `translate3d(${(1 - o) * 26 * dir}px,0,0)`
        el.style.visibility = o <= 0.001 ? 'hidden' : 'visible'
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [acts, fadeStart, fadeEnd, onProgress, stateRef])

  return (
    <div
      ref={wrapRef}
      style={{ height: `${scrollHeightVh}vh` }}
      className="relative w-full bg-black"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        {/* O `poster` é o primeiro quadro: a cena aparece já no primeiro paint,
            então o lead nunca vê tela preta nem aviso de carregamento. */}
        <video
          ref={videoRef}
          className="block h-full w-full object-cover"
          poster={POSTER}
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* ── HERO — acima do monitor ─────────────────────────────────── */}
        {children && (
          <div
            ref={heroRef}
            className="absolute inset-x-0 top-0 z-20 will-change-[opacity,transform]"
          >
            {/* scrim superior para legibilidade */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[130%] bg-gradient-to-b from-black/85 via-black/45 to-transparent" />
            <div className="relative px-6 pt-24 sm:pt-28">{children}</div>
          </div>
        )}

        {/* ── ATOS — texto sempre no lado oposto ao monitor ────────────── */}
        {acts.map((act, i) => (
          <div
            // `eyebrow` é único por ato; `title` deixou de servir de chave
            // quando passou a aceitar lista de linhas.
            key={act.eyebrow}
            ref={(el) => {
              actRefs.current[i] = el
            }}
            style={{ opacity: 0, visibility: 'hidden' }}
            className={[
              'absolute z-20 flex will-change-[opacity,transform]',
              // Mobile: o monitor ocupa o quadro inteiro — não há lado livre,
              // então o texto ancora no rodapé. Desktop: lado oposto ao monitor.
              'inset-0 items-end sm:inset-y-0 sm:inset-x-auto sm:items-center',
              act.side === 'left' ? 'sm:left-0' : 'sm:right-0',
            ].join(' ')}
          >
            {/* scrim mobile: de baixo para cima */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/85 to-transparent sm:hidden" />
            {/* scrim desktop: direcional */}
            <div
              className={[
                'pointer-events-none absolute inset-0 -z-10 hidden sm:block',
                act.side === 'left'
                  ? 'bg-gradient-to-r from-black/95 via-black/70 to-transparent'
                  : 'bg-gradient-to-l from-black/95 via-black/70 to-transparent',
              ].join(' ')}
            />
            {/* Tipografia fluida em PX de propósito: a raiz deste site é 14px,
                então `rem` encolheria todos os tetos em 12,5% e o bloco voltaria
                a parecer pequeno numa tela grande. O piso do clamp protege o
                mobile, onde o vw é pequeno. */}
            <div
              // A largura sai do espaço livre daquela parada, menos uma margem
              // de respiro até o monitor. O teto de 660px é de leitura: linhas
              // mais longas que isso cansam, mesmo sobrando parede.
              style={
                {
                  // Teto de 750px serve ao TÍTULO, que é tipografia de display
                  // e aguenta linha longa. O corpo e os detalhes têm medida de
                  // leitura própria (560px) logo abaixo, então abrir o bloco
                  // não produz linha de texto corrido comprida demais.
                  '--act-w': `clamp(360px, calc(${act.free} * 100vw - 56px), 750px)`,
                } as React.CSSProperties
              }
              className={[
                // Respiro (56px na largura) e padding (32px) são enxutos de
                // propósito: cada pixel gasto aqui sai da coluna de texto, e o
                // título precisa de medida para caber em até 3 linhas.
                // O ritmo VERTICAL segue a altura da viewport: o bloco é
                // centralizado, então estourar não gera rolagem — corta o topo
                // e o rodapé. Em telas baixas (1366×768) o ato mais longo
                // passava de 768px; com vh o espaçamento comprime junto.
                'w-full px-6 pb-9 pt-8 sm:w-[var(--act-w)] sm:px-8 sm:py-[clamp(20px,4vh,44px)]',
                act.side === 'left' ? 'text-left' : 'text-left sm:text-right',
              ].join(' ')}
            >
              <p className="text-[clamp(11px,0.7vw,13px)] font-bold uppercase tracking-[0.22em] text-sky-400">
                {act.eyebrow}
              </p>
              {/* O título escala pela LARGURA DA COLUNA (--act-w), não pelo
                  viewport: quem limita o número de linhas é a coluna, e ela
                  varia por ato conforme o monitor ocupa mais ou menos quadro.
                  Escalar pelo viewport obrigava a usar o menor denominador
                  comum, encolhendo o título mesmo nos atos com parede sobrando.
                  `text-balance` distribui as linhas e evita a palavra órfã. */}
              <h2
                className="mt-4 text-balance text-[clamp(40px,calc(var(--act-w)*0.0878),60px)] font-extrabold leading-[1] tracking-[-0.03em] text-[#F4F7FB] sm:mt-[clamp(12px,2vh,22px)] sm:text-[clamp(44px,calc(var(--act-w)*0.0878),60px)]"
                style={{ fontFamily: 'var(--font-display), Inter, sans-serif' }}
              >
                {Array.isArray(act.title)
                  ? act.title.map((linha) => (
                      <span key={linha} className="block text-balance">
                        {linha}
                      </span>
                    ))
                  : act.title}
              </h2>
              {/* Medida de leitura própria (máx. 560px): mesmo com o bloco
                  largo, linha comprida demais cansa. `text-pretty` evita órfãs. */}
              <p
                className={[
                  'mt-4 max-w-[560px] text-pretty text-[clamp(16px,1.35vw,20px)] font-normal leading-[1.5] text-slate-300/90 sm:mt-[clamp(12px,2.2vh,26px)]',
                  act.side === 'right' ? 'sm:ml-auto' : '',
                ].join(' ')}
              >
                {act.body}
              </p>

              {act.bullets && (
                <ul
                  className={[
                    // Mesma medida de leitura do corpo: o bloco pode ser largo
                    // para o título, mas a lista não deve virar linha corrida.
                    'mt-6 max-w-[560px] space-y-4 border-t border-white/15 pt-5 sm:mt-[clamp(16px,2.8vh,34px)] sm:space-y-[clamp(10px,1.9vh,22px)] sm:pt-[clamp(14px,2.4vh,28px)]',
                    act.side === 'right' ? 'sm:ml-auto' : '',
                  ].join(' ')}
                >
                  {act.bullets.map((b) =>
                    typeof b === 'string' ? (
                      <li
                        key={b}
                        className={[
                          'flex items-start gap-3.5',
                          // Marcador acompanha o lado: à direita ele fica depois
                          // do texto, para a coluna continuar alinhada na borda.
                          act.side === 'right' ? 'sm:flex-row-reverse' : '',
                        ].join(' ')}
                      >
                        <span className="mt-[0.7em] h-px w-4 shrink-0 bg-sky-400/70 sm:w-5" />
                        <span className="text-[clamp(15px,1.05vw,17px)] leading-[1.5] text-slate-300/85">
                          {b}
                        </span>
                      </li>
                    ) : 'from' in b ? (
                      // Etapa de funil. A origem fica apagada e o destino vem
                      // destacado: o contraste ENTRE os dois é que comunica a
                      // perda de um degrau para o outro — é a informação que
                      // importa aqui, e dispensa desenhar uma tabela.
                      <li
                        key={b.from}
                        className={[
                          'flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[clamp(16px,1.15vw,18px)] leading-[1.4]',
                          act.side === 'right' ? 'sm:justify-end' : '',
                        ].join(' ')}
                      >
                        <span className="tabular-nums text-slate-400/75">
                          {b.from}
                        </span>
                        <span aria-hidden className="text-sky-400/80">
                          →
                        </span>
                        <span className="font-semibold tabular-nums text-slate-100">
                          {b.to}
                        </span>
                      </li>
                    ) : (
                      // Linha de dado: rótulo discreto por cima, número embaixo.
                      // A separação vertical faz o olho comparar os valores em
                      // coluna, que é como se lê um comparativo por canal.
                      <li key={b.label}>
                        <p className="text-[clamp(10.5px,0.66vw,12px)] font-semibold uppercase tracking-[0.16em] text-slate-400/80">
                          {b.label}
                        </p>
                        <p className="mt-1 text-[clamp(16px,1.1vw,18px)] font-semibold tabular-nums leading-[1.4] tracking-[-0.01em] text-slate-100">
                          {b.value}
                        </p>
                      </li>
                    ),
                  )}
                </ul>
              )}

              {/* Fecha o argumento imediatamente antes dos números — o olho
                  lê a frase e cai nos indicadores como confirmação dela. */}
              {act.kicker && (
                <p
                  className={[
                    'mt-6 max-w-[520px] text-pretty text-[clamp(15px,1.05vw,17px)] font-medium leading-[1.5] text-slate-200 sm:mt-[clamp(14px,2.4vh,28px)]',
                    act.side === 'right' ? 'sm:ml-auto' : '',
                  ].join(' ')}
                >
                  {act.kicker}
                </p>
              )}

              {act.stats && (
                <div
                  className={[
                    'flex gap-9 sm:gap-12',
                    act.kicker
                      ? 'mt-5 sm:mt-[clamp(12px,2.2vh,26px)]'
                      : 'mt-7 sm:mt-[clamp(16px,2.8vh,36px)]',
                    act.side === 'right' ? 'sm:justify-end' : '',
                  ].join(' ')}
                >
                  {act.stats.map((s) => (
                    <div key={s.label}>
                      <div
                        className={[
                          'text-[clamp(36px,3vw,52px)] font-extrabold leading-none tabular-nums tracking-[-0.035em]',
                          toneClass[s.tone ?? 'plain'],
                        ].join(' ')}
                        style={{ fontFamily: 'var(--font-display), Inter, sans-serif' }}
                      >
                        {s.value}
                      </div>
                      <div className="mt-2.5 text-[clamp(10px,0.62vw,12px)] font-semibold uppercase leading-[1.3] tracking-[0.2em] text-slate-400/85">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Deixa explícito que os números vêm da demonstração exibida.
                  Sem isso, um percentual ao lado do produto é lido como
                  promessa de resultado — que é o que não queremos afirmar. */}
              {act.note && (
                <p className="mt-4 text-[clamp(11px,0.72vw,13px)] leading-[1.4] text-slate-500 sm:mt-[clamp(10px,1.8vh,20px)]">
                  {act.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
