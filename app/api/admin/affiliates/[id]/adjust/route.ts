import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { adjustBalance } from '@/lib/affiliate-ledger'

const ACCOUNTS = ['PENDING', 'AVAILABLE', 'RESERVED'] as const

// POST /api/admin/affiliates/:id/adjust — correção manual de saldo (§24.6).
// reason é obrigatório; nunca aceita nada além de {account, amount, reason}.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:affiliates:adjust:${auth.userId}`, 10, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { id: affiliateId } = await params
  const { account, amount, reason } = await request.json()

  if (!ACCOUNTS.includes(account)) {
    return NextResponse.json({ error: 'account deve ser PENDING, AVAILABLE ou RESERVED' }, { status: 400 })
  }
  const parsedAmount = Number(amount)
  if (!Number.isFinite(parsedAmount) || parsedAmount === 0 || Math.round(parsedAmount * 100) / 100 !== parsedAmount) {
    return NextResponse.json({ error: 'amount inválido' }, { status: 400 })
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'reason é obrigatório' }, { status: 400 })
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId }, select: { id: true } })
  if (!affiliate) return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })

  const walletBefore = await prisma.affiliateWallet.findUnique({ where: { affiliateId } })

  const walletAfter = await adjustBalance({
    affiliateId,
    account,
    amount: parsedAmount,
    reason: reason.trim(),
    adminId: auth.userId,
  })

  await logAudit({
    action: 'affiliate.commission.adjusted',
    userId: auth.userId,
    entityType: 'Affiliate',
    entityId: affiliateId,
    metadata: {
      account,
      amount: parsedAmount,
      reason: reason.trim(),
      balanceBefore: walletBefore
        ? {
            pendingBalance: Number(walletBefore.pendingBalance),
            availableBalance: Number(walletBefore.availableBalance),
            reservedBalance: Number(walletBefore.reservedBalance),
          }
        : null,
      balanceAfter: {
        pendingBalance: Number(walletAfter.pendingBalance),
        availableBalance: Number(walletAfter.availableBalance),
        reservedBalance: Number(walletAfter.reservedBalance),
      },
    },
    request,
  })

  return NextResponse.json({
    wallet: {
      pendingBalance: Number(walletAfter.pendingBalance),
      availableBalance: Number(walletAfter.availableBalance),
      reservedBalance: Number(walletAfter.reservedBalance),
    },
  })
}
