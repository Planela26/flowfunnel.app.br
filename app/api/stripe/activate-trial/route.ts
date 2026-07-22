import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prisma, prismaAdmin } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { sendTrialActivatedEmail } from '@/lib/email'
import { sendMetaCapiEvent, readFbCookies } from '@/lib/meta-capi'

const PLAN_VALUES: Record<string, number> = { START: 97, PRO: 147, SCALE: 297 }

function getPlanFromPriceId(priceId: string): string | null {
  const map: Record<string, string> = {}
  if (process.env.STRIPE_PRICE_START) map[process.env.STRIPE_PRICE_START] = 'START'
  if (process.env.STRIPE_PRICE_PRO) map[process.env.STRIPE_PRICE_PRO] = 'PRO'
  if (process.env.STRIPE_PRICE_SCALE) map[process.env.STRIPE_PRICE_SCALE] = 'SCALE'
  return map[priceId] ?? null
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(`stripe:activate-trial:${ip}`, 10, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { subscriptionId } = await request.json()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId obrigatório' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        stripeCustomerId: true,
        trialStatus: true,
        email: true,
        name: true,
      },
    })

    if (user?.trialStatus === 'active') {
      return NextResponse.json({ success: true, alreadyActive: true })
    }

    const stripe = await getUncachableStripeClient()

    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method'],
    }) as any

    // Security: subscription must belong to this user
    if (sub.customer !== user?.stripeCustomerId) {
      return NextResponse.json({ error: 'Assinatura não pertence a este usuário' }, { status: 403 })
    }

    // Anti-fraud: check card fingerprint
    let fingerprint: string | null = null
    const pm = sub.default_payment_method
    if (pm && typeof pm === 'object') {
      fingerprint = pm?.card?.fingerprint ?? null
    }

    if (!fingerprint) {
      // Try to get from pending setup intent
      try {
        const customer = await stripe.customers.retrieve(sub.customer) as any
        const pmId = customer.invoice_settings?.default_payment_method
        if (pmId && typeof pmId === 'string') {
          const pmDetails = await stripe.paymentMethods.retrieve(pmId) as any
          fingerprint = pmDetails?.card?.fingerprint ?? null
        }
      } catch {}
    }

    // ── HARD GATE: o teste grátis SÓ pode ser ativado depois que o usuário
    // cadastra um CARTÃO. Confirma com a Stripe que existe um método de pagamento
    // do tipo 'card' antes de marcar trialStatus='active'. Fail-closed: sem cartão
    // → sem trial (a regra de negócio é cartão primeiro, trial depois). Exigimos
    // explicitamente type==='card' — qualquer outro PM (ou ausência) é rejeitado.
    let hasRealCard = !!(pm && typeof pm === 'object' && pm.type === 'card')
    if (!hasRealCard) {
      try {
        const cardPms = await stripe.paymentMethods.list({
          customer: sub.customer,
          type: 'card',
          limit: 1,
        })
        hasRealCard = cardPms.data.length > 0
      } catch {}
    }

    if (!hasRealCard) {
      await logAudit({
        action: 'billing.trial_activation_blocked',
        result: 'failure',
        userId: session.user.id,
        entityType: 'Subscription',
        entityId: subscriptionId,
        request,
        metadata: { reason: 'no_payment_method' },
      })
      return NextResponse.json(
        { error: 'É necessário cadastrar um cartão antes de iniciar o teste grátis.' },
        { status: 400 }
      )
    }

    // Check fingerprint for abuse (same card used for multiple trials)
    if (fingerprint) {
      // Antifraude é cross-user (procura o MESMO cartão em OUTROS usuários) →
      // usa o cliente bypass; RLS self-only em User esconderia o fingerprint alheio.
      const existingWithFingerprint = await prismaAdmin.user.findFirst({
        where: {
          trialPaymentFingerprint: fingerprint,
          id: { not: session.user.id },
          trialStatus: { in: ['active', 'converted', 'expired'] },
        },
        select: { id: true },
      })

      if (existingWithFingerprint) {
        // Cancel the fraudulent subscription
        try {
          await stripe.subscriptions.cancel(subscriptionId)
        } catch {}

        await logAudit({
          action: 'billing.trial_fraud_detected',
          result: 'failure',
          userId: session.user.id,
          entityType: 'Subscription',
          entityId: subscriptionId,
          request,
          metadata: { reason: 'card_fingerprint_reuse', fingerprint },
        })

        return NextResponse.json(
          { error: 'Este cartão já foi usado para um período de teste. Por favor, use outro cartão.' },
          { status: 409 }
        )
      }
    }

    const trialEnd = sub.trial_end
    const trialEndsAt = trialEnd ? new Date(trialEnd * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const priceId = sub.items?.data?.[0]?.price?.id
    const planKey = priceId ? getPlanFromPriceId(priceId) : null

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        trialStatus: 'active',
        trialStartedAt: new Date(),
        trialEndsAt,
        trialPlan: planKey ?? 'START',
        paymentMethodAddedAt: new Date(),
        ...(fingerprint && { trialPaymentFingerprint: fingerprint }),
        stripeSubscriptionId: subscriptionId,
      },
    })

    // Send trial activated email
    if (user?.email) {
      sendTrialActivatedEmail(user.email, user.name || '', planKey ?? 'START', trialEndsAt).catch(() => {})
    }

    await logAudit({
      action: 'billing.trial_activated',
      result: 'success',
      userId: session.user.id,
      entityType: 'Subscription',
      entityId: subscriptionId,
      request,
      metadata: { plan: planKey, trialEndsAt: trialEndsAt.toISOString(), fingerprint },
    })

    // ── Meta CAPI: StartTrial — fired when the trial is ACTUALLY activated
    // (card added + trialStatus='active'), not at signup intent. The browser
    // Pixel uses the SAME event_id (returned below) so Meta dedups.
    const effectivePlan = planKey ?? 'START'
    const startTrialEventId = `trial_${session.user.id}`
    const { fbp, fbc } = readFbCookies(request.headers)
    await sendMetaCapiEvent({
      eventName: 'StartTrial',
      eventId: startTrialEventId,
      userData: {
        email: user?.email,
        externalId: session.user.id,
        clientIp: ip,
        userAgent: request.headers.get('user-agent') || undefined,
        fbp,
        fbc,
      },
      customData: { value: PLAN_VALUES[effectivePlan] ?? 0, currency: 'BRL', predicted_ltv: PLAN_VALUES[effectivePlan] ?? 0 },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      trialEndsAt: trialEndsAt.toISOString(),
      plan: planKey,
      meta: {
        startTrial: { eventId: startTrialEventId, value: PLAN_VALUES[effectivePlan] ?? 0, currency: 'BRL' },
      },
    })
  } catch (error: any) {
    console.error('Erro ao ativar trial:', error?.message)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
