import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'

// GET /api/affiliate/wallet/ledger — histórico paginado do próprio afiliado
// (§24.6). Input permitido: cursor, limit — nunca affiliateId.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(`affiliate:wallet:ledger:${session.user.id}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const affiliate = await prismaAdmin.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!affiliate) return NextResponse.json({ error: 'Não é afiliado' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100)

  const entries = await prismaAdmin.affiliateLedgerEntry.findMany({
    where: { affiliateId: affiliate.id },
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
      reason: e.reason,
      createdAt: e.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  })
}
