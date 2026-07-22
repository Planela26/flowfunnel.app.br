import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHistoryLimitDays } from '@/lib/plans'
import { isSaleEvent, isCanceledSale, extractAmount, saleTransactionId } from '@/lib/sale-events'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
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

    const webhookLogs = await prisma.webhookLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    })

    const funnelEvents = funnel
      ? await prisma.funnelEvent.findMany({
          where: { funnelId: funnel.id, timestamp: { gte: since } },
          orderBy: { timestamp: 'desc' },
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

    const profitSeries = Object.entries(profitSeriesMap)
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      summary: {
        totalWebhooks: webhookLogs.length,
        totalSales,
        totalRevenue,
        waConversas,
        platforms: Object.keys(byPlatform).length,
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
