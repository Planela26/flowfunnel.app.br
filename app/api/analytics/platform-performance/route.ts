import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'
import { getInsightsComFallback } from '@/lib/facebook'

const PURCHASE_EVENT_RX = /_purchase_complete$/

const NON_ELIGIBLE_PURCHASE_STATUS = new Set([
  'canceled', 'cancelled', 'refunded', 'refund', 'chargeback',
  'disputed', 'failed', 'declined', 'expired',
])

const PLATFORMS = [
  { key: 'facebook', label: 'Meta Ads',   eventTypes: ['facebook_click', 'meta_click', 'meta_ad_click'] },
  { key: 'google',   label: 'Google Ads', eventTypes: ['google_click', 'google_ad_click'] },
  { key: 'tiktok',   label: 'TikTok Ads', eventTypes: ['tiktok_click', 'tiktok_ad_click'] },
] as const

function toNumber(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : 0
  if (typeof v === 'string') {
    // Normaliza vírgula decimal e remove espaços
    const cleaned = v.replace(/\s/g, '').replace(',', '.')
    const n = Number(cleaned)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  return 0
}

function safeJson(s: unknown): any {
  if (!s) return {}
  if (typeof s === 'object') return s
  if (typeof s !== 'string') return {}
  try { return JSON.parse(s) } catch { return {} }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30')))

    const cacheKey = generateCacheKey(session.user.id, 'platform-performance', { days })
    const cached = cache.get(cacheKey)
    if (cached) return NextResponse.json(cached)

    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))

    // ── De onde vêm gasto e receita ───────────────────────────────────────────
    //
    // Antes esta rota exigia um registro `Funnel` e derivava o gasto de
    // `FunnelEvent.metadata.cost` — um campo que NENHUMA parte viva do sistema
    // preenche hoje. E `Funnel` não é o "funil" que se cria na interface (esse
    // é `Workspace`), então a conta típica não tem nenhum: a rota devolvia
    // tudo zerado na primeira linha, antes de olhar qualquer dado.
    //
    // Agora lê as fontes reais: gasto e cliques vêm da Meta ao vivo; receita
    // vem de SaleAttribution, que é onde a venda atribuída de fato mora.
    const perPlatform: Record<string, { clicks: number; spend: number; revenue: number }> = {}
    for (const p of PLATFORMS) perPlatform[p.key] = { clicks: 0, spend: 0, revenue: 0 }

    const [metaIntegration, campanhas, vendas] = await Promise.all([
      prisma.integration.findFirst({
        where: { userId: session.user.id, platform: 'META_ADS', isActive: true },
        select: { accessToken: true, config: true },
      }).catch(() => null),
      prisma.campaign.findMany({
        where: { userId: session.user.id, platform: 'META_ADS' },
        select: { campaignId: true },
        take: 25,
      }).catch(() => []),
      // Receita por origem. `utmSource` é o que liga a venda à plataforma que a
      // trouxe — é isso que o link rastreável grava.
      prisma.saleAttribution.groupBy({
        by: ['utmSource'],
        where: { userId: session.user.id, createdAt: { gte: since } },
        _sum: { value: true },
        _count: { _all: true },
      }).catch(() => [] as Array<{ utmSource: string | null; _sum: { value: number | null }; _count: { _all: number } }>),
    ])

    // Gasto e cliques reais da Meta.
    if (metaIntegration?.accessToken) {
      try {
        const cfg = typeof metaIntegration.config === 'string'
          ? JSON.parse(metaIntegration.config)
          : (metaIntegration.config ?? {})
        if (cfg?.adAccountId) {
          const preset = days <= 1 ? 'today' : days <= 7 ? 'last_7d' : days <= 30 ? 'last_30d' : 'last_90d'
          const ins = await getInsightsComFallback(
            metaIntegration.accessToken,
            cfg.adAccountId,
            preset,
            campanhas.map(c => c.campaignId).filter(Boolean) as string[],
          )
          if (ins.success && ins.data) {
            // A chave é 'facebook' (ver PLATFORMS), não 'meta'. Escrever na
            // chave errada não daria erro de tipo — `perPlatform` é
            // Record<string, …> — e o catch abaixo engoliria o TypeError,
            // deixando o gasto em zero sem nenhum sinal.
            perPlatform.facebook.spend = ins.data.spend
            perPlatform.facebook.clicks = ins.data.clicks
          }
        }
      } catch { /* uma falha da Meta não zera as outras plataformas */ }
    }

    // Receita por plataforma, a partir da origem gravada na atribuição.
    // Valores à direita são as chaves de PLATFORMS.
    const ORIGEM_PARA_PLATAFORMA: Record<string, string> = {
      facebook: 'facebook', fb: 'facebook', meta: 'facebook', instagram: 'facebook',
      google: 'google', adwords: 'google',
      tiktok: 'tiktok',
    }
    let receitaSemOrigem = 0
    for (const v of vendas) {
      const bruto = (v.utmSource || '').toLowerCase().trim()
      const chave = ORIGEM_PARA_PLATAFORMA[bruto]
      const valor = v._sum.value || 0
      if (chave && perPlatform[chave]) perPlatform[chave].revenue += valor
      else receitaSemOrigem += valor
    }

    const totalClicks = Object.values(perPlatform).reduce((a, p) => a + p.clicks, 0)
    const totalRevenue = Object.values(perPlatform).reduce((a, p) => a + p.revenue, 0) + receitaSemOrigem

    // Receita sem origem identificada é rateada por share de cliques — é o
    // melhor palpite quando a venda chegou sem UTM (anúncio apontando direto
    // para a página, sem o link rastreável). Com origem, o valor vai inteiro
    // para a plataforma certa e não precisa de rateio.
    const platformsWithSpend = PLATFORMS.filter(p => perPlatform[p.key].spend > 0)
    const rateioIgual = totalClicks === 0 && receitaSemOrigem > 0 && platformsWithSpend.length > 0

    const data = PLATFORMS.map(p => {
      const stats = perPlatform[p.key]
      let receita = stats.revenue
      if (receitaSemOrigem > 0) {
        if (totalClicks > 0) {
          receita += receitaSemOrigem * (stats.clicks / totalClicks)
        } else if (rateioIgual && stats.spend > 0) {
          receita += receitaSemOrigem / platformsWithSpend.length
        }
      }
      const gasto = +stats.spend.toFixed(2)
      const receitaR = +receita.toFixed(2)
      const lucro = +(receitaR - gasto).toFixed(2)
      const roi = gasto > 0 ? +(((receitaR - gasto) / gasto) * 100).toFixed(1) : 0
      return { name: p.label, gasto, receita: receitaR, lucro, roi, cliques: stats.clicks }
    })

    const response = {
      data,
      empty: data.every(d => d.gasto === 0 && d.receita === 0),
      period: { days, since: since.toISOString() },
    }

    cache.set(cacheKey, response, CacheTTL.SHORT)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Erro ao calcular performance por plataforma:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
