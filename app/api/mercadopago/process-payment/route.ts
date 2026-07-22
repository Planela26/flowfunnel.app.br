import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { createPayment, getPlanPrice, getPlanName } from '@/lib/mercadopago'
import { Plan } from '@/lib/plans'
import { randomUUID } from 'crypto'

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

    const body = await request.json()
    const {
      plan,
      couponCode,
      affiliateId,
      idempotencyKey,
      // Payment Brick formData
      token,
      payment_method_id,
      issuer_id,
      installments,
      payer,
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
    let payerEmail: string | null = session?.user?.email || payer?.email || null
    let payerName: string | undefined = session?.user?.name || undefined

    if (!userId) {
      if (!payerEmail) {
        return NextResponse.json({ error: 'E-mail é obrigatório para realizar o pagamento' }, { status: 400 })
      }
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

    const webhookBase = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}` || 'http://localhost:5000'

    const userRef = userId || payerEmail
    const externalRef = validAffiliateId
      ? `${userRef}:${planKey}:${validAffiliateId}`
      : `${userRef}:${planKey}`

    // Build payer for the payment
    const paymentPayer: any = {
      email: payerEmail,
    }
    if (payer?.identification?.number) {
      paymentPayer.identification = {
        type: payer.identification.type || 'CPF',
        number: String(payer.identification.number).replace(/\D/g, ''),
      }
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
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
