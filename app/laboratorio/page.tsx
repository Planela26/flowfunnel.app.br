'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  FlaskConical, TrendingDown, TrendingUp, DollarSign, Users, ArrowRight,
  X, Loader2, ShieldAlert, RefreshCw, Sparkles, Minus, Target,
} from 'lucide-react'
import { calcularCusto, projetar, type MetricasDeCusto, type Variacao } from '@/lib/owner-metrics'

type Passo = { chave: string; rotulo: string; total: number; taxaDoAnterior: string | null }
type FunilResp = {
  periodoDias: number
  passos: Passo[]
  receita: number
  receitaFormatada: string
  ticketMedioFormatado: string
  taxaConversaoFinal: string
  origens: Array<{ nome: string; visitas: number }>
  campanhas: Array<{ nome: string; vendas: number; receita: number }>
  anuncios: Array<{ adId: string; vendas: number; receita: number }>
  comparacao: Record<string, Variacao> & { diasComparados: number }
  gargalo: { de: string; para: string; taxa: number; taxaFormatada: string; perdidos: number } | null
}

type Analise = {
  resumo: string
  gargalo: string
  dicas: string[]
  campanha: string
  estimativa: string
  semIA?: boolean
}

type Jornada = {
  leadId: string
  origem: string
  campanha: string | null
  ultimoEvento: string | null
  ultimaAtividade: string
  comprou: boolean
  valorFormatado: string | null
}

type Detalhe = {
  lead: {
    leadId: string; utmSource: string | null; utmCampaign: string | null; utmContent: string | null
    fbclid: string | null; campaignId: string | null; adsetId: string | null; adId: string | null
    referrer: string | null; firstUrl: string | null; createdAt: string
  }
  linha: Array<{ evento: string; url: string | null; em: string }>
  venda: { valorFormatado: string; produto: string | null; metodo: string; confianca: number; em: string } | null
}

