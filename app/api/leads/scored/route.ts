import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFeature } from '@/lib/withPlan'
import { scoreLead, type LeadInput } from '@/lib/leadScoring'
import { getHistoryLimitDays } from '@/lib/plans'

export async function GET(request: Request) {
  const guard = await requireFeature('lead_scoring')
  if (guard.response) return guard.response
  const { user } = guard

  const { searchParams } = new URL(request.url)
  const days = Math.min(
    parseInt(searchParams.get('days') || '30'),
    getHistoryLimitDays(user.plan)
  )
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const logs = await prisma.webhookLog.findMany({
    where: { userId: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  })

  // Agrupar por identificador (phone > email > name)
  const map = new Map<string, LeadInput>()

  for (const log of logs) {
    let phone = ''
    let name = ''
    let email = ''
    let amount = 0
    let eventType = log.event || 'event'

    try {
      const payload = JSON.parse(log.payload || '{}')
      const platform = (log.platform || '').toUpperCase()

      if (platform === 'WHATSAPP') {
        phone = payload.phone || payload.from || payload.waId || payload.contact?.wa_id || ''
        name = payload.name || payload.contact?.profile?.name || payload.pushname || ''
        if (eventType === 'message') eventType = 'message'
      } else if (platform === 'HOTMART') {
        phone = payload.buyer?.phone || payload.phone || ''
        name = payload.buyer?.name || payload.name || ''
        email = payload.buyer?.email || payload.email || ''
        amount = Number(payload.purchase?.price?.value || payload.value || 0)
        if (eventType.includes('checkout')) eventType = 'checkout'
        else if (eventType.includes('approved') || eventType.includes('confirm')) eventType = 'sale'
      } else if (platform === 'KIWIFY') {
        phone = payload.Customer?.mobile || payload.phone || ''
        name = payload.Customer?.full_name || payload.name || ''
        email = payload.Customer?.email || payload.email || ''
        amount = Number(payload.Order?.charge_amount || 0)
        if (eventType.includes('checkout')) eventType = 'checkout'
        else if (eventType.includes('approved') || eventType.includes('paid')) eventType = 'sale'
      } else if (platform === 'EDUZZ') {
        phone = payload.cliente?.telefone || payload.phone || ''
        name = payload.cliente?.nome || payload.name || ''
        email = payload.cliente?.email || payload.email || ''
        amount = Number(payload.valor || payload.amount || 0)
      } else if (platform === 'MONETIZZE') {
        phone = payload.comprador?.celular || payload.phone || ''
        name = payload.comprador?.nome || payload.name || ''
        email = payload.comprador?.email || payload.email || ''
      } else if (platform === 'META_ADS' || platform === 'FACEBOOK') {
        phone = payload.phone || ''
        name = payload.full_name || payload.name || ''
        email = payload.email || ''
        eventType = 'click'
      }
    } catch {
      // payload corrompido, ignora
    }

    const key = (phone || email || name || '').trim().toLowerCase()
    if (!key) continue

    if (!map.has(key)) {
      map.set(key, { phone, email, name, platform: log.platform, events: [] })
    }
    const lead = map.get(key)!
    if (!lead.phone && phone) lead.phone = phone
    if (!lead.email && email) lead.email = email
    if (!lead.name && name) lead.name = name
    lead.events.push({
      type: eventType,
      platform: log.platform,
      timestamp: log.createdAt,
      amount: amount || null,
    })
  }

  const scored = Array.from(map.values())
    .map(scoreLead)
    .sort((a, b) => b.score - a.score)

  const summary = {
    total: scored.length,
    quente: scored.filter(l => l.classification === 'quente').length,
    morno: scored.filter(l => l.classification === 'morno').length,
    frio: scored.filter(l => l.classification === 'frio').length,
    avgScore: scored.length
      ? Math.round(scored.reduce((s, l) => s + l.score, 0) / scored.length)
      : 0,
    totalRevenue: scored.reduce((s, l) => s + l.totalSpent, 0),
  }

  return NextResponse.json({
    summary,
    leads: scored.slice(0, 100),
    historyDays: days,
  })
}
