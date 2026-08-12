import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'
import { createCommissionFromSale } from '@/lib/affiliate-ledger'

// Endpoint administrativo para registro manual de venda de afiliado.
// O fluxo automático roda via webhook do Stripe/Mercado Pago (Fase 4/5,
// ainda não implementadas — ver AFFILIATE_WALLET_ARCHITECTURE.md). Mantemos
// este endpoint para casos excepcionais, com gate de ADMIN.
//
// Delega para lib/affiliate-ledger.ts (Fase 2): cria AffiliateSale +
// AffiliateCommission + a entrada COMMISSION_ACCRUE do ledger + atualiza
// AffiliateWallet, tudo na mesma transação — a mesma função que os
// handlers de webhook chamarão nas Fases 4/5.
const PROCESSORS = ['STRIPE', 'MERCADOPAGO'] as const
const SALE_TYPES = ['INITIAL', 'RENEWAL'] as const

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const {
      affiliateId, userId, processor, externalPaymentId, externalSubscriptionId,
      type, plan, originalAmount, discountedAmount,
    } = await request.json()

    if (!affiliateId || !externalPaymentId || !plan) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (!PROCESSORS.includes(processor)) {
      return NextResponse.json({ error: 'processor deve ser STRIPE ou MERCADOPAGO' }, { status: 400 })
    }
    if (!SALE_TYPES.includes(type)) {
      return NextResponse.json({ error: 'type deve ser INITIAL ou RENEWAL' }, { status: 400 })
    }

    const orig = Number(originalAmount)
    const disc = Number(discountedAmount)
    if (!Number.isFinite(orig) || !Number.isFinite(disc) || orig < 0 || disc < 0) {
      return NextResponse.json({ error: 'Valores inválidos' }, { status: 400 })
    }

    const affiliateExists = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { id: true },
    })
    if (!affiliateExists) {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })
    }

    // Percentual sempre lido do banco dentro de createCommissionFromSale —
    // nunca aceito do corpo da requisição, mesmo sendo rota admin (Seção 9
    // do desenho: dado financeiro nunca vem do cliente).
    const { sale, created } = await createCommissionFromSale({
      affiliateId,
      userId: userId || null,
      processor,
      externalPaymentId: String(externalPaymentId),
      externalSubscriptionId: externalSubscriptionId ? String(externalSubscriptionId) : null,
      type,
      plan: String(plan),
      originalAmount: orig,
      discountedAmount: disc,
    })

    return NextResponse.json({ sale }, { status: created ? 201 : 200 })
  } catch (error: any) {
    console.error('Erro ao registrar venda de afiliado:', error)
    return NextResponse.json({ error: 'Erro ao registrar venda' }, { status: 500 })
  }
}
