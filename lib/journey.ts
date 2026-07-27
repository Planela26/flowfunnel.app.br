import { prismaAdmin as prisma } from './prisma'

/**
 * Consulta de jornada do cliente — usada pelas APIs internas e pela Flow.ai.
 * Monta a timeline completa de um lead: eventos do tracker, sessões,
 * conversas WhatsApp, conversões e atribuições de venda.
 */

export interface JourneyStep {
  at: string // ISO timestamp
  type: string // page_view | click_whatsapp | conversation_started | purchase | ...
  source: 'tracker' | 'whatsapp' | 'webhook' | 'conversion' | 'attribution'
  label: string
  detail?: Record<string, any>
}

export interface Journey {
  leadId: string
  visitorId: string | null
  origin: {
    utmSource: string | null
    utmCampaign: string | null
    utmMedium: string | null
    utmContent: string | null
    fbclid: string | null
    gclid: string | null
    referrer: string | null
    firstUrl: string | null
  } | null
  firstSeen: string | null
  sessions: { sessionId: string; startedAt: string; lastSeen: string }[]
  steps: JourneyStep[]
  sales: {
    platform: string
    transactionId: string
    value: number
    currency: string
    product: string | null
    method: string
    matchedBy: string | null
    confidence: number
    at: string
  }[]
  durations: {
    clickToWhatsAppMs: number | null
    clickToPurchaseMs: number | null
  }
}

function parseMeta(s: string | null): Record<string, any> {
  if (!s) return {}
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

export async function getLeadJourney(userId: string, leadId: string): Promise<Journey | null> {
  const lead = await prisma.trackedLead.findUnique({
    where: { userId_leadId: { userId, leadId } },
  })
  if (!lead) return null

  const [events, sessions, conversions, attributions] = await Promise.all([
    prisma.trackedEvent.findMany({
      where: { userId, leadId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    prisma.trackedSession.findMany({
      where: { userId, leadId },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.trackedConversion.findMany({
      where: { userId, leadId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.saleAttribution.findMany({
      where: { userId, leadId },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const steps: JourneyStep[] = []

  for (const e of events) {
    steps.push({
      at: e.createdAt.toISOString(),
      type: e.eventName,
      source: 'tracker',
      label:
        e.eventName === 'page_view'
          ? 'Visitou a página'
          : e.eventName === 'click_whatsapp'
            ? 'Clicou no WhatsApp'
            : e.eventName === 'click_checkout'
              ? 'Abriu o checkout'
              : e.eventName === 'scroll_60'
                ? 'Leu a página (60%+)'
                : e.eventName,
      detail: { url: e.url, ...parseMeta(e.metadata) },
    })
  }

  for (const c of conversions) {
    steps.push({
      at: c.createdAt.toISOString(),
      type: 'conversion',
      source: 'conversion',
      label: `Conversão registrada${c.product ? `: ${c.product}` : ''}`,
      detail: { value: c.value, orderId: c.orderId, platform: c.platform, source: c.source },
    })
  }

  for (const a of attributions) {
    steps.push({
      at: a.createdAt.toISOString(),
      type: 'purchase',
      source: 'attribution',
      label: `Compra confirmada (${a.platform})${a.product ? `: ${a.product}` : ''}`,
      detail: {
        value: a.value,
        currency: a.currency,
        transactionId: a.transactionId,
        method: a.method,
        matchedBy: a.matchedBy,
        confidence: a.confidence,
      },
    })
  }

  steps.sort((x, y) => x.at.localeCompare(y.at))

  const firstClick = events.find((e) => e.eventName === 'page_view') || events[0]
  const firstWhats = events.find((e) => e.eventName === 'click_whatsapp')
  const firstSale = attributions[0]

  return {
    leadId,
    visitorId: lead.visitorId,
    origin: {
      utmSource: lead.utmSource,
      utmCampaign: lead.utmCampaign,
      utmMedium: lead.utmMedium,
      utmContent: lead.utmContent,
      fbclid: lead.fbclid,
      gclid: lead.gclid,
      referrer: lead.referrer,
      firstUrl: lead.firstUrl,
    },
    firstSeen: lead.createdAt.toISOString(),
    sessions: sessions.map((s) => ({
      sessionId: s.sessionId,
      startedAt: s.startedAt.toISOString(),
      lastSeen: s.lastSeen.toISOString(),
    })),
    steps,
    sales: attributions.map((a) => ({
      platform: a.platform,
      transactionId: a.transactionId,
      value: a.value,
      currency: a.currency,
      product: a.product,
      method: a.method,
      matchedBy: a.matchedBy,
      confidence: a.confidence,
      at: a.createdAt.toISOString(),
    })),
    durations: {
      clickToWhatsAppMs:
        firstClick && firstWhats ? firstWhats.createdAt.getTime() - firstClick.createdAt.getTime() : null,
      clickToPurchaseMs:
        firstClick && firstSale ? firstSale.createdAt.getTime() - firstClick.createdAt.getTime() : null,
    },
  }
}

/** Origem de uma venda específica (por transactionId). */
export async function getSaleOrigin(userId: string, transactionId: string) {
  const attribution = await prisma.saleAttribution.findFirst({
    where: { userId, transactionId },
  })
  if (!attribution) return null
  const journey = attribution.leadId ? await getLeadJourney(userId, attribution.leadId) : null
  return { attribution, journey }
}

/** Resumo de atribuição do tenant (para dashboards e Flow.ai). */
export async function getAttributionSummary(userId: string, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const rows = await prisma.saleAttribution.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const byMethod: Record<string, { count: number; revenue: number }> = {}
  const byCampaign: Record<string, { count: number; revenue: number }> = {}
  for (const r of rows) {
    const m = (byMethod[r.method] ||= { count: 0, revenue: 0 })
    m.count += 1
    m.revenue += r.value
    const key = r.utmCampaign || r.utmSource || '(sem origem)'
    const c = (byCampaign[key] ||= { count: 0, revenue: 0 })
    c.count += 1
    c.revenue += r.value
  }

  return {
    total: rows.length,
    byMethod,
    byCampaign,
    deterministicShare: rows.length
      ? rows.filter((r) => r.method === 'deterministic').length / rows.length
      : 0,
    recent: rows.slice(0, 50),
  }
}
