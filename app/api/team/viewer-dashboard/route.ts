import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const ownerId = searchParams.get('ownerId')

    if (!token || !ownerId) {
      return NextResponse.json({ error: 'Token e ownerId obrigatórios' }, { status: 400 })
    }

    const member = await prisma.teamMember.findUnique({
      where: { token },
      include: { owner: { select: { name: true, email: true } } },
    })

    if (!member || member.ownerId !== ownerId) {
      return NextResponse.json({ error: 'Convite inválido' }, { status: 401 })
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Funis do owner
    const funnels = await prisma.funnel.findMany({
      where: { userId: ownerId },
      select: { id: true, name: true, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    const funnelIds = funnels.map((f) => f.id)

    // Contagens de eventos (filtrando por funil do owner)
    const totalEvents = funnelIds.length > 0
      ? await prisma.funnelEvent.count({ where: { funnelId: { in: funnelIds } } })
      : 0
    const events7d = funnelIds.length > 0
      ? await prisma.funnelEvent.count({ where: { funnelId: { in: funnelIds }, timestamp: { gte: sevenDaysAgo } } })
      : 0
    const events30d = funnelIds.length > 0
      ? await prisma.funnelEvent.count({ where: { funnelId: { in: funnelIds }, timestamp: { gte: thirtyDaysAgo } } })
      : 0
    const eventsToday = funnelIds.length > 0
      ? await prisma.funnelEvent.count({ where: { funnelId: { in: funnelIds }, timestamp: { gte: todayStart } } })
      : 0

    // Contagens de funis
    const totalFunnels = funnels.length
    const activeFunnels = funnels.filter((f) => f.isActive).length

    // Leads (LeadStatus tem userId direto)
    const totalLeads = await prisma.leadStatus.count({ where: { userId: ownerId } })
    const leads7d = await prisma.leadStatus.count({ where: { userId: ownerId, createdAt: { gte: sevenDaysAgo } } })
    const leads30d = await prisma.leadStatus.count({ where: { userId: ownerId, createdAt: { gte: thirtyDaysAgo } } })
    const leadsToday = await prisma.leadStatus.count({ where: { userId: ownerId, createdAt: { gte: todayStart } } })

    // Campanhas
    const campaigns = await prisma.campaign.findMany({
      where: { userId: ownerId },
      select: { id: true, name: true, platform: true, isActive: true, createdAt: true, spend: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Metas
    const goals = await prisma.goal.findMany({
      where: { userId: ownerId },
      select: { id: true, title: true, targetValue: true, currentValue: true, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Leads por status
    const leadStatus = await prisma.leadStatus.groupBy({
      by: ['stage'],
      where: { userId: ownerId },
      _count: { id: true },
    })

    // Timeline: eventos dos últimos 7 dias
    const recentEvents = funnelIds.length > 0
      ? await prisma.funnelEvent.findMany({
          where: { funnelId: { in: funnelIds }, timestamp: { gte: sevenDaysAgo } },
          select: { timestamp: true },
          orderBy: { timestamp: 'asc' },
          take: 1000,
        })
      : []

    const daysMap: Record<string, { date: string; eventos: number }> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split('T')[0]
      daysMap[key] = { date: key, eventos: 0 }
    }
    recentEvents.forEach((e) => {
      const key = e.timestamp.toISOString().split('T')[0]
      if (daysMap[key]) daysMap[key].eventos++
    })
    const timeline = Object.values(daysMap).map((d) => ({
      ...d,
      date: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
    }))

    // Eventos por funil
    const funnelEvents = funnelIds.length > 0
      ? await prisma.funnelEvent.groupBy({
          by: ['funnelId'],
          where: { funnelId: { in: funnelIds }, timestamp: { gte: sevenDaysAgo } },
          _count: { id: true },
        })
      : []

    return NextResponse.json({
      owner: member.owner,
      member: { id: member.id, email: member.email, name: member.name, role: member.role },
      overview: {
        totalEvents,
        totalLeads,
        totalFunnels,
        activeFunnels,
        eventsToday,
        events7d,
        events30d,
        leadsToday,
        leads7d,
        leads30d,
      },
      timeline,
      leadStatus: leadStatus.map((s) => ({ status: s.stage || 'Sem status', count: s._count.id })),
      campaigns,
      funnels: funnels.map((f) => ({
        ...f,
        events: funnelEvents.find((e) => e.funnelId === f.id)?._count.id || 0,
      })),
      goals: goals.map((g) => ({
        ...g,
        progress: g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
      })),
    })
  } catch (error) {
    console.error('Erro no viewer dashboard:', error)
    return NextResponse.json({ error: 'Erro interno', detail: String(error) }, { status: 500 })
  }
}
