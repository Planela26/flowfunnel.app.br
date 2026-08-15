/**
 * Comparação período-a-período — a camada que CALCULA.
 *
 * A Sara não faz conta. Todo número (variação, taxa, custo, média) sai daqui
 * pronto; ao modelo cabe só interpretar. Modelo de linguagem somando receita e
 * calculando porcentagem erra silenciosamente, e um erro desses numa tela de
 * métricas é indistinguível de um dado real.
 *
 * Semântica das métricas — o ponto que motivou este arquivo:
 * `/api/analytics/comparison` chamava de `leads` a contagem de `webhookLog`
 * (platform WHATSAPP, event 'message'), que são MENSAGENS de WhatsApp. Um único
 * lead que troca 20 mensagens virava "20 leads", e a conversão, calculada como
 * `vendas / mensagens`, despencava justamente quando o atendimento conversava
 * mais. Aqui cada nome corresponde ao que é medido, seguindo as mesmas regras do
 * cron de snapshot (`app/api/cron/snapshot`), que é a definição canônica:
 *
 *   conversas          → evento `whatsapp_conversation_started`
 *   leads              → evento `lead_created` (ou prefixo `lead_`)
 *   mensagensWhatsapp  → webhookLog WHATSAPP/message  (era o falso "leads")
 *   vendas / receita   → `lib/sale-events`, sem canceladas e sem duplicar txid
 */

import { prisma } from '@/lib/prisma'
import { isSaleEvent, isCheckoutEvent, isCanceledSale, extractAmount, saleTransactionId } from '@/lib/sale-events'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PeriodMetrics {
  vendas: number
  receita: number
  checkouts: number
  /** Conversas de WhatsApp iniciadas. */
  conversas: number
  /** Leads de verdade — pessoas identificadas, não mensagens. */
  leads: number
  /** Mensagens de WhatsApp recebidas. Volume de atendimento, não de pessoas. */
  mensagensWhatsapp: number
  gasto: number
  /** vendas / leads, em %. null quando não houve lead no período. */
  taxaConversao: number | null
  /** receita / vendas. null quando não houve venda. */
  ticketMedio: number | null
  /** gasto / leads. null quando não houve lead ou não há gasto registrado. */
  custoPorLead: number | null
}

export type ChangeDirection = 'up' | 'down' | 'flat' | 'new' | 'lost'

export interface MetricChange {
  metric: keyof PeriodMetrics
  label: string
  current: number | null
  previous: number | null
  /** Diferença absoluta. null quando algum lado não é comparável. */
  absoluteChange: number | null
  /** Variação percentual. null quando o período anterior é zero (ver `direction`). */
  percentChange: number | null
  direction: ChangeDirection
  /** A variação é boa para o negócio? Custo subindo é ruim; receita subindo é boa. */
  isPositive: boolean | null
}

export interface Anomaly {
  kind: 'volume_up_quality_down' | 'spend_up_return_down' | 'revenue_down_sales_up' | 'conversion_drop'
  severity: 'info' | 'warning'
  /** Texto factual, já com os números. A Sara interpreta; não recalcula. */
  description: string
}

export interface ComparisonResult {
  period: {
    current: { start: string; end: string; label: string }
    previous: { start: string; end: string; label: string }
  }
  current: PeriodMetrics
  previous: PeriodMetrics
  changes: MetricChange[]
  anomalies: Anomaly[]
  /** false quando os dois períodos estão vazios — a Sara deve dizer que não sabe. */
  hasSufficientData: boolean
  /** Ressalvas explícitas (ex.: sem gasto registrado) para a Sara não inventar. */
  notes: string[]
}

// ── Métricas de um período ───────────────────────────────────────────────────

/** Rótulos legíveis, usados nas `changes` e no bloco entregue ao modelo. */
const LABELS: Record<keyof PeriodMetrics, string> = {
  vendas: 'vendas',
  receita: 'receita',
  checkouts: 'checkouts',
  conversas: 'conversas iniciadas',
  leads: 'leads',
  mensagensWhatsapp: 'mensagens de WhatsApp',
  gasto: 'investimento em mídia',
  taxaConversao: 'taxa de conversão',
  ticketMedio: 'ticket médio',
  custoPorLead: 'custo por lead',
}

/** Métricas em que subir é ruim. */
const LOWER_IS_BETTER: ReadonlySet<keyof PeriodMetrics> = new Set(['gasto', 'custoPorLead'])

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Métricas do período.
 *
 * Híbrido igual ao de `/api/analytics/timeseries`: snapshot para os dias já
 * fechados (barato e estável) e eventos ao vivo para o que o snapshot ainda não
 * cobre — inclusive hoje, que é sempre parcial.
 */
