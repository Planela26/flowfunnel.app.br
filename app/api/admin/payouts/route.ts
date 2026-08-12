import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'

const STATUSES = ['REQUESTED', 'APPROVED', 'PAID', 'FAILED', 'CANCELLED', 'REJECTED'] as const

// GET /api/admin/payouts — fila de payouts, filtro por status (§24.6).
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:payouts:list:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)

  const payouts = await prisma.affiliatePayout.findMany({
    where: (STATUSES as readonly string[]).includes(status || '') ? { status: status as any } : {},
    orderBy: { requestedAt: 'desc' },
    take: limit,
    include: { affiliate: { select: { id: true, name: true, email: true, code: true } } },
  })

  return NextResponse.json({
    payouts: payouts.map(p => ({
      id: p.id,
      affiliate: p.affiliate,
      amount: Number(p.amount),
      pixKey: p.pixKey,
      status: p.status,
      requestedAt: p.requestedAt,
      reviewedBy: p.reviewedBy,
      reviewedAt: p.reviewedAt,
      paidAt: p.paidAt,
      failureReason: p.failureReason,
      adminNote: p.adminNote,
    })),
  })
}
