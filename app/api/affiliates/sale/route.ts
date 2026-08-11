import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

// Endpoint administrativo para registro manual de venda de afiliado.
// O fluxo automático roda via webhook do Stripe/Mercado Pago (Fase 2, ainda
// não implementada — ver AFFILIATE_WALLET_ARCHITECTURE.md). Mantemos este
// endpoint apenas para casos excepcionais, com gate de ADMIN.
//
// LIMITAÇÃO CONHECIDA E DELIBERADA: esta rota cria AffiliateSale +
// AffiliateCommission juntas (mesma transação), mas NÃO grava a entrada de
// ledger (COMMISSION_ACCRUE) nem atualiza AffiliateWallet — esse fiação é
// parte da engine de comissão (Fase 2), fora do escopo desta rodada. Uma
// comissão criada por aqui fica PENDING sem refletir no saldo até a engine
// existir. Documentado, não escondido.
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

    // Percentual sempre lido do banco — nunca aceito do corpo da requisição,
    // mesmo sendo rota admin (Seção 9 do pedido: dado financeiro nunca vem
    // do cliente).
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { commissionPercent: true },
    })
    if (!affiliate) {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })
    }

    // Idempotência: mesmo (processor, externalPaymentId) nunca gera 2ª venda.
    const existing = await prisma.affiliateSale.findUnique({
      where: { processor_externalPaymentId: { processor, externalPaymentId: String(externalPaymentId) } },
      include: { commission: true },
    })
    if (existing) return NextResponse.json({ sale: existing })

    const commissionPercent = Number(affiliate.commissionPercent)
    // ROUND_HALF_UP em 2 casas, mesma regra formal da Seção C do desenho.
    const commissionAmount = Math.round(disc * commissionPercent) / 100

    const RETENTION_DAYS = 15 // Decisão D do desenho — retenção antes de AVAILABLE
    const maturesAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000)

    // Sale + Commission na MESMA transação (Seção 24.2/24.3) — nunca uma
    // venda órfã sem comissão, mesmo em falha parcial.
    const sale = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.affiliateSale.create({
        data: {
          affiliateId,
          userId: userId || null,
          processor,
          externalPaymentId: String(externalPaymentId),
          externalSubscriptionId: externalSubscriptionId ? String(externalSubscriptionId) : null,
          type,
          plan: String(plan),
          originalAmount: orig,
          discountedAmount: disc,
        },
      })
      await tx.affiliateCommission.create({
        data: {
          saleId: createdSale.id,
          affiliateId,
          amount: commissionAmount,
          commissionPercentSnapshot: commissionPercent,
          maturesAt,
        },
      })
      return tx.affiliateSale.findUniqueOrThrow({
        where: { id: createdSale.id },
        include: { commission: true },
      })
    })

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao registrar venda de afiliado:', error)
    return NextResponse.json({ error: 'Erro ao registrar venda' }, { status: 500 })
  }
}