export async function getPeriodMetrics(
  userId: string,
  start: Date,
  end: Date,
): Promise<PeriodMetrics> {
  // TODOS os funis do usuário. A rota antiga usava `findFirst`, então PRO (3
  // funis) e SCALE (ilimitados) comparavam só o primeiro e o resto sumia do
  // relatório sem aviso.
  const funnels = await prisma.funnel.findMany({
    where: { userId },
    select: { id: true },
  })
  const funnelIds = funnels.map(f => f.id)

  const [snapshots, events, mensagensWhatsapp] = await Promise.all([
    prisma.metricSnapshot.findMany({
      where: { userId, date: { gte: startOfDay(start), lte: end } },
    }),
    funnelIds.length > 0
      ? prisma.funnelEvent.findMany({
          where: { funnelId: { in: funnelIds }, timestamp: { gte: start, lte: end } },
          select: { eventType: true, metadata: true, timestamp: true },
        })
      : Promise.resolve([]),
    prisma.webhookLog.count({
      where: {
        userId,
        platform: 'WHATSAPP',
        event: 'message',
        createdAt: { gte: start, lte: end },
      },
    }),
  ])

  // Dias cobertos por snapshot — os eventos desses dias não são recontados.
  const coveredDays = new Set(snapshots.map(s => dayKey(new Date(s.date))))

  let vendas = 0, receita = 0, checkouts = 0, conversas = 0, leads = 0, gasto = 0

  for (const s of snapshots) {
    vendas    += s.vendas
    receita   += s.receita
    checkouts += s.checkouts
    conversas += s.conversas
    leads     += s.leads
    gasto     += s.gasto
  }

  // Dedup de venda por transação, igual ao snapshot e ao timeseries: o mesmo
  // txid pode chegar por retry de webhook.
  const seenSaleTx = new Set<string>()

  for (const e of events) {
    if (coveredDays.has(dayKey(e.timestamp))) continue

    const t = e.eventType
    let meta: any = {}
    try { meta = JSON.parse(e.metadata || '{}') } catch {}

    if (isSaleEvent(t)) {
      if (isCanceledSale(meta)) continue
      const tx = saleTransactionId(meta)
      if (tx) {
        if (seenSaleTx.has(tx)) continue
        seenSaleTx.add(tx)
      }
      vendas  += 1
      receita += extractAmount(meta)
    } else if (isCheckoutEvent(t)) {
      checkouts += 1
    } else if (t === 'whatsapp_conversation_started') {
      conversas += 1
    } else if (t === 'lead_created' || /^lead_/.test(t)) {
      leads += 1
    }
  }

  return {
    vendas,
    receita: round2(receita),
    checkouts,
    conversas,
    leads,
    mensagensWhatsapp,
    gasto: round2(gasto),
    // Conversão sobre LEADS. Antes era sobre mensagens de WhatsApp, o que fazia
    // a taxa cair quanto mais o time conversasse com o mesmo lead.
    taxaConversao: leads > 0 ? round2((vendas / leads) * 100) : null,
    ticketMedio:   vendas > 0 ? round2(receita / vendas) : null,
    custoPorLead:  leads > 0 && gasto > 0 ? round2(gasto / leads) : null,
  }
}

// ── Variações ────────────────────────────────────────────────────────────────

const COMPARED: (keyof PeriodMetrics)[] = [
  'vendas', 'receita', 'leads', 'conversas', 'mensagensWhatsapp',
  'checkouts', 'gasto', 'taxaConversao', 'ticketMedio', 'custoPorLead',
]

function buildChange(metric: keyof PeriodMetrics, cur: number | null, prev: number | null): MetricChange {
  const label = LABELS[metric]
  const base: Omit<MetricChange, 'direction' | 'isPositive'> = {
    metric, label, current: cur, previous: prev,
    absoluteChange: cur !== null && prev !== null ? round2(cur - prev) : null,
    percentChange: null,
  }

  // Sem base de comparação: só existe num dos lados. Reportar como novo/perdido
  // em vez de "+100%" ou de uma divisão por zero virando Infinity na tela.
  if (prev === null || cur === null) {
    const dir: ChangeDirection = prev === null && cur !== null ? 'new' : cur === null && prev !== null ? 'lost' : 'flat'
    return { ...base, direction: dir, isPositive: null }
  }
  if (prev === 0) {
    return {
      ...base,
      direction: cur > 0 ? 'new' : 'flat',
      isPositive: cur > 0 ? !LOWER_IS_BETTER.has(metric) : null,
    }
  }

  const pct = round2(((cur - prev) / Math.abs(prev)) * 100)
  const direction: ChangeDirection = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const isPositive = pct === 0 ? null : LOWER_IS_BETTER.has(metric) ? pct < 0 : pct > 0

  return { ...base, percentChange: pct, direction, isPositive }
}

// ── Anomalias ────────────────────────────────────────────────────────────────

