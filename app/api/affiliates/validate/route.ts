import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'

export async function POST(request: Request) {
  try {
    // Rota pública (visitante anônimo, sem sessão) — sem isto, o keyspace de
    // códigos de afiliado (curtos, alfanuméricos) é enumerável por força bruta.
    const rl = await checkRateLimit(`affiliates:validate:${getClientIp(request.headers)}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
    }

    const { code } = await request.json()
    if (!code || typeof code !== 'string' || code.length > 40) {
      return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })
    }

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
    return NextResponse.json({ error: 'Não foi possível validar o código.' }, { status: 500 })
  }
}
