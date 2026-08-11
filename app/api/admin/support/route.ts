import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// Painel administrativo: lê chamados de todos os tenants por design, sob o gate
// de `role === 'ADMIN'`. Usa o client sem RLS conforme documentado em lib/prisma.ts.
import { prismaAdmin as prisma } from '@/lib/prisma'

// ── GET /api/admin/support ─ dashboard stats + ticket list ───────────────────
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const status   = searchParams.get('status')   ?? undefined
    const priority = searchParams.get('priority') ?? undefined
    const type     = searchParams.get('type')     ?? undefined
    const q        = searchParams.get('q')        ?? undefined
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit    = 25

    const where: any = {}
    if (status)   where.status   = status
    if (priority) where.priority = priority
    if (type)     where.type     = type
    if (q)        where.OR = [
      { subject: { contains: q, mode: 'insensitive' } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { user: { name:  { contains: q, mode: 'insensitive' } } },
    ]

    const [tickets, total, stats] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, plan: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
      // Dashboard stats
      prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    const byPriority = await prisma.supportTicket.groupBy({ by: ['priority'], _count: { _all: true } })
    const byType     = await prisma.supportTicket.groupBy({ by: ['type'],     _count: { _all: true } })

    // Avg first response time (ms)
    const withResponse = await prisma.supportTicket.findMany({
      where: { firstResponseAt: { not: null } },
      select: { createdAt: true, firstResponseAt: true },
      take: 100,
    })
    const avgResponseMs = withResponse.length
      ? withResponse.reduce((acc, t) => acc + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / withResponse.length
      : 0

    return NextResponse.json({
      tickets,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        byStatus:   Object.fromEntries(stats.map(s => [s.status, s._count._all])),
        byPriority: Object.fromEntries(byPriority.map(s => [s.priority, s._count._all])),
        byType:     Object.fromEntries(byType.map(s => [s.type, s._count._all])),
        avgResponseHours: Math.round(avgResponseMs / 1000 / 60 / 60 * 10) / 10,
      },
    })
  } catch (err) {
    console.error('[admin/support GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