/**
 * Cruzamentos que um número isolado não revela.
 *
 * É o insumo do diferencial do SCALE: "leads subiram 18% mas a conversão caiu
 * 7%" só aparece olhando duas métricas juntas. Detectado aqui, com os números
 * já prontos, para a Sara não precisar deduzir aritmética.
 */
function detectAnomalies(cur: PeriodMetrics, prev: PeriodMetrics, changes: MetricChange[]): Anomaly[] {
  const by = (m: keyof PeriodMetrics) => changes.find(c => c.metric === m)
  const out: Anomaly[] = []
  const moved = (c?: MetricChange) => c?.percentChange != null && Math.abs(c.percentChange) >= 5

  const leads = by('leads')
  const conv  = by('taxaConversao')
  const gasto = by('gasto')
  const receita = by('receita')
  const vendas = by('vendas')

  if (moved(leads) && leads!.direction === 'up' && moved(conv) && conv!.direction === 'down') {
    out.push({
      kind: 'volume_up_quality_down',
      severity: 'warning',
      description:
        `Leads subiram ${leads!.percentChange}% (de ${prev.leads} para ${cur.leads}), ` +
        `mas a taxa de conversão caiu ${Math.abs(conv!.percentChange!)}% ` +
        `(de ${prev.taxaConversao}% para ${cur.taxaConversao}%).`,
    })
  }

  if (moved(gasto) && gasto!.direction === 'up' && moved(receita) && receita!.direction === 'down') {
    out.push({
      kind: 'spend_up_return_down',
      severity: 'warning',
      description:
        `O investimento em mídia subiu ${gasto!.percentChange}% ` +
        `(de R$ ${prev.gasto} para R$ ${cur.gasto}), enquanto a receita caiu ` +
        `${Math.abs(receita!.percentChange!)}% (de R$ ${prev.receita} para R$ ${cur.receita}).`,
    })
  }

  if (moved(vendas) && vendas!.direction === 'up' && moved(receita) && receita!.direction === 'down') {
    out.push({
      kind: 'revenue_down_sales_up',
      severity: 'info',
      description:
        `O número de vendas subiu ${vendas!.percentChange}% mas a receita caiu ` +
        `${Math.abs(receita!.percentChange!)}% — o ticket médio passou de ` +
        `R$ ${prev.ticketMedio} para R$ ${cur.ticketMedio}.`,
    })
  }

  if (moved(conv) && conv!.direction === 'down' && Math.abs(conv!.percentChange!) >= 20 &&
      !out.some(a => a.kind === 'volume_up_quality_down')) {
    out.push({
      kind: 'conversion_drop',
      severity: 'warning',
      description:
        `A taxa de conversão caiu ${Math.abs(conv!.percentChange!)}% ` +
        `(de ${prev.taxaConversao}% para ${cur.taxaConversao}%).`,
    })
  }

  return out
}

// ── Entrada principal ────────────────────────────────────────────────────────

/**
 * Compara dois períodos e devolve tudo calculado.
 *
 * `previous` é a janela imediatamente anterior de mesma duração, para que a
 * comparação não misture semanas de tamanhos diferentes.
 */
export async function comparePeriods(
  userId: string,
  currentStart: Date,
  currentEnd: Date,
  labels?: { current?: string; previous?: string },
): Promise<ComparisonResult> {
  const duration = currentEnd.getTime() - currentStart.getTime()
  const previousEnd = new Date(currentStart.getTime() - 1)
  const previousStart = new Date(currentStart.getTime() - duration)

  const [current, previous] = await Promise.all([
    getPeriodMetrics(userId, currentStart, currentEnd),
    getPeriodMetrics(userId, previousStart, previousEnd),
  ])

  const changes = COMPARED.map(m => buildChange(m, current[m] as number | null, previous[m] as number | null))
  const anomalies = detectAnomalies(current, previous, changes)

  const notes: string[] = []
  if (current.gasto === 0 && previous.gasto === 0) {
    notes.push('Não há investimento em mídia registrado nestes períodos; custo por lead não pôde ser calculado.')
  }
  if (current.leads === 0 && previous.leads === 0) {
    notes.push('Nenhum lead registrado nos dois períodos; taxa de conversão e custo por lead não se aplicam.')
  }

  const hasSufficientData =
    current.vendas + current.leads + current.conversas + current.mensagensWhatsapp +
    previous.vendas + previous.leads + previous.conversas + previous.mensagensWhatsapp > 0

  return {
    period: {
      current:  { start: currentStart.toISOString(), end: currentEnd.toISOString(), label: labels?.current ?? 'período atual' },
      previous: { start: previousStart.toISOString(), end: previousEnd.toISOString(), label: labels?.previous ?? 'período anterior' },
    },
    current,
    previous,
    changes,
    anomalies,
    hasSufficientData,
    notes,
  }
}

