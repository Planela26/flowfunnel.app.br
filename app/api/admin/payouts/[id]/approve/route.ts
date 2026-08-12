import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { approvePayout } from '@/lib/affiliate-ledger'

// POST /api/admin/payouts/:id/approve — REQUESTED -> APPROVED (§24.5/24.6).
// Nenhum movimento de ledger (dinheiro já reservado na solicitação).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:payouts:approve:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { id } = await params
  const payout = await approvePayout(id, auth.userId)
  if (!payout) return NextResponse.json({ error: 'Payout não encontrado ou não está REQUESTED' }, { status: 409 })

  await logAudit({
    action: 'affiliate.wallet.payout_approved',
    userId: auth.userId,
    entityType: 'AffiliatePayout',
    entityId: payout.id,
    request,
  })

  return NextResponse.json({ payout })
}
