import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { cancelPayout } from '@/lib/affiliate-ledger'

// POST /api/affiliate/wallet/payout/:id/cancel — cancela o PRÓPRIO saque,
// só se ainda REQUESTED (§24.6). Posse e estado verificados na mesma
// operação atômica — 0 linhas cobre "não é seu" e "não está mais
// cancelável" com a mesma resposta, sem revelar qual dos dois é o caso
// (evita oráculo).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(`affiliate:wallet:payout:cancel:${session.user.id}`, 10, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const affiliate = await prismaAdmin.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!affiliate) return NextResponse.json({ error: 'Não é afiliado' }, { status: 404 })

  const { id } = await params
  const payout = await cancelPayout(id, affiliate.id)
  if (!payout) return NextResponse.json({ error: 'Saque não encontrado ou não cancelável' }, { status: 404 })

  await logAudit({
    action: 'affiliate.wallet.payout_cancelled',
    userId: session.user.id,
    entityType: 'AffiliatePayout',
    entityId: payout.id,
    request: _request,
  })

  return NextResponse.json({ payout })
}
