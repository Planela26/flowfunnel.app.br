import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SaraInsightsService } from '@/lib/sara-insights'
import { SaraObserver } from '@/lib/sara-observer'

// ── GET /api/sara/insights ─────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit      = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

    const [insights, summary] = await Promise.all([
      prisma.saraInsight.findMany({
        where:   { userId: session.user.id, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take:    limit,
      }),
      SaraInsightsService.getSummary(session.user.id),
    ])

    return NextResponse.json({ insights, summary })
  } catch (err) {
    console.error('[sara/insights GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── PATCH /api/sara/insights ─ mark as read ────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { insightId } = await request.json()
    await SaraObserver.markRead(session.user.id, insightId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── POST /api/sara/insights ─ trigger analysis ─────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const generated = await SaraInsightsService.analyzeUser(session.user.id)
    return NextResponse.json({ generated })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
