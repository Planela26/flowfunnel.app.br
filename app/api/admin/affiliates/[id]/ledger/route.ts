import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'

// GET /api/admin/affiliates/:id/ledger — ledger completo de qualquer
// afiliado (§24.6). Paginado.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:affiliates:ledger:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { id: affiliateId } = await params
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)

  const entries = await prisma.affiliateLedgerEntry.findMany({
    where: { affiliateId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = entries.length > limit
  const page = hasMore ? entries.slice(0, limit) : entries

  return NextResponse.json({
    entries: page.map(e => ({
      id: e.id,
      account: e.account,
      amount: Number(e.amount),
      type: e.type,
      transferGroupId: e.transferGroupId,
      commissionId: e.commissionId,
      payoutId: e.payoutId,
      reason: e.reason,
      createdBy: e.createdBy,
      createdAt: e.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  })
}
