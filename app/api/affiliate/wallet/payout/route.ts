import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { reservePayout, InsufficientBalanceError, MIN_PAYOUT_AMOUNT } from '@/lib/affiliate-ledger'

// POST /api/affiliate/wallet/payout — solicitar saque (§9/§24.6).
// Input permitido: { amount, idempotencyKey } — nada mais. affiliateId e
// pixKey são sempre derivados do servidor (sessão / cadastro), nunca do
// corpo. `amount` nunca é tratado como "quanto está disponível" — é só
// "quanto o afiliado deseja sacar", validado pelo UPDATE atômico dentro de
// reserve_payout_amount() (Seção 8).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(`affiliate:wallet:payout:${session.user.id}`, 5, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas solicitações' }, { status: 429 })

  const affiliate = await prismaAdmin.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, pixKey: true },
  })
  if (!affiliate) return NextResponse.json({ error: 'Não é afiliado' }, { status: 404 })
  if (affiliate.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Conta de afiliado bloqueada' }, { status: 403 })
  }
  if (!affiliate.pixKey) {
    return NextResponse.json({ error: 'Cadastre uma chave Pix antes de solicitar saque' }, { status: 400 })
  }

  const { amount, idempotencyKey } = await request.json()
  const parsedAmount = Number(amount)
  if (!Number.isFinite(parsedAmount) || Math.round(parsedAmount * 100) / 100 !== parsedAmount) {
    return NextResponse.json({ error: 'amount inválido' }, { status: 400 })
  }
  if (parsedAmount < MIN_PAYOUT_AMOUNT) {
    return NextResponse.json({ error: `Saque mínimo de R$ ${MIN_PAYOUT_AMOUNT.toFixed(2)}` }, { status: 400 })
  }
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return NextResponse.json({ error: 'idempotencyKey é obrigatório' }, { status: 400 })
  }

  try {
    const { payout, created } = await reservePayout({
      affiliateId: affiliate.id,
      amount: parsedAmount,
      pixKey: affiliate.pixKey,
      idempotencyKey: idempotencyKey.trim(),
    })

    if (created) {
      await logAudit({
        action: 'affiliate.wallet.payout_requested',
        userId: session.user.id,
        entityType: 'AffiliatePayout',
        entityId: payout.id,
        metadata: { amount: parsedAmount },
        request,
      })
    }

    return NextResponse.json({ payout }, { status: created ? 201 : 200 })
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: 'Saldo disponível insuficiente' }, { status: 400 })
    }
    console.error('Erro ao solicitar saque:', error)
    return NextResponse.json({ error: 'Erro ao solicitar saque' }, { status: 500 })
  }
}
