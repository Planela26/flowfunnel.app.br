import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHistoryLimitDays, normalizePlan } from '@/lib/plans'
import { getDailyInsights } from '@/lib/facebook'
import { isSaleEvent, isCheckoutEvent, isCanceledSale, extractAmount, saleTransactionId } from '@/lib/sale-events'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // Limite de dias é determinado pelo plano (START=7, PRO/SCALE=365)
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    const plan = normalizePlan(dbUser?.plan)
    const planMaxDays = getHistoryLimitDays(plan)
    const requested = Math.max(1, Math.min(planMaxDays, parseInt(searchParams.get('days') || '7')))
    const days = requested

    // `Funnel` (o modelo com etapas e FunnelEvent) é OPCIONAL aqui.
    //
    // Antes a rota devolvia série vazia quando não existia nenhum — e não
    // existe na conta típica, porque o "funil" que se cria na interface é
    // `Workspace`, outro modelo. O gráfico do Analytics ficava em branco mesmo
    // com campanha rodando, leads entrando e vendas atribuídas no banco.
    //
    // Quem tem `Funnel` continua tendo seus eventos considerados; quem não tem
    // agora recebe a série montada a partir das fontes que realmente existem:
    // gasto e cliques da Meta, leads do rastreamento e vendas da atribuição.
    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
    })

    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))

    // Pré-popula o mapa com todas as datas no intervalo
    const map: Record<string, { date: string; vendas: number; receita: number; checkouts: number; conversas: number; cliques: number; gasto: number }> = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setDate(d.getDate() + i)
      const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      map[key] = { date: key, vendas: 0, receita: 0, checkouts: 0, conversas: 0, cliques: 0, gasto: 0 }
    }

    // 1) Tentar usar snapshots para dias passados (mais barato e estável)
    const snapshots = await prisma.metricSnapshot.findMany({
      where: {
        userId: session.user.id,
        date: { gte: since },
      },
    })

    const snapshotDates = new Set<string>()
    for (const snap of snapshots) {
      const d = new Date(snap.date)
      const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      if (map[key]) {
        map[key].vendas    = snap.vendas
        map[key].receita   = snap.receita
        map[key].checkouts = snap.checkouts
        map[key].conversas = snap.conversas
        map[key].cliques   = (snap as any).cliques ?? 0
        map[key].gasto     = (snap as any).gasto   ?? 0
        snapshotDates.add(key)
      }
    }

    // 2) Para dias sem snapshot (e SEMPRE para hoje, que é parcial), agregar eventos em tempo real
    const events = funnel
      ? await prisma.funnelEvent.findMany({
          where: {
            funnelId: funnel.id,
            timestamp: { gte: since },
          },
          orderBy: { timestamp: 'asc' },
          select: { eventType: true, metadata: true, timestamp: true },
        })
      : []

    const today = new Date()
    const todayKey = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`

    // Dedup de vendas: a mesma transação pode chegar por mais de um evento/integração.
    const seenSaleTx = new Set<string>()

    for (const ev of events) {
      const d = new Date(ev.timestamp)
      const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) continue
      // Só usa eventos para dias que NÃO têm snapshot, OU para o dia de hoje (sempre parcial)
      if (snapshotDates.has(key) && key !== todayKey) continue

      if (key === todayKey && snapshotDates.has(key)) {
        // Reseta para evitar dupla contagem caso já existisse snapshot do dia
        map[key].vendas = 0
        map[key].receita = 0
        map[key].checkouts = 0
        map[key].conversas = 0
        map[key].cliques = 0
        map[key].gasto = 0
        snapshotDates.delete(key)
      }

      const t = ev.eventType
      const meta = ev.metadata ? safeJson(ev.metadata as string) : {}

      if (isSaleEvent(t)) {
        if (!isCanceledSale(meta)) {
          const txId = saleTransactionId(meta)
          if (txId && seenSaleTx.has(txId)) continue
          if (txId) seenSaleTx.add(txId)
          map[key].vendas += 1
          map[key].receita += extractAmount(meta)
        }
      } else if (isCheckoutEvent(t)) {
        map[key].checkouts += 1
      } else if (t === 'whatsapp_conversation_started') {
        map[key].conversas += 1
      } else if (['facebook_click', 'google_click', 'tiktok_click'].includes(t)) {
        map[key].cliques += 1
        map[key].gasto += parseFloat(meta.cost || meta.spend || '0') || 0
      }
    }

    // ── 3) Fontes reais, que existem independentemente de Funnel ──────────────
    //
    // O gasto vinha de `FunnelEvent.metadata.cost`, campo que nada preenche
    // hoje: a linha de gasto era sempre zero. Agora vem da Meta, dia a dia.
    // Vendas e leads vêm de SaleAttribution e TrackedLead, que são as tabelas
    // realmente alimentadas pelo produto.
    const chaveDoDia = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

    const [metaIntegration, campanhas, vendasPorDia, leadsPorDia] = await Promise.all([
      prisma.integration.findFirst({
        where: { userId: session.user.id, platform: 'META_ADS', isActive: true },
        select: { accessToken: true, config: true },
      }).catch(() => null),
      prisma.campaign.findMany({
        where: { userId: session.user.id, platform: 'META_ADS' },
        select: { campaignId: true },
        take: 25,
      }).catch(() => []),
      prisma.saleAttribution.findMany({
        where: { userId: session.user.id, createdAt: { gte: since } },
        select: { value: true, createdAt: true },
      }).catch(() => [] as Array<{ value: number; createdAt: Date }>),
      prisma.trackedLead.findMany({
        where: { userId: session.user.id, createdAt: { gte: since } },
        select: { createdAt: true },
      }).catch(() => [] as Array<{ createdAt: Date }>),
    ])

    // Vendas e receita reais sobrescrevem o que veio de FunnelEvent: a
    // atribuição é a fonte final, e o evento de funil é o registro bruto.
    if (vendasPorDia.length > 0) {
      for (const k of Object.keys(map)) { map[k].vendas = 0; map[k].receita = 0 }
      for (const v of vendasPorDia) {
        const k = chaveDoDia(new Date(v.createdAt))
        if (!map[k]) continue
        map[k].vendas += 1
        map[k].receita += v.value || 0
      }
    }

    if (leadsPorDia.length > 0) {
      for (const k of Object.keys(map)) map[k].cliques = 0
      for (const l of leadsPorDia) {
        const k = chaveDoDia(new Date(l.createdAt))
        if (map[k]) map[k].cliques += 1
      }
    }

    if (metaIntegration?.accessToken) {
      try {
        const cfg = typeof metaIntegration.config === 'string'
          ? JSON.parse(metaIntegration.config)
          : (metaIntegration.config ?? {})
        if (cfg?.adAccountId) {
          const preset = days <= 1 ? 'today' : days <= 7 ? 'last_7d' : days <= 30 ? 'last_30d' : 'last_90d'
          const diario = await getDailyInsights(
            metaIntegration.accessToken,
            cfg.adAccountId,
            preset,
            campanhas.map(c => c.campaignId).filter(Boolean) as string[],
          )
          if (diario.success) {
            for (const [iso, v] of Object.entries(diario.porDia)) {
              // `date_start` vem como YYYY-MM-DD; montamos a data em horário
              // local para cair no mesmo rótulo dd/mm usado no mapa.
              const [y, m, dd] = iso.split('-').map(Number)
              const k = chaveDoDia(new Date(y, m - 1, dd))
              if (map[k]) map[k].gasto = +v.spend.toFixed(2)
            }
          }
        }
      } catch { /* série sem gasto é melhor que série nenhuma */ }
    }

    const data = Object.values(map)
    // "Tem dado" passou a incluir cliques e gasto: uma conta que só investiu em
    // anúncio, ainda sem venda, tinha o gráfico escondido como se estivesse vazia.
    const hasData = data.some(
      d => d.vendas > 0 || d.receita > 0 || d.checkouts > 0 || d.conversas > 0 || d.cliques > 0 || d.gasto > 0,
    )

    return NextResponse.json({ data, empty: !hasData })
  } catch (error) {
    console.error('Erro ao buscar série histórica:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function safeJson(s: string): any {
  try { return typeof s === 'string' ? JSON.parse(s) : s } catch { return {} }
}
