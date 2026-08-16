import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBaseUrl } from '@/lib/base-url'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { createPreference, getPlanPrice, getPlanName } from '@/lib/mercadopago'
import { Plan } from '@/lib/plans'
import { getAttributionAffiliateId } from '@/lib/affiliate-attribution'

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

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { plan, couponCode, cpf } = body
    const planKey = plan?.toUpperCase()
    const planName = PLAN_KEYS[planKey]

    if (!planName) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    let basePrice = getPlanPrice(planName)
    if (basePrice === 0) {
      return NextResponse.json({ error: 'Plano não disponível para pagamento' }, { status: 400 })
    }

    // Cookie de atribuição verificado (Fase 3, §18/§24.4) — nunca lemos
    // affiliateId do corpo. Usado abaixo tanto para o desconto automático
    // (preserva o comportamento existente: visitante rastreado por um
    // afiliado ganha desconto mesmo sem digitar cupom) quanto, mais adiante,
    // como fallback de atribuição de comissão.
    const cookieAffiliateId = getAttributionAffiliateId(request)

    // Desconto: cupom digitado manualmente tem prioridade; na ausência dele,
    // cai para o afiliado rastreado pelo cookie — mesma UX de antes, só troca
    // a fonte de confiança de "corpo da requisição" para "cookie assinado".
    // Não decide atribuição de comissão — isso é resolvido mais abaixo,
    // separadamente, depois que o userId estiver disponível.
    let discountPercent = 0
    let discountResolved = false
    if (couponCode) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { code: couponCode.toUpperCase() },
        select: { discountPercent: true, status: true },
      })
      if (affiliate && affiliate.status === 'ACTIVE') {
        discountPercent = Number(affiliate.discountPercent)
        discountResolved = true
      }
    }
    if (!discountResolved && cookieAffiliateId) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: cookieAffiliateId },
        select: { discountPercent: true, status: true },
      })
      if (affiliate && affiliate.status === 'ACTIVE') {
        discountPercent = Number(affiliate.discountPercent)
      }
    }

    // Arredonda em centavos, não em reais: com preços terminados em ,90 o
    // Math.round simples devolvia o valor inteiro e engolia os centavos.
    const finalPrice = discountPercent > 0
      ? Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100
      : basePrice

    // Autenticado via middleware + getServerSession check acima — sempre tem user
    const userId = session.user.id
    const payerEmail = session.user.email!
    const payerName = session.user.name || undefined

    // Atribuição de comissão — Fase 3 (§18/§24.4). NUNCA lê affiliateId do
    // corpo. Prioridade: User.referredByAffiliateId já congelado > cookie
    // ff_attr verificado > null (checkout orgânico).
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredByAffiliateId: true },
    })
    let validAffiliateId: string | null = existingUser?.referredByAffiliateId ?? null

    if (!validAffiliateId) validAffiliateId = cookieAffiliateId

    const baseUrl = getBaseUrl()
    const webhookBase = baseUrl

    // Build external reference: userId:plan:affiliateId
    const externalRef = validAffiliateId
      ? `${userId}:${planKey}:${validAffiliateId}`
      : `${userId}:${planKey}`

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
      { error: 'Erro ao iniciar o pagamento. Tente novamente.' },
      { status: 500 }
    )
  }
}
