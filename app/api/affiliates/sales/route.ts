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
      },
    })

    return NextResponse.json({ sales })
  } catch (error: any) {
    console.error('Erro ao listar vendas de afiliados:', error)
    return NextResponse.json({ error: 'Erro ao listar vendas' }, { status: 500 })
  }
}
