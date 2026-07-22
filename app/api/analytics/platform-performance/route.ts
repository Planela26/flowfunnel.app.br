import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'

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

    // Agrega através de TODOS os funis do usuário
    const funnels = await prisma.funnel.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const funnelIds = funnels.map(f => f.id)

    const emptyResponse = {
      data: PLATFORMS.map(p => ({ name: p.label, gasto: 0, receita: 0, lucro: 0, roi: 0, cliques: 0 })),
      empty: true,
    }

    if (funnelIds.length === 0) {
      return NextResponse.json(emptyResponse)
    }

    const allClickEventTypes = PLATFORMS.flatMap(p => [...p.eventTypes])
    const events = await prisma.funnelEvent.findMany({
      where: {
        funnelId: { in: funnelIds },
        timestamp: { gte: since },
        OR: [
          { eventType: { in: allClickEventTypes } },
          { eventType: { endsWith: '_purchase_complete' } },
        ],
      },
      select: { eventType: true, metadata: true },
    })

    const perPlatform: Record<string, { clicks: number; spend: number }> = {}
    for (const p of PLATFORMS) perPlatform[p.key] = { clicks: 0, spend: 0 }

    let totalClicks = 0
    let totalRevenue = 0

    for (const ev of events) {
      const meta = safeJson(ev.metadata)

      if (PURCHASE_EVENT_RX.test(ev.eventType)) {
        const status = String(meta.status || '').toLowerCase()
        if (NON_ELIGIBLE_PURCHASE_STATUS.has(status)) continue
        totalRevenue += toNumber(meta.amount ?? meta.price ?? meta.value)
        continue
      }

      const platform = PLATFORMS.find(p => (p.eventTypes as readonly string[]).includes(ev.eventType))
      if (!platform) continue

      perPlatform[platform.key].clicks += 1
      perPlatform[platform.key].spend += toNumber(meta.cost ?? meta.spend ?? meta.value)
      totalClicks += 1
    }

    // Atribuição: por share de cliques. Fallback: se houver receita mas nenhum clique
    // rastreado, divide igualmente entre plataformas que tiveram gasto.
    const platformsWithSpend = PLATFORMS.filter(p => perPlatform[p.key].spend > 0)
    const fallbackSplit = totalClicks === 0 && totalRevenue > 0 && platformsWithSpend.length > 0

    const data = PLATFORMS.map(p => {
      const stats = perPlatform[p.key]
      let receita: number
      if (totalClicks > 0) {
        receita = totalRevenue * (stats.clicks / totalClicks)
      } else if (fallbackSplit && stats.spend > 0) {
        receita = totalRevenue / platformsWithSpend.length
      } else {
        receita = 0
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
