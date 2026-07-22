import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFeature } from '@/lib/withPlan'

type Granularity = 'week' | 'month'
type Direction = 'rising' | 'stable' | 'falling'
type KpiKey = 'vendas' | 'faturamento' | 'leads' | 'conversao' | 'gasto'

const PURCHASE_EVENT_RX = /_purchase_complete$/

// Eventos de clique em anúncio que carregam custo/spend no metadata.
// Mesmo conjunto usado em /api/{facebook,google,tiktok}/metrics e no
// cron /api/cron/snapshot, para o caso de o dia atual (parcial) não ter
// snapshot ainda persistido.
const AD_CLICK_EVENTS = new Set([
  'facebook_click',
  'meta_ad_click',
  'google_click',
  'google_ad_click',
  'tiktok_click',
  'tiktok_ad_click',
])

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = (day + 6) % 7
  date.setDate(date.getDate() - diff)
  return date
}

function startOfMonth(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function bucketStart(d: Date, granularity: Granularity): Date {
  return granularity === 'month' ? startOfMonth(d) : startOfWeek(d)
}

function startOfDay(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function safeJson(s: string | null | undefined): any {
  if (!s) return {}
  try {
    return typeof s === 'string' ? JSON.parse(s) : s
  } catch {
    return {}
  }
}

function classify(values: number[]): {
  direction: Direction
  pctChangeRecent: number
  pctChangeWindow: number
} {
  const n = values.length
  if (n < 2) return { direction: 'stable', pctChangeRecent: 0, pctChangeWindow: 0 }

  const last = values[n - 1]
  const prev = values[n - 2]
  const pctChangeRecent =
    prev > 0 ? ((last - prev) / prev) * 100 : last > 0 ? 100 : 0

  const half = Math.max(1, Math.floor(n / 2))
  const olderAvg = values.slice(0, half).reduce((a, x) => a + x, 0) / half
  const recentAvg = values.slice(-half).reduce((a, x) => a + x, 0) / half
  const pctChangeWindow =
    olderAvg > 0
      ? ((recentAvg - olderAvg) / olderAvg) * 100
      : recentAvg > 0
        ? 100
        : 0

  let direction: Direction = 'stable'
  if (pctChangeWindow >= 5) direction = 'rising'
  else if (pctChangeWindow <= -5) direction = 'falling'

  return {
    direction,
    pctChangeRecent: Number(pctChangeRecent.toFixed(2)),
    pctChangeWindow: Number(pctChangeWindow.toFixed(2)),
  }
}

function consecutiveDeclines(values: number[]): number {
  let count = 0
  for (let i = values.length - 1; i > 0; i--) {
    if (values[i] < values[i - 1]) count++
    else break
  }
  return count
}

export async function GET(request: Request) {
  try {
    const guard = await requireFeature('trend_analysis')
    if (guard.response) return guard.response
    const { user } = guard

    const { searchParams } = new URL(request.url)
    const granularity: Granularity =
      searchParams.get('granularity') === 'month' ? 'month' : 'week'
    const defaultPeriods = granularity === 'month' ? 6 : 8
    const periods = Math.max(
      3,
      Math.min(12, parseInt(searchParams.get('periods') || `${defaultPeriods}`))
    )

    const now = new Date()
    const today = startOfDay(now)
    const todayYmd = ymd(today)
    // Início do período em curso (semana/mês corrente — INCOMPLETO).
    const currentBucketStart = bucketStart(now, granularity)
    // Último bucket COMPLETO = um período inteiro antes do bucket em curso.
    const lastCompletedStart = new Date(currentBucketStart)
    if (granularity === 'month') {
      lastCompletedStart.setMonth(lastCompletedStart.getMonth() - 1)
    } else {
      lastCompletedStart.setDate(lastCompletedStart.getDate() - 7)
    }
    // Início do primeiro bucket COMPLETO da janela analisada.
    const cutoff = new Date(lastCompletedStart)
    if (granularity === 'month') {
      cutoff.setMonth(cutoff.getMonth() - (periods - 1))
    } else {
      cutoff.setDate(cutoff.getDate() - 7 * (periods - 1))
    }

    type Bucket = {
      key: string
      start: Date
      inProgress: boolean
      vendas: number
      faturamento: number
      conversas: number
      leadEvents: number
      gasto: number
    }

    // Buckets COMPLETOS analisados (usados em classify() e alertas).
    const buckets: Bucket[] = []
    const bucketByKey = new Map<string, Bucket>()
    for (let i = 0; i < periods; i++) {
      const start = new Date(cutoff)
      if (granularity === 'month') start.setMonth(start.getMonth() + i)
      else start.setDate(start.getDate() + 7 * i)
      const key = ymd(start)
      const b: Bucket = {
        key,
        start,
        inProgress: false,
        vendas: 0,
        faturamento: 0,
        conversas: 0,
        leadEvents: 0,
        gasto: 0,
      }
      buckets.push(b)
      bucketByKey.set(key, b)
    }

    // Bucket EM CURSO (semana/mês atual, parcial). NÃO entra em classify()
    // nem nas comparações — comparar período parcial contra período completo
    // gera viés sistemático. Devolvemos separado para que a UI possa exibir
    // como "em curso".
    const inProgressBucket: Bucket = {
      key: ymd(currentBucketStart),
      start: new Date(currentBucketStart),
      inProgress: true,
      vendas: 0,
      faturamento: 0,
      conversas: 0,
      leadEvents: 0,
      gasto: 0,
    }

    function bucketForDate(d: Date): Bucket | undefined {
      const startKey = ymd(bucketStart(d, granularity))
      if (startKey === inProgressBucket.key) return inProgressBucket
      return bucketByKey.get(startKey)
    }

    // 1) Snapshots para dias passados (canônicos: vendas/receita/conversas/leads/gasto)
    const snapshots = await prisma.metricSnapshot.findMany({
      where: {
        userId: user.id,
        date: { gte: cutoff },
      },
      select: {
        date: true,
        vendas: true,
        receita: true,
        conversas: true,
        leads: true,
        gasto: true,
      },
    })

    // Dias cobertos por snapshot (chave YYYY-MM-DD) e dias cujo gasto
    // precisa ser recomputado a partir de eventos (snapshots criados antes
    // da coluna `gasto` existir terão gasto = 0).
    const snapshotDays = new Set<string>()
    const gastoBackfillDays = new Set<string>()
    for (const snap of snapshots) {
      const dayKey = ymd(snap.date)
      // O dia de hoje é sempre parcial: se houver snapshot dele, ignoramos
      // — os eventos de hoje cobrem tudo.
      if (dayKey === todayYmd) continue
      const b = bucketForDate(snap.date)
      if (!b) continue
      b.vendas += snap.vendas
      b.faturamento += snap.receita
      b.conversas += snap.conversas
      b.leadEvents += snap.leads
      b.gasto += snap.gasto
      snapshotDays.add(dayKey)
      if (snap.gasto === 0) gastoBackfillDays.add(dayKey)
    }

    // 2) Determina os dias da janela que precisam de leitura de eventos.
    // Dias SEM snapshot (incluindo hoje e qualquer gap) precisam de tudo.
    // Dias COM snapshot mas gasto=0 só precisam de eventos de gasto
    // (rollout: backfill de gasto a partir de event metadata para snapshots
    //  antigos que ainda não tinham essa coluna).
    const windowEndForDays = new Date(currentBucketStart)
    if (granularity === 'month') windowEndForDays.setMonth(windowEndForDays.getMonth() + 1)
    else windowEndForDays.setDate(windowEndForDays.getDate() + 7)
    if (windowEndForDays.getTime() < today.getTime() + 86400000) {
      windowEndForDays.setTime(today.getTime() + 86400000)
    }

    const fullEventDays = new Set<string>()
    for (
      let d = new Date(cutoff);
      d < windowEndForDays;
      d.setDate(d.getDate() + 1)
    ) {
      const k = ymd(d)
      if (!snapshotDays.has(k)) fullEventDays.add(k)
    }

    // Carrega só os funis (SCALE permite ilimitado).
    const funnels = await prisma.funnel.findMany({
      where: { userId: user.id },
      select: { id: true },
    })
    const funnelIds = funnels.map(f => f.id)

    function dayBoundsList(days: Set<string>): { since: Date; until: Date } | null {
      if (days.size === 0) return null
      const sorted = Array.from(days).sort()
      const [y0, m0, d0] = sorted[0].split('-').map(Number)
      const [y1, m1, d1] = sorted[sorted.length - 1].split('-').map(Number)
      const since = new Date(y0, (m0 || 1) - 1, d0 || 1)
      const until = new Date(y1, (m1 || 1) - 1, d1 || 1)
      until.setDate(until.getDate() + 1)
      return { since, until }
    }

    // 2a) Eventos COMPLETOS apenas para dias sem snapshot (tipicamente: hoje
    // + lacunas pontuais). Bounded ao range mínimo necessário.
    if (funnelIds.length > 0) {
      const bounds = dayBoundsList(fullEventDays)
      if (bounds) {
        const events = await prisma.funnelEvent.findMany({
          where: {
            funnelId: { in: funnelIds },
            timestamp: { gte: bounds.since, lt: bounds.until },
          },
          select: { eventType: true, metadata: true, timestamp: true },
        })

        for (const ev of events) {
          const evDate = new Date(ev.timestamp)
          const dayKey = ymd(startOfDay(evDate))
          if (!fullEventDays.has(dayKey)) continue
          const b = bucketForDate(evDate)
          if (!b) continue

          const t = ev.eventType
          const meta = safeJson(ev.metadata)

          if (PURCHASE_EVENT_RX.test(t)) {
            if (meta.status === 'canceled') continue
            b.vendas += 1
            const amount = Number(meta.amount ?? meta.price ?? 0)
            if (Number.isFinite(amount)) b.faturamento += amount
          } else if (t === 'whatsapp_conversation_started') {
            b.conversas += 1
          } else if (t === 'lead_created' || /^lead_/.test(t)) {
            b.leadEvents += 1
          } else if (AD_CLICK_EVENTS.has(t)) {
            const cost = Number(meta.cost ?? meta.spend ?? 0)
            if (Number.isFinite(cost) && cost > 0) b.gasto += cost
          }
          // checkouts intencionalmente fora — não é KPI de tendência
        }
      }

      // 2b) BACKFILL de gasto para dias com snapshot mas gasto=0.
      // Query bounded e filtrada APENAS para os event types de clique em
      // anúncio — escopo muito menor que (a). Isto cobre snapshots
      // criados antes de MetricSnapshot.gasto existir (rollout) e
      // permanece correto após o cron passar a popular gasto.
      const gastoBounds = dayBoundsList(gastoBackfillDays)
      if (gastoBounds) {
        const adEvents = await prisma.funnelEvent.findMany({
          where: {
            funnelId: { in: funnelIds },
            eventType: { in: Array.from(AD_CLICK_EVENTS) },
            timestamp: { gte: gastoBounds.since, lt: gastoBounds.until },
          },
          select: { eventType: true, metadata: true, timestamp: true },
        })
        for (const ev of adEvents) {
          const evDate = new Date(ev.timestamp)
          const dayKey = ymd(startOfDay(evDate))
          if (!gastoBackfillDays.has(dayKey)) continue
          const b = bucketForDate(evDate)
          if (!b) continue
          const meta = safeJson(ev.metadata)
          const cost = Number(meta.cost ?? meta.spend ?? 0)
          if (Number.isFinite(cost) && cost > 0) b.gasto += cost
        }
      }
    }

    function projectBucket(b: Bucket) {
      // Leads canônicos: conversas (whatsapp_conversation_started) é a fonte
      // primária; cai para lead_created (b.leadEvents) quando não há conversas.
      const leads = b.conversas > 0 ? b.conversas : b.leadEvents
      return {
        key: b.key,
        start: b.start.toISOString(),
        inProgress: b.inProgress,
        vendas: b.vendas,
        faturamento: Number(b.faturamento.toFixed(2)),
        leads,
        conversao:
          leads > 0 ? Number(((b.vendas / leads) * 100).toFixed(2)) : 0,
        gasto: Number(b.gasto.toFixed(2)),
      }
    }

    // Série analisada — apenas períodos COMPLETOS.
    const series = buckets.map(projectBucket)
    // Período atual (parcial). Devolvemos para a UI exibir como "em curso",
    // mas NUNCA entra em classify()/consecutiveDeclines().
    const inProgress = projectBucket(inProgressBucket)

    const seriesByKey: Record<KpiKey, number[]> = {
      vendas: series.map(s => s.vendas),
      faturamento: series.map(s => s.faturamento),
      leads: series.map(s => s.leads),
      conversao: series.map(s => s.conversao),
      gasto: series.map(s => s.gasto),
    }

    const trends = {} as Record<
      KpiKey,
      ReturnType<typeof classify> & { current: number; previous: number }
    >
    for (const k of Object.keys(seriesByKey) as KpiKey[]) {
      const arr = seriesByKey[k]
      trends[k] = {
        // classify/comparações usam apenas os buckets completos — comparar
        // o período em curso com períodos completos enviesa sistematicamente
        // para baixo e dispara alertas de queda falsos.
        ...classify(arr),
        current: arr[arr.length - 1] ?? 0,
        previous: arr[arr.length - 2] ?? 0,
      }
    }

    const periodWord = granularity === 'month' ? 'meses' : 'semanas'
    const alerts: Array<{
      kpi: KpiKey
      severity: 'warning' | 'critical'
      message: string
      streak: number
    }> = []

    const declineLabels: Record<KpiKey, string> = {
      vendas: 'Vendas',
      faturamento: 'Faturamento',
      leads: 'Leads',
      conversao: 'Conversão',
      gasto: 'Gasto',
    }

    // KPIs onde "queda sustentada" é sinal negativo (precisa de atenção).
    // Para `gasto`, queda é normalmente neutra/positiva — não alertamos.
    // Alertas operam apenas sobre períodos COMPLETOS (seriesByKey).
    const ALERTABLE_KPIS: KpiKey[] = ['vendas', 'faturamento', 'leads', 'conversao']
    for (const k of ALERTABLE_KPIS) {
      const streak = consecutiveDeclines(seriesByKey[k])
      if (streak >= 3) {
        alerts.push({
          kpi: k,
          severity: streak >= 4 ? 'critical' : 'warning',
          message: `${declineLabels[k]} em queda há ${streak} ${periodWord} consecutivos.`,
          streak,
        })
      }
    }

    return NextResponse.json({
      granularity,
      periods,
      windowStart: cutoff.toISOString(),
      // Fim da janela ANALISADA = início do bucket em curso (que NÃO entra
      // na análise). Deixa claro que o período parcial fica fora.
      windowEnd: currentBucketStart.toISOString(),
      funnelCount: funnelIds.length,
      series,
      inProgress,
      trends,
      alerts,
    })
  } catch (error) {
    console.error('Erro na análise de tendências:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
