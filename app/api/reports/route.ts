import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHistoryLimitDays } from '@/lib/plans'
import { getDailyInsights } from '@/lib/facebook'
import { isSaleEvent, isCanceledSale, extractAmount, saleTransactionId } from '@/lib/sale-events'
import { checkRateLimit } from '@/lib/security-utils'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`reports:list:${session.user.id}`, 30, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas requisições. Aguarde.' }, { status: 429 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    const maxDays = getHistoryLimitDays(dbUser?.plan)

    const { searchParams } = new URL(request.url)
    const requested = parseInt(searchParams.get('days') || '30')
    const days = Math.min(Math.max(1, requested), maxDays)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
      include: { stages: true },
    })

    // Sem `select`, isto trazia TODAS as colunas — inclusive payload, headers e
    // response, que guardam o JSON completo de cada webhook recebido. Numa conta
    // ativa são megabytes de texto carregados para memória só para contar
    // linhas e agrupar por plataforma. Nenhum dos três é lido aqui.
    const webhookLogs = await prisma.webhookLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { platform: true, event: true, statusCode: true, createdAt: true },
    })

    const funnelEvents = funnel
      ? await prisma.funnelEvent.findMany({
          where: { funnelId: funnel.id, timestamp: { gte: since } },
          orderBy: { timestamp: 'desc' },
          select: { eventType: true, metadata: true, timestamp: true },
        })
      : []

    const webhookPlatforms = new Set(['HOTMART', 'KIWIFY', 'EDUZZ', 'MONETIZZE', 'META_ADS', 'FACEBOOK', 'WHATSAPP'])

    const byPlatform: Record<string, { total: number; success: number; errors: number; events: string[] }> = {}
    for (const log of webhookLogs) {
      if (!byPlatform[log.platform]) {
        byPlatform[log.platform] = { total: 0, success: 0, errors: 0, events: [] }
      }
      byPlatform[log.platform].total++
      if (log.statusCode && log.statusCode < 400) {
        byPlatform[log.platform].success++
      } else {
        byPlatform[log.platform].errors++
      }
      if (!byPlatform[log.platform].events.includes(log.event)) {
        byPlatform[log.platform].events.push(log.event)
      }
    }

    const seenSaleTx = new Set<string>()
    let totalRevenue = 0
    let totalSales = 0
    for (const ev of funnelEvents) {
      if (!isSaleEvent(ev.eventType)) continue
      let meta: any = {}
      try { meta = JSON.parse(ev.metadata || '{}') } catch {}
      if (isCanceledSale(meta)) continue
      const txId = saleTransactionId(meta)
      if (txId && seenSaleTx.has(txId)) continue
      if (txId) seenSaleTx.add(txId)
      totalSales += 1
      totalRevenue += extractAmount(meta)
    }

    const waConversas = funnelEvents.filter((e) => e.eventType === 'whatsapp_conversation_started').length

    const dailyActivity: Record<string, number> = {}
    for (const log of webhookLogs) {
      const day = log.createdAt.toISOString().slice(0, 10)
      dailyActivity[day] = (dailyActivity[day] || 0) + 1
    }

    const dailySeries = Object.entries(dailyActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const profitSeriesMap: Record<string, { revenue: number; costs: number; profit: number; roi: number | null }> = {}
    for (const ev of funnelEvents) {
      const day = ev.timestamp.toISOString().slice(0, 10)
      if (!profitSeriesMap[day]) profitSeriesMap[day] = { revenue: 0, costs: 0, profit: 0, roi: null }
      const entry = profitSeriesMap[day]
      if (isSaleEvent(ev.eventType)) {
        try {
          const meta = JSON.parse(ev.metadata || '{}')
          if (!isCanceledSale(meta)) entry.revenue += extractAmount(meta)
        } catch {}
      }
      if (['facebook_click', 'facebook_impression', 'meta_ad_click', 'meta_ad_impression'].includes(ev.eventType)) {
        try {
          const meta = JSON.parse(ev.metadata || '{}')
          entry.costs += Number(meta.cost || meta.spend || 0)
        } catch {}
      }
      entry.profit = entry.revenue - entry.costs
      entry.roi = entry.costs > 0 ? (entry.profit / entry.costs) * 100 : null
    }

    // ── Fontes que existem de verdade ─────────────────────────────────────────
    //
    // Até aqui o relatório lia só WebhookLog e FunnelEvent. Quem não configurou
    // webhook de checkout via TUDO zerado — inclusive o custo, porque ele vinha
    // de `FunnelEvent.metadata.cost`, campo que nenhuma parte viva do sistema
    // preenche. Numa conta com anúncio rodando e visitas entrando, a "Análise
    // completa do funil" mostrava quatro zeros e dois gráficos vazios.
    //
    // Vendas e receita saem de SaleAttribution, que é o produto final da
    // atribuição; investimento sai da Meta, dia a dia. São as mesmas fontes que
    // o Analytics e a Sara passaram a usar.
    const [vendasAtribuidas, visitas, metaIntegration, campanhas] = await Promise.all([
      prisma.saleAttribution.findMany({
        where: { userId: session.user.id, createdAt: { gte: since } },
        select: { value: true, createdAt: true },
      }).catch(() => [] as Array<{ value: number; createdAt: Date }>),
      prisma.trackedLead.count({
        where: { userId: session.user.id, createdAt: { gte: since } },
      }).catch(() => 0),
      prisma.integration.findFirst({
        where: { userId: session.user.id, platform: 'META_ADS', isActive: true },
        select: { accessToken: true, config: true },
      }).catch(() => null),
      prisma.campaign.findMany({
        where: { userId: session.user.id, platform: 'META_ADS' },
        select: { campaignId: true },
        take: 25,
      }).catch(() => []),
    ])

    // A atribuição é a fonte final de venda; o evento de funil é registro
    // bruto. Havendo atribuição, ela substitui o que veio dos eventos.
    if (vendasAtribuidas.length > 0) {
      totalSales = vendasAtribuidas.length
      totalRevenue = vendasAtribuidas.reduce((a, v) => a + (v.value || 0), 0)
      for (const k of Object.keys(profitSeriesMap)) profitSeriesMap[k].revenue = 0
      for (const v of vendasAtribuidas) {
        const day = v.createdAt.toISOString().slice(0, 10)
        if (!profitSeriesMap[day]) profitSeriesMap[day] = { revenue: 0, costs: 0, profit: 0, roi: null }
        profitSeriesMap[day].revenue += v.value || 0
      }
    }

    let investimento = 0
    let impressoes = 0
    let cliquesEmAnuncio = 0

    if (metaIntegration?.accessToken) {
      try {
        const cfg = typeof metaIntegration.config === 'string'
          ? JSON.parse(metaIntegration.config)
          : (metaIntegration.config ?? {})
        if (cfg?.adAccountId) {
          const preset = days <= 1 ? 'today' : days <= 7 ? 'last_7d' : days <= 30 ? 'last_30d' : 'last_90d'
          const ids = campanhas.map(c => c.campaignId).filter(Boolean) as string[]
          const diario = await getDailyInsights(metaIntegration.accessToken, cfg.adAccountId, preset, ids)
          if (diario.success) {
            for (const [dia, v] of Object.entries(diario.porDia)) {
              investimento += v.spend
              impressoes += v.impressions
              cliquesEmAnuncio += v.clicks
              if (!profitSeriesMap[dia]) profitSeriesMap[dia] = { revenue: 0, costs: 0, profit: 0, roi: null }
              profitSeriesMap[dia].costs = +v.spend.toFixed(2)
            }
          }
        }
      } catch { /* relatório sem gasto é melhor que relatório nenhum */ }
    }

    // Lucro e ROI recalculados depois de receita e custo terem as fontes certas.
    for (const entry of Object.values(profitSeriesMap)) {
      entry.profit = +(entry.revenue - entry.costs).toFixed(2)
      entry.roi = entry.costs > 0 ? +((entry.profit / entry.costs) * 100).toFixed(1) : null
    }

    const profitSeries = Object.entries(profitSeriesMap)
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      summary: {
        totalWebhooks: webhookLogs.length,
        totalSales,
        totalRevenue: +totalRevenue.toFixed(2),
        waConversas,
        platforms: Object.keys(byPlatform).length,
        // Mídia paga e rastreamento: o que a conta tem mesmo sem webhook algum.
        investimento: +investimento.toFixed(2),
        impressoes,
        cliquesEmAnuncio,
        visitas,
        lucro: +(totalRevenue - investimento).toFixed(2),
        roi: investimento > 0 ? +(((totalRevenue - investimento) / investimento) * 100).toFixed(1) : null,
      },
      byPlatform,
      dailySeries,
      profitSeries,
      topEvents: webhookLogs
        .reduce((acc: Record<string, number>, l) => {
          acc[l.event] = (acc[l.event] || 0) + 1
          return acc
        }, {}),
    })
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 })
  }
}
