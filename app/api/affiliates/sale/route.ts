import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

// Endpoint administrativo para registro manual de venda de afiliado.
// O fluxo automático ocorre via webhook do Stripe (que verifica assinatura).
// Mantemos este endpoint apenas para casos excepcionais e com gate de ADMIN.
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { affiliateId, userId, stripePaymentId, plan, originalAmount, discountedAmount } = await request.json()

    if (!affiliateId || !stripePaymentId || !plan) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const orig = Number(originalAmount)
    const disc = Number(discountedAmount)
    if (!Number.isFinite(orig) || !Number.isFinite(disc) || orig < 0 || disc < 0) {
      return NextResponse.json({ error: 'Valores inválidos' }, { status: 400 })
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { commissionPercent: true },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })
    }

    const commissionAmount = (disc * affiliate.commissionPercent) / 100

    const existing = await prisma.affiliateSale.findUnique({ where: { stripePaymentId } })
    if (existing) return NextResponse.json({ sale: existing })

    const sale = await prisma.affiliateSale.create({
      data: {
        affiliateId,
        userId: userId || null,
        stripePaymentId: String(stripePaymentId),
        plan: String(plan),
        originalAmount: orig,
        discountedAmount: disc,
        commissionAmount,
      },
    })

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao registrar venda de afiliado:', error)
    return NextResponse.json({ error: 'Erro ao registrar venda' }, { status: 500 })
  }
}
