import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHistoryLimitDays, normalizePlan } from '@/lib/plans'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  })
  const planMaxDays = getHistoryLimitDays(normalizePlan(u?.plan))

  const { searchParams } = new URL(request.url)
  const requested = parseInt(searchParams.get('days') || '30')
  const days = Math.min(requested, planMaxDays)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const userId = session.user.id

  const [eventsByName, leadsCount, conversions, utmAgg] = await Promise.all([
    prisma.trackedEvent.groupBy({
      by: ['eventName'],
      where: { userId, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.trackedLead.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.trackedConversion.aggregate({
      where: { userId, createdAt: { gte: since } },
      _count: true,
      _sum: { value: true },
    }),
    prisma.trackedLead.groupBy({
      by: ['utmSource', 'utmCampaign'],
      where: { userId, createdAt: { gte: since } },
      _count: true,
    }),
  ])

  const eventCounts: Record<string, number> = {}
  for (const e of eventsByName) eventCounts[e.eventName] = (e._count as unknown as number) ?? 0

  const pageViews = eventCounts['page_view'] || 0
  const clickWhatsapp = eventCounts['click_whatsapp'] || 0
  const clickCheckout = eventCounts['click_checkout'] || 0
  const conversionsCount = conversions._count ?? 0
  const revenue = Number(conversions._sum.value ?? 0)
  const conversionRate = pageViews > 0 ? (conversionsCount / pageViews) * 100 : 0

  // Top origens (UTM)
  const origins = utmAgg
    .map(o => ({
      source: o.utmSource || 'direto',
      campaign: o.utmCampaign || '—',
      leads: (o._count as unknown as number) ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 8)

  return NextResponse.json({
    days,
    summary: {
      leads: leadsCount,
      pageViews,
      clickWhatsapp,
      clickCheckout,
      conversions: conversionsCount,
      revenue,
      conversionRate: Number(conversionRate.toFixed(2)),
    },
    eventCounts,
    origins,
  })
}
