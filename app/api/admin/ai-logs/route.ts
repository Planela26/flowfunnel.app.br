import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── GET /api/admin/ai-logs ─ dashboard de IA ──────────────────────────────────
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, parseInt(searchParams.get('days') ?? '30'))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [logs, byAction, byCategory, totals] = await Promise.all([
      // Last 50 logs
      prisma.aILog.findMany({
        where:   { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),
      // Group by action
      prisma.aILog.groupBy({
        by:    ['action'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum:   { totalTokens: true, costUsd: true },
      }),
      // Group by category
      prisma.aILog.groupBy({
        by:    ['category'],
        where: { createdAt: { gte: since }, category: { not: null } },
        _count: { _all: true },
      }),
      // Aggregate totals
      prisma.aILog.aggregate({
        where: { createdAt: { gte: since } },
        _count:  { _all: true },
        _sum:    { totalTokens: true, costUsd: true, durationMs: true },
        _avg:    { durationMs: true },
      }),
    ])

    // Acceptance rate (analyze_ticket logs with accepted != null)
    const tracked   = await prisma.aILog.count({ where: { action: 'analyze_ticket', accepted: { not: null } } })
    const accepted  = await prisma.aILog.count({ where: { action: 'analyze_ticket', accepted: true } })
    const acceptRate = tracked > 0 ? Math.round((accepted / tracked) * 100) : null

    // Daily activity (last 30 days) — raw query for grouping by date
    const dailyRaw = await prisma.$queryRaw<{ day: string; count: number; cost: number }[]>`
      SELECT DATE("createdAt")::text AS day, COUNT(*)::int AS count, SUM("costUsd") AS cost
      FROM "AILog"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `

    return NextResponse.json({
      summary: {
        totalCalls:      totals._count._all,
        totalTokens:     totals._sum.totalTokens    ?? 0,
        totalCostUsd:    totals._sum.costUsd         ?? 0,
        avgDurationMs:   Math.round(totals._avg.durationMs ?? 0),
        acceptanceRate:  acceptRate,
      },
      byAction:   byAction.map(a => ({
        action: a.action,
        count:  a._count._all,
        tokens: a._sum.totalTokens ?? 0,
        cost:   a._sum.costUsd     ?? 0,
      })),
      byCategory: byCategory.map(c => ({
        category: c.category,
        count:    c._count._all,
      })),
      daily: dailyRaw,
      recentLogs: logs,
    })
  } catch (err) {
    console.error('[ai-logs GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── PATCH /api/admin/ai-logs/[id]/accept — mark suggestion accepted/rejected ──
// This is handled via POST body to keep it simple
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { ticketId, accepted } = await request.json()
    if (!ticketId || typeof accepted !== 'boolean') {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    await prisma.aILog.updateMany({
      where: { ticketId, action: 'analyze_ticket' },
      data:  { accepted },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
