import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { markPayoutPaid } from '@/lib/affiliate-ledger'

// POST /api/admin/payouts/:id/mark-paid — APPROVED -> PAID (§24.5/24.6).
// Admin confirma que o Pix foi enviado manualmente. Emite PAYOUT_SETTLE
// (débito final de RESERVED), idempotente via payout-settle:${payoutId}.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:payouts:mark-paid:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { id } = await params
  const payout = await markPayoutPaid(id, auth.userId)
  if (!payout) return NextResponse.json({ error: 'Payout não encontrado ou não está APPROVED' }, { status: 409 })

  await logAudit({
    action: 'affiliate.wallet.payout_paid',
    userId: auth.userId,
    entityType: 'AffiliatePayout',
    entityId: payout.id,
    metadata: { amount: Number(payout.amount), paidAt: payout.paidAt },
    request,
  })

  return NextResponse.json({ payout })
}
