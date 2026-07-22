import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHistoryLimitDays, normalizePlan } from '@/lib/plans'

// Plataformas que são "boca do funil" (origem do lead)
const SOURCE_PLATFORMS = new Set(['META_ADS', 'GOOGLE_ADS', 'TIKTOK_ADS', 'DIRECT'])

function resolveSource(opts: {
  utmSource?: string
  notes?: string | null
  webhookPlatforms: Set<string>
}): string {
  const utm = (opts.utmSource || '').toLowerCase()
  if (utm.includes('facebook') || utm.includes('meta') || utm.includes('instagram') || utm === 'fb' || utm === 'ig') return 'META_ADS'
  if (utm.includes('google') || utm.includes('adwords') || utm.includes('gads')) return 'GOOGLE_ADS'
  if (utm.includes('tiktok') || utm === 'tt') return 'TIKTOK_ADS'

  const notes = (opts.notes || '').toLowerCase()
  const m = notes.match(/origem:\s*([a-z\s]+)/)
  if (m) {
    const o = m[1].trim()
    if (o.includes('meta') || o.includes('facebook') || o.includes('instagram')) return 'META_ADS'
    if (o.includes('google')) return 'GOOGLE_ADS'
    if (o.includes('tiktok')) return 'TIKTOK_ADS'
  }

  // Se houve um webhook de fonte (raro fora dos casos acima), usa
  if (opts.webhookPlatforms.has('META_ADS') || opts.webhookPlatforms.has('FACEBOOK')) return 'META_ADS'
  if (opts.webhookPlatforms.has('GOOGLE_ADS')) return 'GOOGLE_ADS'
  if (opts.webhookPlatforms.has('TIKTOK_ADS')) return 'TIKTOK_ADS'

  return 'DIRECT'
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
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
    const platformFilter = (searchParams.get('platform') || 'all').toUpperCase()
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 50

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const logs = await prisma.webhookLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    })

    type LeadRow = {
      id: string
      phone: string
      name: string
      email: string
      platform: string // = source (boca do funil)
      firstSeen: Date
      lastSeen: Date
      events: Array<{ event: string; platform: string; at: Date }>
      totalEvents: number
      isSale: boolean
      revenue: number
      product: string
      status: 'lead' | 'checkout' | 'cliente'
      _utmSource?: string
      _webhookPlatforms: Set<string>
    }
    const leadMap = new Map<string, LeadRow>()

    for (const log of logs) {
      let phone = ''
      let name = ''
      let email = ''
      let amount = 0
      let product = ''
      let utmSource = ''

      try {
        const payload = JSON.parse(log.payload || '{}')

        if (log.platform === 'WHATSAPP') {
          phone = payload.phone || payload.from || payload.waId || payload.contact?.wa_id || ''
          name = payload.name || payload.contact?.profile?.name || payload.pushname || ''
        }
        if (log.platform === 'HOTMART') {
          phone = payload.buyer?.phone || payload.phone || ''
          name = payload.buyer?.name || payload.name || ''
          email = payload.buyer?.email || payload.email || ''
          amount = payload.purchase?.price?.value || payload.value || 0
          product = payload.product?.name || payload.productName || ''
        }
        if (log.platform === 'KIWIFY') {
          phone = payload.Customer?.mobile || payload.phone || ''
          name = payload.Customer?.full_name || payload.name || ''
          email = payload.Customer?.email || payload.email || ''
          amount = payload.Order?.charge_amount || 0
          product = payload.Product?.name || ''
        }
        if (log.platform === 'META_ADS' || log.platform === 'FACEBOOK') {
          phone = payload.phone || ''
          name = payload.full_name || payload.name || ''
          email = payload.email || ''
        }
        if (log.platform === 'EDUZZ' || log.platform === 'MONETIZZE') {
          phone = payload.phone || payload.buyer_phone || ''
          name = payload.name || payload.buyer_name || ''
          email = payload.email || payload.buyer_email || ''
          amount = payload.value || payload.amount || 0
          product = payload.product_name || payload.productName || ''
        }

        // UTM source pode vir em qualquer payload
        utmSource = payload.utm_source || payload.utmSource || payload.source || payload.referrer || ''
      } catch {}

      // Ignorar logs sem identificação (são cliques de ads sem dado de contato)
      if (!phone && !email) continue

      const key = phone || email
      const isConversion = ['purchase_complete', 'purchase_approved', 'approved', 'complete'].some(k =>
        log.event.toLowerCase().includes(k)
      )
      const isSale = isConversion && amount > 0

      if (!leadMap.has(key)) {
        leadMap.set(key, {
          id: key,
          phone,
          name,
          email,
          platform: 'DIRECT',
          firstSeen: log.createdAt,
          lastSeen: log.createdAt,
          events: [],
          totalEvents: 0,
          isSale: false,
          revenue: 0,
          product,
          status: 'lead',
          _utmSource: utmSource || undefined,
          _webhookPlatforms: new Set([log.platform]),
        })
      }

      const lead = leadMap.get(key)!
      lead.totalEvents++
      lead.lastSeen = log.createdAt > lead.lastSeen ? log.createdAt : lead.lastSeen
      lead.firstSeen = log.createdAt < lead.firstSeen ? log.createdAt : lead.firstSeen
      lead.events.push({ event: log.event, platform: log.platform, at: log.createdAt })
      lead._webhookPlatforms.add(log.platform)
      if (utmSource && !lead._utmSource) lead._utmSource = utmSource

      if (isSale) {
        lead.isSale = true
        lead.revenue += amount
        lead.status = 'cliente'
      } else if (isConversion) {
        lead.status = lead.status === 'cliente' ? 'cliente' : 'checkout'
      }

      if (!lead.name && name) lead.name = name
      if (!lead.email && email) lead.email = email
      if (!lead.phone && phone) lead.phone = phone
      if (!lead.product && product) lead.product = product
    }

    // Buscar notes de LeadStatus para inferir origem (compatibilidade c/ seed demo)
    const phones = Array.from(leadMap.values()).map(l => l.phone).filter(Boolean)
    const notesByPhone = new Map<string, string>()
    if (phones.length) {
      const statuses = await prisma.leadStatus.findMany({
        where: { userId: session.user.id, phone: { in: phones } },
        select: { phone: true, notes: true },
      })
      for (const s of statuses) {
        if (s.notes) notesByPhone.set(s.phone, s.notes)
      }
    }

    // Resolve a origem (boca do funil) e limpa campos internos
    const resolved = Array.from(leadMap.values()).map(l => {
      const source = resolveSource({
        utmSource: l._utmSource,
        notes: notesByPhone.get(l.phone),
        webhookPlatforms: l._webhookPlatforms,
      })
      const { _utmSource, _webhookPlatforms, ...rest } = l
      return { ...rest, platform: source }
    })

    let allLeads = resolved

    // Filtro por plataforma de origem (apenas boca do funil)
    if (platformFilter !== 'ALL' && SOURCE_PLATFORMS.has(platformFilter)) {
      allLeads = allLeads.filter(l => l.platform === platformFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      allLeads = allLeads.filter(l =>
        (l.phone || '').includes(q) ||
        (l.name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      )
    }

    allLeads.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())

    const total = allLeads.length
    const paginated = allLeads.slice((page - 1) * limit, page * limit)

    const stats = {
      total,
      clientes: allLeads.filter(l => l.status === 'cliente').length,
      checkout: allLeads.filter(l => l.status === 'checkout').length,
      leads: allLeads.filter(l => l.status === 'lead').length,
      revenue: allLeads.reduce((acc, l) => acc + l.revenue, 0),
    }

    return NextResponse.json({ leads: paginated, stats, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Erro ao buscar leads:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
