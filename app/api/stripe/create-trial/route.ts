import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'

const PLAN_PRICES: Record<string, string> = {
  START: process.env.STRIPE_PRICE_START || '',
  PRO: process.env.STRIPE_PRICE_PRO || '',
  SCALE: process.env.STRIPE_PRICE_SCALE || '',
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(`stripe:create-trial:${ip}`, 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { plan } = await request.json()
    const planKey = String(plan || '').toUpperCase()
    const priceId = PLAN_PRICES[planKey]

    if (!priceId) {
      return NextResponse.json({ error: 'Plano inválido ou não configurado' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        name: true,
        emailVerified: true,
        stripeCustomerId: true,
        trialStatus: true,
        trialPlan: true,
      },
    })

    if (!user?.emailVerified) {
      return NextResponse.json({ error: 'Confirme seu email antes de ativar o teste.' }, { status: 403 })
    }

    if (user.trialStatus === 'active') {
      return NextResponse.json({ error: 'Você já tem um teste ativo.' }, { status: 400 })
    }

    if (user.trialStatus === 'converted') {
      return NextResponse.json({ error: 'Você já assinou um plano.' }, { status: 400 })
    }

    const stripe = await getUncachableStripeClient()

    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || '',
        metadata: { userId: session.user.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Check for existing trialing subscription for this plan to avoid duplicate trials
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 5,
    })

    const matchingSub = existingSubs.data.find(sub =>
      sub.items.data.some(item => item.price.id === priceId)
    )

    if (matchingSub) {
      // O list() não expande pending_setup_intent — recarrega a assinatura
      // com expand para conseguir o client_secret do formulário de cartão.
      const fullSub = await stripe.subscriptions.retrieve(matchingSub.id, {
        expand: ['pending_setup_intent'],
      }) as any
      const setupIntent = fullSub.pending_setup_intent
      if (setupIntent?.client_secret) {
        return NextResponse.json({
          subscriptionId: fullSub.id,
          clientSecret: setupIntent.client_secret,
          trialEndsAt: fullSub.trial_end ? new Date(fullSub.trial_end * 1000).toISOString() : null,
          planKey,
          isExisting: true,
        })
      }
      // Sem setup intent: só permite ativar se um cartão REAL já existir.
      // Caso contrário, não autorize a ativação (regra: cartão primeiro).
      const cardPms = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      })
      if (cardPms.data.length === 0) {
        return NextResponse.json(
          { error: 'Não foi possível iniciar o cadastro do cartão. Tente novamente.' },
          { status: 400 }
        )
      }
      return NextResponse.json({
        subscriptionId: fullSub.id,
        clientSecret: null,
        trialEndsAt: fullSub.trial_end ? new Date(fullSub.trial_end * 1000).toISOString() : null,
        planKey,
        alreadyHasPaymentMethod: true,
      })
    }

    // Create a new subscription with 7-day trial period
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 7,
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      // OBRIGA a Stripe a coletar um cartão durante o teste. Sem isso, o
      // padrão (missing_payment_method='create_invoice') trata o cartão como
      // OPCIONAL e a Stripe pode NÃO criar o pending_setup_intent — o que fazia
      // o trial ser ativado sem nenhum cartão cadastrado. Com 'cancel', a Stripe
      // exige o método de pagamento e sempre gera o setup intent (formulário).
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
      expand: ['pending_setup_intent'],
      metadata: {
        userId: session.user.id,
        plan: planKey,
        isTrial: 'true',
      },
    } as any)

    const sub = subscription as any
    const setupIntent = sub.pending_setup_intent
    const clientSecret = setupIntent?.client_secret ?? null

    if (!clientSecret) {
      // Sem setup intent: NÃO presuma que há cartão. Só autorize a ativação se
      // um cartão real já existir no cliente; caso contrário, retorne erro
      // (regra de negócio: cartão primeiro, trial depois).
      const cardPms = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      })
      if (cardPms.data.length === 0) {
        return NextResponse.json(
          { error: 'Não foi possível iniciar o cadastro do cartão. Tente novamente.' },
          { status: 400 }
        )
      }
      return NextResponse.json({
        subscriptionId: sub.id,
        clientSecret: null,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        planKey,
        alreadyHasPaymentMethod: true,
      })
    }

    // Store subscriptionId immediately so webhook can find it
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeSubscriptionId: sub.id },
    })

    await logAudit({
      action: 'billing.trial_subscription_created',
      result: 'success',
      userId: session.user.id,
      entityType: 'Subscription',
      entityId: sub.id,
      request,
      metadata: { plan: planKey, subscriptionId: sub.id },
    })

    return NextResponse.json({
      subscriptionId: sub.id,
      clientSecret,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      planKey,
    })
  } catch (error: any) {
    console.error('Erro ao criar trial subscription:', error?.message)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
