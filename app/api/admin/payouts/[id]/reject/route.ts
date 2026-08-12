import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { rejectPayout } from '@/lib/affiliate-ledger'

// POST /api/admin/payouts/:id/reject — REQUESTED -> REJECTED (§24.5/24.6).
// Ex.: suspeita de fraude. reason obrigatório; libera a reserva e sinaliza
// para revisão.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:payouts:reject:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { reason } = await request.json().catch(() => ({ reason: null }))
  if (typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'reason é obrigatório' }, { status: 400 })
  }

  const { id } = await params
  const payout = await rejectPayout(id, auth.userId, reason.trim())
  if (!payout) return NextResponse.json({ error: 'Payout não encontrado ou não está REQUESTED' }, { status: 409 })

  await logAudit({
    action: 'affiliate.wallet.payout_rejected',
    userId: auth.userId,
    entityType: 'AffiliatePayout',
    entityId: payout.id,
    metadata: { reason: reason.trim() },
    request,
  })

  return NextResponse.json({ payout })
}
