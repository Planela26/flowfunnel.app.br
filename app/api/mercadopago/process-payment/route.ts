import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBaseUrl } from '@/lib/base-url'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { createPayment, getPlanPrice, getPlanName } from '@/lib/mercadopago'
import { Plan } from '@/lib/plans'
import { randomUUID } from 'crypto'
import { getAttributionAffiliateId } from '@/lib/affiliate-attribution'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PLAN_KEYS: Record<string, Plan> = {
  START: 'START',
  PRO: 'PRO',
  SCALE: 'SCALE',
}

export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(
      `mp:process-payment:${getClientIp(request.headers)}`,
      10,
      60_000
    )
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      plan,
      couponCode,
      idempotencyKey,
      // Payment Brick formData
      token,
      payment_method_id,
      issuer_id,
      installments,
    } = body

    // Idempotency key is generated client-side per checkout attempt and reused on
    // retries/double-submits so Mercado Pago dedups them. Fall back to a fresh UUID
    // if the client didn't send a valid one.
    const idemKey = typeof idempotencyKey === 'string' && UUID_RE.test(idempotencyKey)
      ? idempotencyKey
      : randomUUID()

    const planKey = plan?.toUpperCase()
    const planName = PLAN_KEYS[planKey]
    if (!planName) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    if (!payment_method_id) {
      return NextResponse.json({ error: 'Método de pagamento ausente' }, { status: 400 })
    }

    const basePrice = getPlanPrice(planName)
    if (basePrice === 0) {
      return NextResponse.json({ error: 'Plano não disponível para pagamento' }, { status: 400 })
    }

    // Cookie de atribuição verificado (Fase 3, §18/§24.4) — nunca lemos
    // affiliateId do corpo. Mesmo padrão de app/api/mercadopago/create-preference.
    const cookieAffiliateId = getAttributionAffiliateId(request)

    // Desconto: cupom digitado manualmente tem prioridade; na ausência dele,
    // cai para o afiliado rastreado pelo cookie. Não decide atribuição de
    // comissão — isso é resolvido separadamente, depois do userId.
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

    // Atribuição de comissão — Fase 3 (§18/§24.4). Prioridade:
    // User.referredByAffiliateId já congelado > cookie ff_attr > null.
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredByAffiliateId: true },
    })
    let validAffiliateId: string | null = existingUser?.referredByAffiliateId ?? null

    if (!validAffiliateId) validAffiliateId = cookieAffiliateId

    const webhookBase = getBaseUrl()

    const externalRef = validAffiliateId
      ? `${userId}:${planKey}:${validAffiliateId}`
      : `${userId}:${planKey}`

    // Build payer for the payment
    const paymentPayer: any = {
      email: payerEmail,
    }
    if (payerName) {
      const [firstName, ...rest] = payerName.split(' ')
      paymentPayer.first_name = firstName
      if (rest.length) paymentPayer.last_name = rest.join(' ')
    }

    const paymentInput: any = {
      transaction_amount: finalPrice,
      description: getPlanName(planName),
      payment_method_id,
      payer: paymentPayer,
      external_reference: externalRef,
      notification_url: `${webhookBase}/api/webhooks/mercadopago`,
    }

    // Card payments include a token + installments + issuer
    if (token) {
      paymentInput.token = token
      paymentInput.installments = installments || 1
      if (issuer_id) paymentInput.issuer_id = issuer_id
    }

    const payment = await createPayment(paymentInput, idemKey)

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
      discountPercent,
      finalPrice,
      // PIX data
      qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
      qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
      // Boleto data
      boleto_url: payment.transaction_details?.external_resource_url || null,
    })
  } catch (error: any) {
    console.error('Erro ao processar pagamento Mercado Pago:', error)
    return NextResponse.json(
      { error: 'Erro ao processar o pagamento. Tente novamente.' },
      { status: 500 }
    )
  }
}
