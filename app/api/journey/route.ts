import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/journey — lista leads rastreados recentes (com resumo de origem e
// vendas atribuídas) para a visualização de jornada do dashboard.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const userId = session.user.id
  const { searchParams } = new URL(request.url)
  const days = Math.min(parseInt(searchParams.get('days') || '30') || 30, 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const onlySales = searchParams.get('onlySales') === 'true'

  const attributions = await prisma.saleAttribution.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const attributedLeadIds = new Set(attributions.map((a) => a.leadId).filter(Boolean) as string[])

  const leads = await prisma.trackedLead.findMany({
    where: onlySales
      ? { userId, leadId: { in: Array.from(attributedLeadIds) } }
      : { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const leadIds = leads.map((l) => l.leadId)
  const eventCounts = await prisma.trackedEvent.groupBy({
    by: ['leadId', 'eventName'],
    where: { userId, leadId: { in: leadIds } },
    _count: true,
  })

  const countsByLead: Record<string, Record<string, number>> = {}
  for (const e of eventCounts) {
    ;(countsByLead[e.leadId] ||= {})[e.eventName] = (e._count as unknown as number) ?? 0
  }

  const salesByLead: Record<string, { platform: string; value: number; method: string }[]> = {}
  for (const a of attributions) {
    if (!a.leadId) continue
    ;(salesByLead[a.leadId] ||= []).push({ platform: a.platform, value: a.value, method: a.method })
  }

  return NextResponse.json({
    leads: leads.map((l) => ({
      leadId: l.leadId,
      visitorId: l.visitorId,
      utmSource: l.utmSource,
      utmCampaign: l.utmCampaign,
      referrer: l.referrer,
      firstSeen: l.createdAt.toISOString(),
      events: countsByLead[l.leadId] || {},
      sales: salesByLead[l.leadId] || [],
    })),
    unmatchedSales: attributions
      .filter((a) => !a.leadId)
      .map((a) => ({
        platform: a.platform,
        transactionId: a.transactionId,
        value: a.value,
        method: a.method,
        matchedBy: a.matchedBy,
        at: a.createdAt.toISOString(),
      })),
  })
}
