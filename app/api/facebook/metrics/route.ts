import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAdInsights } from '@/lib/facebook'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'

// Buscar métricas do Facebook Ads para o dashboard
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'last_30d'
    const campaignId = searchParams.get('campaignId') || undefined

    // Verificar cache (incluindo campaignId na chave)
    const cacheKey = generateCacheKey(session.user.id, 'facebook-metrics', { period, campaignId })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Buscar integração ativa
    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'META_ADS',
        isActive: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        cpm: 'R$ 0.00',
        roi: '0.0x',
        cpc: 'R$ 0.00',
        impressoes: '0',
        cliques: 0,
        gastos: 'R$ 0.00',
        ctr: '0%',
        frequencia: '0',
        connected: false,
      })
    }

    const config = typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config

    if (config?.demo === true) {
      const days = period === 'today' ? 1 : period === 'last_7d' ? 7 : 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const funnel = await prisma.funnel.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      })
      const events = funnel
        ? await prisma.funnelEvent.findMany({
            where: {
              funnelId: funnel.id,
              eventType: { in: ['facebook_click', 'meta_ad_click'] },
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
      if (impressions === 0) impressions = clicks * 18
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpc = clicks > 0 ? spend / clicks : 0
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0
      const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
      const fmtNum = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
      const response = {
        cpm: fmtMoney(cpm),
        roi: 'N/D',
        cpc: fmtMoney(cpc),
        impressoes: fmtNum(impressions),
        cliques: clicks,
        gastos: fmtMoney(spend),
        ctr: `${ctr.toFixed(2)}%`,
        frequencia: '1.6',
        connected: true,
        raw: { impressions, clicks, spend, reach: Math.round(impressions * 0.7) },
        data: { clicks, impressions, ctr, cpc, spend },
      }
      cache.set(cacheKey, response, CacheTTL.SHORT)
      return NextResponse.json(response)
    }

    // Buscar insights da Meta Ads API (com ou sem filtro de campanha)
    const result = await getAdInsights(
      integration.accessToken,
      config.adAccountId,
      period,
      campaignId // Passa o ID da campanha se fornecido
    )

    if (!result.success || !result.data) {
      return NextResponse.json({
        cpm: 'R$ 0.00',
        roi: '0.0x',
        cpc: 'R$ 0.00',
        impressoes: '0',
        cliques: 0,
        gastos: 'R$ 0.00',
        ctr: '0%',
        frequencia: '0',
        connected: true,
        error: result.error,
      })
    }

    const data = result.data

    // Formatar valores
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value)
    }

    const formatNumber = (value: number) => {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`
      }
      return value.toString()
    }

    const response = {
      cpm: formatCurrency(data.cpm),
      roi: 'N/D',
      cpc: formatCurrency(data.cpc),
      impressoes: formatNumber(data.impressions),
      cliques: data.clicks,
      gastos: formatCurrency(data.spend),
      ctr: `${data.ctr.toFixed(2)}%`,
      frequencia: data.frequency.toFixed(1),
      connected: true,
      // Dados brutos para cálculos
      raw: {
        impressions: data.impressions,
        clicks: data.clicks,
        spend: data.spend,
        reach: data.reach,
      },
      data: {
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: data.ctr,
        cpc: data.cpc,
        spend: data.spend,
      },
    }

    // Salvar no cache por 2 minutos
    cache.set(cacheKey, response, CacheTTL.MEDIUM)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao buscar métricas Facebook:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    )
  }
}