/**
 * Serializa o resultado para o prompt da Sara.
 *
 * Texto e não JSON cru porque o modelo erra menos lendo linhas rotuladas; e com
 * os números já formatados não sobra nada para ele calcular. A instrução final
 * é o que impede o modelo de preencher lacuna com estimativa.
 */
export function formatComparisonForPrompt(r: ComparisonResult): string {
  if (!r.hasSufficientData) {
    return 'COMPARAÇÃO DE PERÍODOS: não há dados suficientes nos períodos solicitados. ' +
      'Diga isso ao usuário e não estime números.'
  }

  const fmt = (c: MetricChange): string => {
    if (c.direction === 'new')  return `${c.label}: ${c.current} (não havia registro no período anterior)`
    if (c.direction === 'lost') return `${c.label}: sem registro agora (era ${c.previous})`
    if (c.percentChange === null) return `${c.label}: ${c.current} (anterior ${c.previous})`
    const sinal = c.percentChange > 0 ? '+' : ''
    return `${c.label}: ${c.current} vs ${c.previous} (${sinal}${c.percentChange}%)`
  }

  const linhas = r.changes.filter(c => c.current !== null || c.previous !== null).map(c => `- ${fmt(c)}`)
  const anom = r.anomalies.length > 0
    ? `\nPONTOS DE ATENÇÃO DETECTADOS:\n${r.anomalies.map(a => `- ${a.description}`).join('\n')}`
    : ''
  const notas = r.notes.length > 0 ? `\nRESSALVAS:\n${r.notes.map(n => `- ${n}`).join('\n')}` : ''

  return `COMPARAÇÃO DE PERÍODOS (${r.period.current.label} vs ${r.period.previous.label}):
${linhas.join('\n')}${anom}${notas}

Estes números já estão calculados. NÃO recalcule, não some e não estime nenhum valor.
Use exatamente os valores acima; se algo não estiver aqui, diga que não tem o dado.`
}

// ── Detecção de pedido de comparação ─────────────────────────────────────────

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const GATILHOS = [
  'compar', 'versus', ' vs ', 'evolu', 'cresc', 'caiu', 'queda', 'aumento',
  'melhor que', 'pior que', 'em relação a', 'mês passado', 'mes passado',
  'periodo anterior', 'período anterior', 'tendência', 'tendencia',
  // Perguntas de mudança e de recorte temporal. Sem estas, "o que mudou nos
  // últimos 30 dias?" não trazia a comparação e a Sara respondia que não tinha
  // dados — mesmo havendo dados — porque o contexto padrão só carrega o
  // snapshot mais recente, não a série do período.
  'mudou', 'mudaram', 'mudança', 'mudanca', 'mudanças', 'mudancas',
  'ultimos 30', 'últimos 30', 'ultimos 7', 'últimos 7', 'ultimos 90', 'últimos 90',
  'melhor periodo', 'melhor período', 'melhor desempenho', 'pior desempenho',
]

export interface DetectedComparison {
  start: Date
  end: Date
  label: string
  previousLabel: string
}

/**
 * A mensagem pede uma comparação de períodos? Qual?
 *
 * Deliberadamente conservador: só dispara com um gatilho explícito ou dois
 * meses citados. Buscar métricas a cada mensagem encareceria toda conversa,
 * e injetar comparação onde ninguém pediu polui o contexto do modelo.
 *
 * Retorna o período ATUAL a analisar — `comparePeriods` deriva o anterior.
 */
export function detectComparisonRequest(message: string, now = new Date()): DetectedComparison | null {
  const texto = message.toLowerCase()
  const mesesCitados = MESES
    .map((nome, idx) => ({ nome, idx }))
    .filter(m => texto.includes(m.nome))

  const temGatilho = GATILHOS.some(g => texto.includes(g))
  if (!temGatilho && mesesCitados.length < 2) return null

  // Mês nomeado: compara aquele mês com o imediatamente anterior. Com dois
  // meses citados, o mais recente é o período atual.
  if (mesesCitados.length >= 1) {
    const alvo = mesesCitados[mesesCitados.length - 1]
    // Mês do ano corrente; se ainda não aconteceu, é do ano passado.
    const ano = alvo.idx > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear()
    const start = new Date(ano, alvo.idx, 1)
    const end = new Date(ano, alvo.idx + 1, 0, 23, 59, 59, 999)
    const anterior = MESES[(alvo.idx + 11) % 12]
    return { start, end, label: alvo.nome, previousLabel: anterior }
  }

  // Sem mês nomeado: últimos 30 dias contra os 30 anteriores.
  const end = new Date(now)
  const start = new Date(now)
  start.setDate(now.getDate() - 30)
  return { start, end, label: 'últimos 30 dias', previousLabel: '30 dias anteriores' }
}

// ── Utilitários de data ──────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
