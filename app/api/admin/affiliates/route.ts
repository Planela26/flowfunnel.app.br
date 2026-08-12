import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'

// GET /api/admin/affiliates — lista + filtro por status (§24.6).
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:affiliates:list:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)

  const affiliates = await prisma.affiliate.findMany({
    where: {
      ...(status === 'ACTIVE' || status === 'BLOCKED' ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { wallet: true, _count: { select: { sales: true, payouts: true } } },
  })

  return NextResponse.json({
    affiliates: affiliates.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      code: a.code,
      status: a.status,
      commissionPercent: Number(a.commissionPercent),
      discountPercent: Number(a.discountPercent),
      sales: a._count.sales,
      payouts: a._count.payouts,
      wallet: a.wallet
        ? {
            pendingBalance: Number(a.wallet.pendingBalance),
            availableBalance: Number(a.wallet.availableBalance),
            reservedBalance: Number(a.wallet.reservedBalance),
            lifetimeEarned: Number(a.wallet.lifetimeEarned),
            lifetimePaid: Number(a.wallet.lifetimePaid),
          }
        : null,
      createdAt: a.createdAt,
    })),
  })
}
