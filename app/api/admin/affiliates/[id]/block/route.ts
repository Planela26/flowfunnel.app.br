import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'

// POST /api/admin/affiliates/:id/block — bloqueia o afiliado (§24.6).
// Nenhum campo de corpo além do :id no path.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const rl = await checkRateLimit(`admin:affiliates:block:${auth.userId}`, 10, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

  const { id: affiliateId } = await params

  const { count } = await prisma.affiliate.updateMany({
    where: { id: affiliateId, status: 'ACTIVE' },
    data: { status: 'BLOCKED' },
  })
  if (count === 0) {
    return NextResponse.json({ error: 'Afiliado não encontrado ou já bloqueado' }, { status: 404 })
  }

  await logAudit({
    action: 'affiliate.blocked',
    userId: auth.userId,
    entityType: 'Affiliate',
    entityId: affiliateId,
    request,
  })

  return NextResponse.json({ ok: true })
}
