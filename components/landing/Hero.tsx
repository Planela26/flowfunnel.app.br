import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { TRIAL_DAYS } from '@/lib/trial'

const display = { fontFamily: 'var(--font-display), Inter, sans-serif' }

/**
 * Herói estático — sem scroll-jacking.
 *
 * A peça central era um vídeo de 48s (16 MB). Trocado por uma foto do painel:
 * pedir quase um minuto de atenção antes de mostrar qualquer prova é caro, e a
 * imagem entrega a mesma ideia na primeira dobra, sem clique e sem espera.
 *
 * Sem `use client`: não há estado nem ref, então isto é componente de servidor
 * e o topo da página não carrega JS para renderizar.
 *
 * Tipografia em px/clamp() (não rem) porque a raiz do site é 14px/12px —
 * ver app/globals.css.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black px-6 pb-16 pt-24 sm:pb-20 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-[clamp(11px,0.75vw,13px)] font-bold uppercase tracking-[0.22em] text-sky-400">
          FlowSara
        </span>

        <h1
          className="mx-auto mt-5 max-w-4xl text-balance text-[clamp(34px,3.6vw,52px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#F4F7FB]"
          style={display}
        >
          Veja o caminho completo{' '}
          <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
            entre o investimento e a venda.
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-[660px] text-pretty text-[clamp(15px,1.05vw,18px)] leading-[1.5] text-slate-300/90">
          Meta, Google, TikTok, WhatsApp e checkout conectados num só
          painel. Você sabe de onde veio cada cliente, quanto ele gerou e
          onde as vendas estão travando.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-white/90"
          >
            Criar conta grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#planos"
            className="rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            Ver planos
          </Link>
        </div>

        <p className="mt-4 text-[12.5px] text-slate-500">
          Usado desde 2023. Teste grátis por {TRIAL_DAYS} dias, cancele quando quiser.
        </p>
      </div>

      {/* ── Foto do painel ──────────────────────────────────────────────────
          `loading="eager"` + `fetchPriority="high"`: esta é a maior imagem
          acima da dobra, ou seja, o elemento que define o LCP. Marcá-la como
          lazy (o padrão de imagens abaixo da dobra usado no tour) atrasaria a
          própria métrica que ela domina.

          `width`/`height` são os pixels reais do arquivo — sem eles o
          navegador não reserva o espaço antes de baixar, e o texto acima
          salta quando a imagem chega.

          A largura máxima é limitada pela ALTURA da janela, não só pela
          largura — é isto que mantém a foto inteira na primeira dobra.

          A conta é subtrativa, não uma fração fixa da altura: o que está acima
          da foto (topo, título, texto, botões, aviso) mais a legenda abaixo
          NÃO encolhem junto com a tela. Uma fração tipo `41vh` cabia num
          monitor de 922px e vazava num de 768px, porque nesse a parte fixa
          pesa proporcionalmente muito mais. Subtrair o custo fixo de `100vh` e
          dar o resto à foto faz ela caber em qualquer altura.

          São duas constantes porque o custo fixo não é constante: as fontes
          escalam com `vw`, então o bloco de texto mede ~426px em 1366 e ~471px
          em 1920 (medido no navegador). Um valor único ou vazaria na tela
          grande ou encolheria a foto à toa na pequena.

          `clamp` em vez de `min`: o teto de 64rem evita passar da resolução
          real do arquivo, e o piso de 30rem evita o oposto — numa janela muito
          baixa (~650px) a conta pedia 373px de largura, uma foto pequena
          demais para o que ela precisa mostrar. Abaixo desse ponto é melhor
          deixar a legenda escorregar alguns pixels para fora da dobra do que
          entregar a imagem irrelevante.                                    */}
      <div className="relative mx-auto mt-8 max-w-[clamp(30rem,calc((100vh-460px)*1.963),64rem)] sm:mt-10 2xl:max-w-[clamp(30rem,calc((100vh-508px)*1.963),64rem)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-sky-500/10 blur-3xl"
        />
        <img
          src="/media/hero-painel.jpg"
          alt="Painel do FlowSara num monitor: o funil ligando Meta, Google e TikTok ao WhatsApp e aos checkouts, com taxa de conversão e ROI no rodapé."
          width={2000}
          height={1019}
          loading="eager"
          fetchPriority="high"
          className="block w-full rounded-2xl border border-white/10 shadow-[0_40px_120px_-40px_rgba(56,189,248,0.35)]"
        />
        <p className="mt-3 text-center text-[12.5px] text-slate-500">
          Números da demonstração exibida — cada operação tem os seus.
        </p>
      </div>
    </section>
  )
}
