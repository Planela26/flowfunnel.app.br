import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'

const PLAN_PRICES: Record<string, string> = {
  START: process.env.STRIPE_PRICE_START || '',
  PRO:   process.env.STRIPE_PRICE_PRO   || '',
  SCALE: process.env.STRIPE_PRICE_SCALE || '',
}

const PLAN_NAMES: Record<string, string> = {
  START: 'START — Até 1.000 conversas/mês',
  PRO:   'PRO — Até 3.000 conversas/mês',
  SCALE: 'SCALE — Conversas ilimitadas',
}

// PI statuses that mean "fresh — no payment method attempted yet"
const FRESH_PI_STATUSES = ['requires_payment_method', 'requires_confirmation']

// PI statuses where Boleto blocks cancellation
const BOLETO_LOCKED_STATUSES = ['requires_action', 'processing']

async function inspectSubscriptionPI(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  sub: any
): Promise<{ piId: string | null; piStatus: string | null; clientSecret: string | null }> {
  const rawInvoice = sub.latest_invoice
  const invoiceId = typeof rawInvoice === 'string' ? rawInvoice : rawInvoice?.id
  if (!invoiceId) return { piId: null, piStatus: null, clientSecret: null }

  const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payment_intent'] })
  const rawPI = (invoice as any).payment_intent

  const piId = typeof rawPI === 'string' ? rawPI : rawPI?.id ?? null
  const piStatus = typeof rawPI === 'object' && rawPI !== null ? rawPI.status ?? null : null
  let clientSecret = typeof rawPI === 'object' && rawPI !== null ? rawPI.client_secret ?? null : null

  // Fall back to direct PI retrieve if clientSecret not in expand
  if (!clientSecret && piId) {
    const pi = await stripe.paymentIntents.retrieve(piId)
    clientSecret = pi.client_secret ?? null
  }

  return { piId, piStatus, clientSecret }
}

export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(`stripe:create-subscription:${request.headers.get('x-forwarded-for') || 'anon'}`, 10, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { plan, couponCode, affiliateId } = await request.json()
    const planKey = plan?.toUpperCase()
    const priceId = PLAN_PRICES[planKey]

    if (!priceId) {
      return NextResponse.json({ error: 'Plano inválido ou não configurado' }, { status: 400 })
    }

    const stripe = await getUncachableStripeClient()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    })

    let customerId = user?.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email || session.user.email || '',
        name: user?.name || session.user.name || '',
        metadata: { userId: session.user.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // ── Resolve Stripe coupon if coupon code provided ──
    let stripeCouponId: string | null = null
    let discountPercent: number | null = null
    let resolvedAffiliateId: string | null = affiliateId || null

    if (couponCode) {
      const aff = await prisma.affiliate.findUnique({
        where: { code: couponCode.toUpperCase().trim() },
        select: { id: true, stripeCouponId: true, discountPercent: true, isActive: true },
      })
      if (aff?.isActive && aff.stripeCouponId) {
        stripeCouponId = aff.stripeCouponId
        discountPercent = aff.discountPercent
        resolvedAffiliateId = aff.id
      }
    }

    // ── Check for existing incomplete subscriptions for this plan ──
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'incomplete',
      limit: 10,
    })

    const matchingSubs = existingSubs.data.filter(sub =>
      sub.items.data.some(item => item.price.id === priceId)
    )

    for (const existingSub of matchingSubs) {
      const { piId, piStatus, clientSecret } = await inspectSubscriptionPI(stripe, existingSub)
      console.log(`Existing sub ${existingSub.id} | PI: ${piId} | status: ${piStatus}`)

      // ── Case 1: PI is fresh — reuse only if coupon matches ──
      if (piStatus && FRESH_PI_STATUSES.includes(piStatus) && clientSecret) {
        const discountRaw = existingSub.discounts?.[0]
        const discountObj = typeof discountRaw === 'object' && discountRaw !== null ? discountRaw as any : null
        const existingCouponRaw = discountObj?.coupon
        const existingCouponId = typeof existingCouponRaw === 'string' ? existingCouponRaw : (existingCouponRaw as any)?.id ?? null

        // If coupon matches (or neither has a coupon), reuse this sub
        if (existingCouponId === stripeCouponId) {
          console.log('Reusing fresh sub (coupon matches):', existingSub.id)
          return NextResponse.json({
            subscriptionId: existingSub.id,
            clientSecret,
            planName: PLAN_NAMES[planKey] || planKey,
            discountPercent: discountPercent || 0,
            affiliateId: resolvedAffiliateId || null,
          })
        }

        // Coupon changed — cancel old sub and create a fresh one
        console.log(`Coupon mismatch (existing: ${existingCouponId}, wanted: ${stripeCouponId}) — cancelling sub`)
        try {
          await stripe.subscriptions.cancel(existingSub.id)
        } catch (err: any) {
          console.warn('Could not cancel mismatched sub:', existingSub.id, err.message)
        }
        continue
      }

      // ── Case 2: Boleto pending (requires_action / processing) ──
      // Cannot cancel — Stripe blocks it. Skip this sub and create a new one.
      // The boleto will expire automatically in 3 days.
      if (piStatus && BOLETO_LOCKED_STATUSES.includes(piStatus)) {
        console.log(`Sub ${existingSub.id} has boleto-locked PI (${piStatus}) — skipping, will create new`)
        continue
      }

      // ── Case 3: Any other stale state — try to cancel ──
      try {
        await stripe.subscriptions.cancel(existingSub.id)
        console.log('Cancelled stale sub:', existingSub.id)
      } catch (cancelErr: any) {
        console.warn('Could not cancel sub:', existingSub.id, cancelErr.message)
        // Continue to create a new one regardless
      }
    }

    // ── Create a new fresh subscription ──
    const subscriptionData: any = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: {
        userId: session.user.id,
        plan: planKey,
        ...(resolvedAffiliateId && { affiliateId: resolvedAffiliateId }),
      },
    }

    if (stripeCouponId) {
      subscriptionData.discounts = [{ coupon: stripeCouponId }]
    }

    const subscription = await stripe.subscriptions.create(subscriptionData)

    console.log('Sub created:', subscription.id, 'status:', subscription.status, stripeCouponId ? `| coupon: ${stripeCouponId}` : '')

    const { clientSecret, piId } = await inspectSubscriptionPI(stripe, subscription)

    console.log('PI ID:', piId, '| clientSecret:', clientSecret ? 'FOUND' : 'NULL')

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Não foi possível obter o clientSecret do Stripe. Tente novamente.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret,
      planName: PLAN_NAMES[planKey] || planKey,
      discountPercent: discountPercent || 0,
      affiliateId: resolvedAffiliateId || null,
    })
  } catch (error: any) {
    console.error('Erro ao criar subscription:', error?.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
