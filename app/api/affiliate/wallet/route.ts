import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'

// GET /api/affiliate/wallet — saldo do próprio afiliado (§24.6).
// affiliateId nunca vem de query/param — sempre resolvido pela sessão.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(`affiliate:wallet:${session.user.id}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const affiliate = await prismaAdmin.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true },
  })
  if (!affiliate) return NextResponse.json({ error: 'Não é afiliado' }, { status: 404 })

  const wallet = await prismaAdmin.affiliateWallet.findUnique({
    where: { affiliateId: affiliate.id },
  })
  if (!wallet) return NextResponse.json({ error: 'Carteira não encontrada' }, { status: 404 })

  return NextResponse.json({
    wallet: {
      pendingBalance: Number(wallet.pendingBalance),
      availableBalance: Number(wallet.availableBalance),
      reservedBalance: Number(wallet.reservedBalance),
      lifetimeEarned: Number(wallet.lifetimeEarned),
      lifetimePaid: Number(wallet.lifetimePaid),
      updatedAt: wallet.updatedAt,
    },
    affiliateStatus: affiliate.status,
  })
}
