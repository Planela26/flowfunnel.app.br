import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { code } = await request.json()
    if (!code) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })

    const affiliate = await prisma.affiliate.findUnique({
      where: { code: code.toUpperCase().trim() },
      select: {
        id: true,
        name: true,
        code: true,
        discountPercent: true,
        commissionPercent: true,
        stripeCouponId: true,
        isActive: true,
      },
    })

    if (!affiliate || !affiliate.isActive) {
      return NextResponse.json({ error: 'Código inválido ou inativo' }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        code: affiliate.code,
        discountPercent: affiliate.discountPercent,
        stripeCouponId: affiliate.stripeCouponId,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
