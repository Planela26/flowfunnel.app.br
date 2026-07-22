import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { createPreference, getPlanPrice, getPlanName } from '@/lib/mercadopago'
import { Plan } from '@/lib/plans'

const PLAN_KEYS: Record<string, Plan> = {
  START: 'START',
  PRO: 'PRO',
  SCALE: 'SCALE',
}

export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(`mp:create-preference:${getClientIp(request.headers)}`, 10, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })
    }

    const body = await request.json()
    const { plan, couponCode, affiliateId, email, cpf } = body
    const planKey = plan?.toUpperCase()
    const planName = PLAN_KEYS[planKey]

    if (!planName) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    let basePrice = getPlanPrice(planName)
    if (basePrice === 0) {
      return NextResponse.json({ error: 'Plano não disponível para pagamento' }, { status: 400 })
    }

    // Validate coupon/affiliate and apply discount server-side
    let discountPercent = 0
    let validAffiliateId: string | null = null
    if (couponCode) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { code: couponCode.toUpperCase() },
        select: { id: true, discountPercent: true, isActive: true },
      })
      if (affiliate && affiliate.isActive) {
        discountPercent = affiliate.discountPercent
        validAffiliateId = affiliate.id
      }
    }
    if (!validAffiliateId && affiliateId) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
        select: { id: true, discountPercent: true, isActive: true },
      })
      if (affiliate && affiliate.isActive) {
        discountPercent = affiliate.discountPercent
        validAffiliateId = affiliate.id
      }
    }

    const finalPrice = discountPercent > 0
      ? Math.round(basePrice * (1 - discountPercent / 100))
      : basePrice

    const session = await getServerSession(authOptions)
    let userId: string | null = session?.user?.id || null
    let payerEmail: string | null = session?.user?.email || email || null
    let payerName: string | undefined = session?.user?.name || undefined

    if (!userId) {
      if (!payerEmail) {
        return NextResponse.json({ error: 'E-mail é obrigatório para realizar o pagamento' }, { status: 400 })
      }
      // Procurar usuário existente pelo email
      const existingUser = await prisma.user.findUnique({
        where: { email: payerEmail },
        select: { id: true, name: true },
      })
      if (existingUser) {
        userId = existingUser.id
        payerName = existingUser.name || payerName
      }
    }

    if (!payerEmail) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}` || 'http://localhost:5000'
    const webhookBase = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}` || 'http://localhost:5000'

    // Build external reference: userId:plan:affiliateId or email:plan:affiliateId
    const userRef = userId || payerEmail
    const externalRef = validAffiliateId
      ? `${userRef}:${planKey}:${validAffiliateId}`
      : `${userRef}:${planKey}`

    const payer: any = {
      email: payerEmail,
      name: payerName || undefined,
    }
    if (cpf && /^\d{11}$/.test(cpf)) {
      payer.identification = {
        type: 'CPF',
        number: cpf,
      }
    }

    const preference = await createPreference({
      items: [{
        title: getPlanName(planName),
        unit_price: finalPrice,
        quantity: 1,
        currency_id: 'BRL',
      }],
      payer,
      back_urls: {
        success: `${baseUrl}/checkout/success?plan=${planKey}&source=mercadopago`,
        failure: `${baseUrl}/checkout/failure?plan=${planKey}&source=mercadopago`,
        pending: `${baseUrl}/checkout/pending?plan=${planKey}&source=mercadopago`,
      },
      auto_return: 'approved',
      external_reference: externalRef,
      notification_url: `${webhookBase}/api/webhooks/mercadopago`,
    })

    return NextResponse.json({
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      preference_id: preference.id,
      discountPercent,
      originalPrice: basePrice,
      finalPrice,
    })
  } catch (error: any) {
    console.error('Erro ao criar preferência Mercado Pago:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
