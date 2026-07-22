import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'last_30d'

    const cacheKey = generateCacheKey(session.user.id, 'google-metrics', { period })
    const cached = cache.get(cacheKey)
    if (cached) return NextResponse.json(cached)

    const integration = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'GOOGLE_ADS', isActive: true },
    })

    if (!integration) {
      return NextResponse.json({
        connected: false,
        cpm: 'R$ 0.00', cpc: 'R$ 0.00', ctr: '0%', impressoes: '0', cliques: 0, gastos: 'R$ 0.00',
      })
    }

    const config = typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config

    if (config?.demo === true) {
      const days = period === 'today' ? 1 : period === 'last_7d' ? 7 : 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const funnel = await prisma.funnel.findFirst({
        where: { userId: session.user.id }, select: { id: true },
      })
      const events = funnel
        ? await prisma.funnelEvent.findMany({
            where: {
              funnelId: funnel.id,
              eventType: { in: ['google_click', 'google_ad_click'] },
              timestamp: { gte: since },
            },
            select: { metadata: true },
          })
        : []
      let clicks = 0
      let spend = 0
      let impressions = 0
      for (const ev of events) {
        try {
          const meta = JSON.parse(ev.metadata || '{}')
          clicks += 1
          spend += Number(meta.cost || meta.spend || 0)
          impressions += Number(meta.impressions || 0)
        } catch {}
      }
      if (impressions === 0) impressions = clicks * 22
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpc = clicks > 0 ? spend / clicks : 0
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0
      const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
      const fmtNum = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
      const response = {
        connected: true,
        cpm: fmtMoney(cpm),
        cpc: fmtMoney(cpc),
        ctr: `${ctr.toFixed(2)}%`,
        impressoes: fmtNum(impressions),
        cliques: clicks,
        gastos: fmtMoney(spend),
        raw: { impressions, clicks, spend, reach: Math.round(impressions * 0.75) },
        data: { clicks, impressions, ctr, cpc, spend },
      }
      cache.set(cacheKey, response, CacheTTL.SHORT)
      return NextResponse.json(response)
    }

    return NextResponse.json({
      connected: true,
      cpm: 'R$ 0.00', cpc: 'R$ 0.00', ctr: '0%', impressoes: '0', cliques: 0, gastos: 'R$ 0.00',
      error: 'Integração Google Ads conectada, mas sem fornecedor de dados em tempo real.',
    })
  } catch (error) {
    console.error('Erro ao buscar métricas Google:', error)
    return NextResponse.json({ error: 'Erro ao buscar métricas' }, { status: 500 })
  }
}