const ROTULO_EVENTO: Record<string, string> = {
  page_view: 'PageView', scroll_25: 'Scroll 25%', scroll_50: 'Scroll 50%', scroll_60: 'Scroll 60%',
  scroll_75: 'Scroll 75%', scroll_90: 'Scroll 90%', cta_click: 'Clique no CTA',
  checkout_view: 'Checkout', checkout_initiated: 'Checkout iniciado',
  pix_generated: 'Pix gerado', payment_started: 'Pagamento iniciado', payment_approved: 'Compra aprovada',
}

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function LaboratorioPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [funil, setFunil] = useState<FunilResp | null>(null)
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [leadAberto, setLeadAberto] = useState<string | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [dias, setDias] = useState(30)
  const [loading, setLoading] = useState(true)
  const [negado, setNegado] = useState(false)
  const [soComprou, setSoComprou] = useState(false)

  // Custo vem da integração Meta já existente — reusar a rota evita duplicar
  // a chamada à API deles e herda cache, gate de plano e o caso "não conectado".
  const [meta, setMeta] = useState<any>(null)
  const [analise, setAnalise] = useState<Analise | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [erroAnalise, setErroAnalise] = useState('')
  const [investimentoDia, setInvestimentoDia] = useState(50)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [rf, rj, rm] = await Promise.all([
        fetch(`/api/owner/funnel?days=${dias}`),
        fetch(`/api/owner/journeys${soComprou ? '?compras=1' : ''}`),
        fetch('/api/facebook/metrics'),
      ])
      if (rf.status === 403 || rj.status === 403) { setNegado(true); setLoading(false); return }
      setFunil(rf.ok ? await rf.json() : null)
      setJornadas(rj.ok ? (await rj.json()).jornadas ?? [] : [])
      setMeta(rm.ok ? await rm.json() : null)
      setAnalise(null) // período mudou: a leitura anterior não vale mais
    } catch { /* mantém tela anterior em falha de rede */ }
    setLoading(false)
  }, [dias, soComprou])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      if ((session?.user as any)?.role !== 'ADMIN') { router.push('/dashboard'); return }
      carregar()
    }
  }, [status, session, carregar, router])

  const abrirJornada = async (leadId: string) => {
    setLeadAberto(leadId)
    setCarregandoDetalhe(true)
    setDetalhe(null)
    try {
      const r = await fetch(`/api/owner/journeys/${encodeURIComponent(leadId)}`)
      setDetalhe(r.ok ? await r.json() : null)
    } catch { setDetalhe(null) }
    setCarregandoDetalhe(false)
  }

  // Proteção de tela: redireciona a UX de quem não é o Owner. A proteção REAL
  // é no backend (as três rotas /api/owner/* devolvem 403 independentemente
  // disto) — mesmo alguém que force a URL não vê dado nenhum, só uma tela
  // vazia com este aviso.
  if (negado) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-gray-400" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Acesso restrito</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          O Laboratório é exclusivo da conta que administra o marketing do FlowSara.
        </p>
      </div>
    )
  }

  // Investimento real vindo da Meta. `connected: false` → null, e a partir daí
  // CAC/ROAS/ROI viram "—" em vez de números que fingem certeza.
  const investimento: number | null =
    meta?.connected && typeof meta?.raw?.spend === 'number' ? meta.raw.spend : null

  const passoPorChave = (c: string) => funil?.passos.find(p => p.chave === c)?.total ?? 0
  const vendas = passoPorChave('compras')

  const custo: MetricasDeCusto | null = funil
    ? calcularCusto({
        investimento,
        receita: funil.receita,
        vendas,
        checkouts: passoPorChave('checkout'),
      })
    : null

  const projecao = funil
    ? projetar({
        investimentoNoPeriodo: investimento,
        receitaNoPeriodo: funil.receita,
        vendasNoPeriodo: vendas,
        diasDoPeriodo: funil.periodoDias,
        investimentoDiarioPretendido: investimentoDia,
        diasProjetados: 30,
      })
    : null

  const pedirAnalise = async () => {
    if (!funil) return
    setAnalisando(true); setErroAnalise('')
    try {
      const r = await fetch('/api/owner/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...funil, custo }),
      })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Não foi possível gerar a análise.')
      setAnalise(b)
    } catch (e: any) {
      setErroAnalise(e.message)
    }
    setAnalisando(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <FlaskConical className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Laboratório da Sara.ai</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Funil próprio do FlowSara: anúncio → landing → checkout → compra
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dias}
            onChange={e => setDias(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <button onClick={carregar} className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !funil ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !funil || funil.passos[0]?.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Sem dados disponíveis</p>
          <p className="mt-1 text-xs text-gray-400">
            O laboratório enche sozinho conforme visitantes chegam ao flowsara.com.br por um anúncio.
          </p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metrica icone={<Users className="h-3.5 w-3.5" />} rotulo="Visitas na LP" valor={funil.passos[0].total.toLocaleString('pt-BR')} />
            <Metrica icone={<DollarSign className="h-3.5 w-3.5" />} rotulo="Receita" valor={funil.receitaFormatada} destaque />
            <Metrica icone={<TrendingDown className="h-3.5 w-3.5" />} rotulo="Conversão final" valor={funil.taxaConversaoFinal} />
            <Metrica icone={<DollarSign className="h-3.5 w-3.5" />} rotulo="Ticket médio" valor={funil.ticketMedioFormatado} />
          </div>

          {funil.gargalo && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-900/20">
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                <strong>Maior gargalo:</strong> entre <strong>{funil.gargalo.de} → {funil.gargalo.para}</strong>,
                com apenas {funil.gargalo.taxaFormatada} de passagem
                — {funil.gargalo.perdidos.toLocaleString('pt-BR')} pessoas se perdem aqui.
              </p>
            </div>
          )}

          {/* Custo e retorno — depende da conta Meta conectada */}
          {custo && (
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Custo e retorno</p>
                {investimento === null && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800">
                    conta de anúncios não conectada
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Metrica rotulo="Investido" valor={custo.investimentoFormatado} icone={<DollarSign className="h-3.5 w-3.5" />} />
                <Metrica rotulo="CAC" valor={custo.cac} icone={<Target className="h-3.5 w-3.5" />} />
                <Metrica rotulo="CPA" valor={custo.cpa} icone={<Target className="h-3.5 w-3.5" />} />
                <Metrica rotulo="ROAS" valor={custo.roas} icone={<TrendingUp className="h-3.5 w-3.5" />} destaque={custo.roas !== '—' && parseFloat(custo.roas) >= 1} />
                <Metrica rotulo="ROI" valor={custo.roi} icone={<TrendingUp className="h-3.5 w-3.5" />} />
                <Metrica rotulo="Lucro" valor={custo.lucro} icone={<DollarSign className="h-3.5 w-3.5" />} />
              </div>
              {investimento === null && (
                <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
                  Estes números exigem o custo do anúncio, que só a Meta tem. Conecte a conta em
                  Integrações para que CAC, ROAS e ROI passem a ser calculados — sem isso, eles
                  ficam em branco em vez de exibir um valor que não corresponde à realidade.
                </p>
              )}
            </div>
          )}

          {/* Comparação com o período anterior */}
          {funil.comparacao && (
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                Últimos {funil.periodoDias} dias vs. {funil.periodoDias} anteriores
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {([
                  ['Visitas', funil.comparacao.visitas],
                  ['CTA', funil.comparacao.cta],
                  ['Checkout', funil.comparacao.checkout],
                  ['Vendas', funil.comparacao.vendas],
                  ['Receita', funil.comparacao.receita],
                  ['Ticket médio', funil.comparacao.ticketMedio],
                ] as Array<[string, Variacao]>).map(([rotulo, v]) => (
                  <Comparativo key={rotulo} rotulo={rotulo} v={v} />
                ))}
              </div>
            </div>
          )}

          {/* Funil em degraus */}
          <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-500">Jornada</p>
            <div className="space-y-1">
              {funil.passos.map((p, i) => {
                const largura = funil.passos[0].total > 0 ? Math.max(6, (p.total / funil.passos[0].total) * 100) : 0
                return (
                  <div key={p.chave}>
                    {i > 0 && (
                      <div className="flex items-center gap-2 py-1 pl-2 text-[11px] text-gray-400">
                        <ArrowRight className="h-3 w-3" />
                        {p.taxaDoAnterior && <span>{p.taxaDoAnterior}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="w-40 shrink-0 text-xs font-medium text-gray-600 dark:text-gray-300">{p.rotulo}</div>
                      <div className="h-7 flex-1 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        <div
                          className="flex h-full items-center justify-end rounded-lg bg-purple-500 px-2 text-[11px] font-bold text-white transition-all"
                          style={{ width: `${largura}%` }}
                        >
                          {p.total.toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Breakdowns */}
          <div className="mb-8 grid gap-4 lg:grid-cols-3">
            <Tabela titulo="Origem" linhas={funil.origens.map(o => [o.nome, o.visitas.toLocaleString('pt-BR')])} vazio="Sem visitas no período" />
            <Tabela titulo="Campanha" linhas={funil.campanhas.map(c => [c.nome, c.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })])} vazio="Sem vendas atribuídas" />
            <Tabela titulo="Anúncio" linhas={funil.anuncios.map(a => [a.adId, a.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })])} vazio="Sem vendas atribuídas" />
          </div>

          {/* Projeção */}
          {projecao && (
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Projeção para 30 dias</p>
              {!projecao.possivel ? (
                <p className="text-xs text-gray-400">{projecao.motivo}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-4">
                    <label className="text-xs text-gray-500">
                      Investimento diário
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-sm text-gray-400">R$</span>
                        <input
                          type="number"
                          min={1}
                          value={investimentoDia}
                          onChange={e => setInvestimentoDia(Math.max(1, Number(e.target.value) || 1))}
                          className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </label>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">Vendas estimadas</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{projecao.vendasProjetadas}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">Receita estimada</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">{projecao.receitaProjetadaFormatada}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800">
                      confiança {projecao.confianca}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
                    Projeção estatística, não garantia. Extrapola linearmente a taxa observada no
                    período e não considera sazonalidade, saturação de público nem desgaste de
                    criativo — três coisas que costumam derrubar o resultado real abaixo da conta.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Análise da Sara */}
          <div className="mb-6 rounded-2xl border border-purple-200 bg-white p-5 dark:border-purple-900/50 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Análise da Sara.ai</p>
              </div>
              <button
                onClick={pedirAnalise}
                disabled={analisando}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {analisando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {analise ? 'Analisar de novo' : 'Analisar funil'}
              </button>
            </div>

            {erroAnalise && <p className="text-xs text-red-500">{erroAnalise}</p>}

            {!analise && !analisando && !erroAnalise && (
              <p className="text-xs text-gray-400">
                A Sara lê os degraus, as taxas, a comparação com o período anterior e a receita por
                criativo, e aponta onde o dinheiro está sendo perdido.
              </p>
            )}

            {analise && (
              <div className="space-y-3">
                <Bloco titulo="Leitura geral" texto={analise.resumo} />
                <Bloco titulo="Gargalo" texto={analise.gargalo} destaque />
                {analise.dicas?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ações</p>
                    <div className="space-y-1.5">
                      {analise.dicas.map((d, i) => (
                        <div key={i} className="flex gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                          <span className="text-[10px] font-bold text-purple-500">{i + 1}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-200">{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Bloco titulo="Campanha e criativo" texto={analise.campanha} />
                <Bloco titulo="Se o gargalo for corrigido" texto={analise.estimativa} />
                <p className="text-[10px] text-gray-400">Sara.ai · resultados podem variar</p>
              </div>
            )}
          </div>

          {/* Jornadas individuais */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Jornadas individuais</p>
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" checked={soComprou} onChange={e => setSoComprou(e.target.checked)} className="rounded" />
                Só quem comprou
              </label>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {jornadas.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Nenhuma jornada encontrada.</p>
              )}
              {jornadas.map(j => (
                <button
                  key={j.leadId}
                  onClick={() => abrirJornada(j.leadId)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-mono text-gray-400">{j.leadId}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{j.origem}</span>
                      {j.comprou && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">Comprou</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {ROTULO_EVENTO[j.ultimoEvento || ''] || j.ultimoEvento || '—'} · {fmtHora(j.ultimaAtividade)}
                    </p>
                  </div>
                  {j.valorFormatado && <span className="shrink-0 text-sm font-bold text-green-600 dark:text-green-400">{j.valorFormatado}</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal de jornada individual */}
      {leadAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setLeadAberto(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <p className="font-mono text-xs text-gray-500">{leadAberto}</p>
              <button onClick={() => setLeadAberto(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-4">
              {carregandoDetalhe ? (
                <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></div>
              ) : !detalhe ? (
                <p className="py-6 text-center text-xs text-gray-400">Jornada não encontrada.</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                    <Campo rotulo="Origem" valor={detalhe.lead.utmSource || 'Direto'} />
                    <Campo rotulo="Campanha" valor={detalhe.lead.utmCampaign} />
                    <Campo rotulo="Anúncio" valor={detalhe.lead.adId} />
                    <Campo rotulo="fbclid" valor={detalhe.lead.fbclid} />
                  </div>

                  {detalhe.venda && (
                    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-900/20">
                      <p className="text-sm font-bold text-green-700 dark:text-green-300">
                        Compra confirmada · {detalhe.venda.valorFormatado}
                      </p>
                      <p className="mt-0.5 text-[11px] text-green-600 dark:text-green-400">
                        {detalhe.venda.produto} · {fmtHora(detalhe.venda.em)}
                      </p>
                    </div>
                  )}

                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Linha do tempo</p>
                  <div className="space-y-0">
                    {detalhe.linha.map((e, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                          {i < detalhe.linha.length - 1 && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {ROTULO_EVENTO[e.evento] || e.evento}
                          </p>
                          <p className="text-[10px] text-gray-400">{fmtHora(e.em)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Indicador comparado entre períodos.
 *
 * A cor vem de `melhorou`, não da direção da seta: CAC subindo é vermelho,
 * receita subindo é verde. Pintar pela direção faria um custo em alta parecer
 * boa notícia.
 */
function Comparativo({ rotulo, v }: { rotulo: string; v: Variacao }) {
  const Icone = v.direcao === 'sobe' ? TrendingUp : v.direcao === 'desce' ? TrendingDown : Minus
  const cor =
    v.melhorou === null ? 'text-gray-400'
    : v.melhorou ? 'text-green-600 dark:text-green-400'
    : 'text-red-500 dark:text-red-400'

  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white">
        {rotulo === 'Receita' || rotulo === 'Ticket médio'
          ? v.atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : v.atual.toLocaleString('pt-BR')}
      </p>
      <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${cor}`}>
        <Icone className="h-3 w-3" />
        {v.variacao}
      </p>
    </div>
  )
}

function Bloco({ titulo, texto, destaque }: { titulo: string; texto: string; destaque?: boolean }) {
  if (!texto) return null
  return (
    <div className={`rounded-lg px-3 py-2.5 ${destaque ? 'border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{titulo}</p>
      <p className={`text-xs leading-relaxed ${destaque ? 'text-amber-800 dark:text-amber-200' : 'text-gray-700 dark:text-gray-200'}`}>{texto}</p>
    </div>
  )
}

function Metrica({ icone, rotulo, valor, destaque }: { icone: React.ReactNode; rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-1.5 text-gray-400">{icone}<span className="text-[10px] uppercase tracking-wide">{rotulo}</span></div>
      <p className={`mt-1 text-lg font-bold ${destaque ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{valor}</p>
    </div>
  )
}

function Tabela({ titulo, linhas, vazio }: { titulo: string; linhas: [string, string][]; vazio: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-xs text-gray-400">{vazio}</p>
      ) : (
        <div className="space-y-2">
          {linhas.slice(0, 6).map(([nome, valor], i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-gray-600 dark:text-gray-300">{nome}</span>
              <span className="shrink-0 text-xs font-bold text-gray-900 dark:text-white">{valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-1.5 dark:bg-gray-800">
      <p className="text-[9px] uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">{valor || '—'}</p>
    </div>
  )
}
