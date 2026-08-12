import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { markPayoutFailed } from '@/lib/affiliate-ledger'

// POST /api/admin/payouts/:id/mark-failed — APPROVED -> FAILED (§24.5/24.6).
// Pix não foi enviado com sucesso; libera a reserva, afiliado pode solicitar
// de novo.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:payouts:mark-failed:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { failureReason } = await request.json().catch(() => ({ failureReason: null }))
  if (typeof failureReason !== 'string' || !failureReason.trim()) {
    return NextResponse.json({ error: 'failureReason é obrigatório' }, { status: 400 })
  }

  const { id } = await params
  const payout = await markPayoutFailed(id, auth.userId, failureReason.trim())
  if (!payout) return NextResponse.json({ error: 'Payout não encontrado ou não está APPROVED' }, { status: 409 })

  await logAudit({
    action: 'affiliate.wallet.payout_failed',
    userId: auth.userId,
    entityType: 'AffiliatePayout',
    entityId: payout.id,
    metadata: { failureReason: failureReason.trim() },
    request,
  })

  return NextResponse.json({ payout })
}
