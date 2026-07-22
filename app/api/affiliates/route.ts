import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { requireAdmin } from '@/lib/requireAdmin'

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { clicks: true, sales: true } },
        sales: { select: { commissionAmount: true } },
      },
    })

    const result = affiliates.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      code: a.code,
      discountPercent: a.discountPercent,
      commissionPercent: a.commissionPercent,
      isActive: a.isActive,
      createdAt: a.createdAt,
      clicks: a._count.clicks,
      sales: a._count.sales,
      totalCommission: a.sales.reduce((sum, s) => sum + s.commissionAmount, 0),
    }))

    return NextResponse.json({ affiliates: result })
  } catch (error: any) {
    console.error('Erro ao listar afiliados:', error)
    return NextResponse.json({ error: 'Erro ao listar afiliados' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    const { name, email, code, discountPercent, commissionPercent } = await request.json()

    if (!name || !code || discountPercent === undefined || commissionPercent === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios: name, code, discountPercent, commissionPercent' }, { status: 400 })
    }

    const dp = Number(discountPercent)
    const cp = Number(commissionPercent)
    if (!Number.isFinite(dp) || dp < 0 || dp > 90) {
      return NextResponse.json({ error: 'discountPercent deve ser entre 0 e 90' }, { status: 400 })
    }
    if (!Number.isFinite(cp) || cp < 0 || cp > 90) {
      return NextResponse.json({ error: 'commissionPercent deve ser entre 0 e 90' }, { status: 400 })
    }

    const upperCode = String(code).toUpperCase().replace(/\s/g, '')
    if (!/^[A-Z0-9_-]{3,32}$/.test(upperCode)) {
      return NextResponse.json({ error: 'Código deve ter 3-32 caracteres alfanuméricos' }, { status: 400 })
    }

    const existing = await prisma.affiliate.findUnique({ where: { code: upperCode } })
    if (existing) {
      return NextResponse.json({ error: 'Código promocional já em uso' }, { status: 409 })
    }

    const stripe = await getUncachableStripeClient()
    const coupon = await stripe.coupons.create({
      percent_off: dp,
      duration: 'once',
      name: `Afiliado ${upperCode} - ${dp}%`,
      metadata: { affiliateCode: upperCode },
    })

    const affiliate = await prisma.affiliate.create({
      data: {
        name,
        email: email || null,
        code: upperCode,
        discountPercent: dp,
        commissionPercent: cp,
        stripeCouponId: coupon.id,
      },
    })

    return NextResponse.json({ affiliate }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao criar afiliado:', error)
    return NextResponse.json({ error: 'Erro ao criar afiliado' }, { status: 500 })
  }
}
