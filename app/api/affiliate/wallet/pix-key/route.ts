import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'

// PUT /api/affiliate/wallet/pix-key — cadastra/atualiza a chave Pix de
// destino dos próprios saques. Não valida formato de CPF/CNPJ/e-mail/celular/
// chave aleatória (fora de escopo desta fase) — só sanidade básica. A
// responsabilidade de conferir que a chave é sua permanece do afiliado; o
// valor cadastrado aqui é o que POST /wallet/payout sempre usa, ignorando
// qualquer chave enviada no corpo do pedido de saque (§9).
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await checkRateLimit(`affiliate:wallet:pixkey:${session.user.id}`, 5, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

  const affiliate = await prismaAdmin.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!affiliate) return NextResponse.json({ error: 'Não é afiliado' }, { status: 404 })

  const { pixKey } = await request.json()
  const trimmed = typeof pixKey === 'string' ? pixKey.trim() : ''
  if (!trimmed || trimmed.length > 140) {
    return NextResponse.json({ error: 'Chave Pix inválida' }, { status: 400 })
  }

  await prismaAdmin.affiliate.update({
    where: { id: affiliate.id },
    data: { pixKey: trimmed },
  })

  await logAudit({
    action: 'affiliate.wallet.pix_key_updated',
    userId: session.user.id,
    entityType: 'Affiliate',
    entityId: affiliate.id,
    request,
  })

  return NextResponse.json({ ok: true })
}
