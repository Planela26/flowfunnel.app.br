import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/requireAdmin'

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const sales = await prisma.affiliateSale.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        affiliate: {
          select: { name: true, code: true },
        },
        commission: { select: { amount: true } },
      },
    })

    // Achata commission.amount em commissionAmount (formato que o frontend
    // já espera) e converte Decimal -> number (Decimal serializa como string
    // via JSON e quebraria .toFixed() no cliente).
    const flattened = sales.map(({ commission, ...s }) => ({
      ...s,
      originalAmount: Number(s.originalAmount),
      discountedAmount: Number(s.discountedAmount),
      commissionAmount: Number(commission?.amount ?? 0),
    }))

    return NextResponse.json({ sales: flattened })
  } catch (error: any) {
    console.error('Erro ao listar vendas de afiliados:', error)
    return NextResponse.json({ error: 'Erro ao listar vendas' }, { status: 500 })
  }
}
