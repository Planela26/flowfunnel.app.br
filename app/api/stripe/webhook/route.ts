import { NextResponse } from 'next/server'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { sendSaleNotificationEmail, sendWelcomeEmail, sendTrialWillEndEmail, sendTrialConvertedEmail } from '@/lib/email'
import { claimStripeEvent, releaseStripeEvent } from '@/lib/stripe-dedup'
import { logAudit } from '@/lib/audit'
import { sendMetaCapiEvent } from '@/lib/meta-capi'

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET não configurado')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const stripe = await getUncachableStripeClient()

    let event: any
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err: any) {
      console.error('Falha na validação do webhook Stripe:', err.message)
      return NextResponse.json({ error: `Webhook validation failed: ${err.message}` }, { status: 400 })
    }

    // Persistent deduplication — survives restarts and races between concurrent
    // webhook deliveries from Stripe (the in-memory Set was lost on every reload).
    const claimed = await claimStripeEvent(event.id, event.type)
    if (!claimed) {
      console.log(`⏭️ Evento Stripe duplicado ignorado: ${event.id} (${event.type})`)
      return NextResponse.json({ received: true, deduplicated: true })
    }

    console.log(`📩 Stripe webhook recebido: ${event.type} (${event.id})`)

    try {
      await syncUserPlan(event, stripe, request)
    } catch (procErr: any) {
      // Processing failed after we claimed the event — release the claim so
      // Stripe's retry can reprocess it (at-least-once for billing).
      await releaseStripeEvent(event.id)
      console.error(`Falha ao processar evento Stripe ${event.id}; claim liberado para retry`, procErr?.message || procErr)
      return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Erro no webhook Stripe:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

async function syncUserPlan(event: any, stripe: any, request: Request) {
  // Auditoria de reembolso (não altera plano — apenas registra o evento).
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as any
    const cid = charge.customer
    const u = cid
      ? await prisma.user.findFirst({ where: { stripeCustomerId: cid }, select: { id: true } })
      : null
    await logAudit({
      action: 'billing.refund',
      result: 'success',
      userId: u?.id ?? null,
      entityType: 'Charge',
      entityId: charge.id,
      request,
      metadata: { amount: (charge.amount_refunded || 0) / 100, customerId: cid },
    })
    return
  }

  const relevantEvents = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.trial_will_end',
    'invoice.paid',
    'invoice.payment_failed',
  ]

  if (!relevantEvents.includes(event.type)) return

  // ── Trial ending soon notification ─────────────────────────────────────────
  if (event.type === 'customer.subscription.trial_will_end') {
    const sub = event.data.object as any
    const cid = sub.customer
    try {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: cid },
        select: { id: true, email: true, name: true, trialPlan: true, trialEndsAt: true },
      })
      if (user?.email && user.trialPlan) {
        const endsAt = user.trialEndsAt ?? (sub.trial_end ? new Date(sub.trial_end * 1000) : new Date())
        const diffMs = endsAt.getTime() - Date.now()
        const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
        sendTrialWillEndEmail(user.email, user.name || '', user.trialPlan, endsAt, daysLeft).catch(() => {})
        await logAudit({
          action: 'billing.trial_will_end_notified',
          result: 'success',
          userId: user.id,
          entityType: 'Subscription',
          entityId: sub.id,
          request,
          metadata: { daysLeft, trialPlan: user.trialPlan },
        })
      }
    } catch (err) {
      console.error('Erro ao processar trial_will_end:', err)
    }
    return
  }

  let customerId: string | null = null
  let newPlan: string | null = null

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    customerId = session.customer

    if (session.metadata?.plan) {
      newPlan = session.metadata.plan.toUpperCase()
    } else {
      try {
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        })
        const priceId = fullSession.line_items?.data?.[0]?.price?.id
        if (priceId) newPlan = getPlanFromPriceId(priceId)
      } catch {}
    }

    if (session.subscription && customerId) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { stripeSubscriptionId: String(session.subscription) },
      })
    }
  }

  if (event.type === 'customer.subscription.created') {
    const sub = event.data.object
    customerId = sub.customer

    // Não conceda plano pago em assinaturas que ainda não foram pagas/confirmadas.
    // 'incomplete' = aguardando pagamento; 'trialing' = teste grátis que SÓ deve
    // liberar o plano após o cartão ser cadastrado (feito por activate-trial, que
    // marca trialStatus='active'). O plano real só é definido na conversão
    // (trialing→active via subscription.updated) ou em invoice.paid.
    if (sub.status === 'incomplete' || sub.status === 'incomplete_expired' || sub.status === 'trialing') {
      console.log(`⏭️ subscription.created ignorado — status ${sub.status} (sem upgrade de plano)`)
      if (sub.id) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { stripeSubscriptionId: sub.id },
        })
      }
      return
    }

    const priceId = sub.items?.data?.[0]?.price?.id
    if (priceId) newPlan = getPlanFromPriceId(priceId)
    if (sub.id) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { stripeSubscriptionId: sub.id },
      })
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as any
    const prevAttrs = (event.data as any).previous_attributes as any
    customerId = sub.customer

    if (sub.id) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { stripeSubscriptionId: sub.id },
      })
    }

    if (sub.status === 'canceled' || sub.status === 'unpaid') {
      newPlan = 'FREE'
    } else if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
      console.log(`⏭️ subscription.updated ignorado — status ${sub.status}`)
      return
    } else {
      const priceId = sub.items?.data?.[0]?.price?.id
      if (priceId) newPlan = getPlanFromPriceId(priceId)

      // Trial just converted to paid subscription
      if (prevAttrs?.status === 'trialing' && sub.status === 'active') {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { trialStatus: 'converted' },
        })
        try {
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId },
            select: { email: true, name: true, trialPlan: true },
          })
          if (user?.email && user.trialPlan) {
            sendTrialConvertedEmail(user.email, user.name || '', newPlan ?? user.trialPlan).catch(() => {})
          }
        } catch {}
      }
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object
    customerId = invoice.customer
    try {
      const subscriptionId = invoice.subscription
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId) as any
        const priceId = sub.items?.data?.[0]?.price?.id
        if (priceId) newPlan = getPlanFromPriceId(priceId)
      }
    } catch {}
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as any
    customerId = invoice.customer

    // Set subscriptionStatus to 'past_due' and start grace period on first failure.
    // Grace period is only set once (preserves original deadline across retries).
    const failedUser = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { gracePeriodEndsAt: true },
    })
    const graceEnd = failedUser?.gracePeriodEndsAt
      ? failedUser.gracePeriodEndsAt
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionStatus: 'past_due', gracePeriodEndsAt: graceEnd },
    })

    if (invoice.next_payment_attempt) {
      console.log(`⚠️ Pagamento falhou — grace period até ${graceEnd.toISOString()}, Stripe tenta novamente em ${new Date(invoice.next_payment_attempt * 1000).toISOString()}`)
    } else {
      console.log(`❌ Pagamento falhou — última tentativa esgotada, downgrade para FREE`)
      newPlan = 'FREE'
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    customerId = sub.customer
    newPlan = 'FREE'
    // Mark as cancelled immediately (overrides the earlier assignment above if both fire)
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionStatus: 'cancelled', gracePeriodEndsAt: null },
    })
  }

  if (customerId && newPlan) {
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        plan: newPlan,
        ...(newPlan !== 'FREE'
          ? { subscriptionStatus: 'active', gracePeriodEndsAt: null }
          : {}),
      },
    })
    console.log(`✅ Plano atualizado para ${newPlan} (customer: ${customerId})`)

    const planUser = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    })
    await logAudit({
      action: 'billing.plan_change',
      result: 'success',
      userId: planUser?.id ?? null,
      entityType: 'Subscription',
      entityId: customerId,
      request,
      metadata: { plan: newPlan, eventType: event.type },
    })
  }

  if (event.type === 'invoice.paid' && customerId) {
    const invoice = event.data.object as any
    const amount = (invoice.amount_paid || 0) / 100
    const plan = newPlan || 'START'

    try {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true, email: true, name: true },
      })
      if (user?.email) {
        sendSaleNotificationEmail(user.email, user.name || '', plan, amount).catch(() => {})
      }
      await logAudit({
        action: 'billing.payment',
        result: 'success',
        userId: user?.id ?? null,
        entityType: 'Invoice',
        entityId: invoice.id ?? null,
        request,
        metadata: { amount, plan, customerId },
      })

      // ── Meta Purchase (CAPI) — fired ONLY here, after real payment confirmation.
      // Same event_id is persisted for the browser Pixel to dedup against.
      if (amount > 0 && invoice.id) {
        const eventId = `purchase_${invoice.id}`
        const currency = (invoice.currency || 'brl').toUpperCase()
        await sendMetaCapiEvent({
          eventName: 'Purchase',
          eventId,
          userData: { email: user?.email, externalId: user?.id },
          customData: { value: amount, currency, content_name: plan },
        })
        if (user?.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { metaPurchase: JSON.stringify({ eventId, value: amount, currency, plan }) },
          }).catch(() => {})
        }
      }
    } catch (e) {
      console.error('[stripe/webhook] erro ao enviar Purchase Meta:', e)
    }
  }

  if (event.type === 'customer.subscription.created' && customerId) {
    try {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
        select: { email: true, name: true },
      })
      if (user?.email) {
        sendWelcomeEmail(user.email, user.name || '').catch(() => {})
      }
    } catch {}
  }
}

function getPlanFromPriceId(priceId: string): string | null {
  const map: Record<string, string> = {}
  if (process.env.STRIPE_PRICE_START) map[process.env.STRIPE_PRICE_START] = 'START'
  if (process.env.STRIPE_PRICE_PRO) map[process.env.STRIPE_PRICE_PRO] = 'PRO'
  if (process.env.STRIPE_PRICE_SCALE) map[process.env.STRIPE_PRICE_SCALE] = 'SCALE'
  return map[priceId] ?? null
}
