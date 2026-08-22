import { NextResponse } from 'next/server'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { sendSaleNotificationEmail, sendWelcomeEmail, sendTrialWillEndEmail, sendTrialConvertedEmail } from '@/lib/email'
import { claimStripeEvent, releaseStripeEvent } from '@/lib/stripe-dedup'
import { logAudit } from '@/lib/audit'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { createCommissionFromSale, reverseCommission, reverseCommissionPartially } from '@/lib/affiliate-ledger'

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
      // Detalhe só no log — o endpoint é público e o motivo exato da falha de
      // assinatura ajuda quem estiver sondando.
      console.error('Falha na validação do webhook Stripe:', err.message)
      return NextResponse.json({ error: 'Webhook validation failed' }, { status: 400 })
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
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }
}

async function syncUserPlan(event: any, stripe: any, request: Request) {
  // Reembolso: audita sempre; rebaixa apenas quando o valor foi devolvido por
  // inteiro. Reembolso parcial (ajuste, cortesia) não deve tirar o acesso.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as any
    const cid = charge.customer
    const u = cid
      ? await prisma.user.findFirst({ where: { stripeCustomerId: cid }, select: { id: true } })
      : null

    const chargeAmount = charge.amount || 0 // centavos
    const refundedAmount = charge.amount_refunded || 0 // centavos
    const fullyRefunded = Boolean(charge.refunded) || refundedAmount >= chargeAmount

    if (fullyRefunded && cid) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: cid },
        data: { plan: 'FREE', subscriptionStatus: 'refunded', gracePeriodEndsAt: null },
      })
    }

    // Fase 4 — Reversão proporcional de comissão em reembolso (Decisão B).
    // Reembolso total → reverter 100% da comissão.
    // Reembolso parcial → reverter proporcionalmente.
    if (refundedAmount > 0 && charge.id) {
      try {
        const sale = await prisma.affiliateSale.findFirst({
          where: { externalPaymentId: charge.id, processor: 'STRIPE' },
          select: { commission: { select: { id: true } }, originalAmount: true },
        })
        if (sale?.commission && Number(sale.originalAmount) > 0) {
          if (fullyRefunded) {
            // Reembolso total: reverter 100%
            const idempotencyKey = `reverse:STRIPE:${charge.id}`
            await reverseCommission(sale.commission.id, `Full refund of charge ${charge.id}`, idempotencyKey).catch(
              (err) => console.error(`[stripe/webhook] failed to reverse commission (full): ${err.message}`),
            )
          } else {
            // Reembolso parcial: reverter proporcionalmente (Decisão B)
            const originalAmount = Math.round(Number(sale.originalAmount) * 100) // converte para centavos se necessário
            await reverseCommissionPartially({
              commissionId: sale.commission.id,
              originalChargeAmount: chargeAmount,
              refundedAmount,
              refundId: charge.id,
              reason: `Partial refund of charge`,
            }).catch((err) => console.error(`[stripe/webhook] failed to reverse commission (partial): ${err.message}`))
          }
        }
      } catch (err) {
        console.error('[stripe/webhook] error checking/reversing commission on refund:', err)
      }
    }

    await logAudit({
      action: 'billing.refund',
      result: 'success',
      userId: u?.id ?? null,
      entityType: 'Charge',
      entityId: charge.id,
      request,
      metadata: {
        amount: refundedAmount / 100,
        customerId: cid,
        fullyRefunded,
        planDowngraded: fullyRefunded,
      },
    })
    return
  }

  // Chargeback: o dinheiro foi retirado da conta. O acesso pago cai na hora.
  // Antes, estes eventos nem estavam na lista de relevantes — o cliente pagava,
  // abria disputa e mantinha o plano.
  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object as any
    // `dispute.charge` normalmente vem como ID (string), não expandido —
    // é preciso buscar a cobrança para chegar ao customer.
    let cid: string | null = dispute.customer ?? null
    let chargeId: string | null = typeof dispute.charge === 'string' ? dispute.charge : null
    if (!cid && typeof dispute.charge === 'string') {
      try {
        const charge = await stripe.charges.retrieve(dispute.charge)
        cid = (charge?.customer as string) ?? null
      } catch (err) {
        console.error('[stripe/webhook] falha ao resolver charge da disputa:', err)
      }
    } else if (!cid && dispute.charge?.customer) {
      cid = dispute.charge.customer
    }
    const u = cid
      ? await prisma.user.findFirst({ where: { stripeCustomerId: cid }, select: { id: true } })
      : null

    if (cid) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: cid },
        data: { plan: 'FREE', subscriptionStatus: 'disputed', gracePeriodEndsAt: null },
      })
    }

    // Fase 4 — Reversão de comissão em chargeback. Mesma lógica de refund,
    // mas disputa pode resultar em clawback tardio (já madura).
    if (chargeId) {
      try {
        const sale = await prisma.affiliateSale.findFirst({
          where: { externalPaymentId: chargeId, processor: 'STRIPE' },
          select: { commission: { select: { id: true } } },
        })
        if (sale?.commission) {
          const idempotencyKey = `reverse:STRIPE:chargeback:${dispute.id}`
          await reverseCommission(sale.commission.id, `Chargeback dispute ${dispute.id}`, idempotencyKey).catch(
            (err) => console.error(`[stripe/webhook] failed to reverse commission: ${err.message}`),
          )
          await logAudit({
            action: 'affiliate.commission.reversed',
            result: 'success',
            userId: u?.id ?? null,
            entityType: 'Dispute',
            entityId: dispute.id,
            request,
            metadata: { reason: 'chargeback', disputeId: dispute.id, chargeId },
          })
        }
      } catch (err) {
        console.error('[stripe/webhook] error checking/reversing commission on chargeback:', err)
      }
    }

    await logAudit({
      action: 'billing.chargeback',
      result: 'success',
      userId: u?.id ?? null,
      entityType: 'Dispute',
      entityId: dispute.id,
      request,
      metadata: { amount: (dispute.amount || 0) / 100, reason: dispute.reason, customerId: cid },
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
      } catch (e) {
        // Consequência de cair aqui: `newPlan` fica nulo, o bloco da linha 395
        // é PULADO e o cliente que acabou de pagar não recebe plano nenhum.
        // A rota ainda responde 200, então a Stripe não reenvia.
        console.error(
          `🚨 [stripe] não consegui descobrir o plano da sessão ${session.id} pelos line_items. ` +
          `O cliente pagou e o plano NÃO será atualizado:`, e,
        )
      }
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
            sendTrialConvertedEmail(user.email, user.name || '', newPlan ?? user.trialPlan).catch((e) =>
              console.error('[stripe] e-mail de conversão de teste não enviado:', e),
            )
          }
        } catch (e) {
          // Só e-mail: o plano já foi gravado acima. Não é dinheiro perdido,
          // mas some sem rastro e o cliente fica sem a confirmação.
          console.error('[stripe] falha ao preparar o e-mail de conversão de teste:', e)
        }
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
    } catch (e) {
      // Mesma consequência do catch anterior: sem `newPlan`, a renovação é
      // cobrada e o plano do usuário não é reafirmado.
      console.error(
        `🚨 [stripe] não consegui descobrir o plano da fatura do customer ${customerId}. ` +
        `A cobrança ocorreu e o plano NÃO será atualizado:`, e,
      )
    }
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
          // Rebaixar para FREE sem tocar em subscriptionStatus deixava o status
          // stale em 'active': isSubscriptionBlocked continuava false (ingestão
          // seguia rodando) e hasPaidAccess continuava true. Só o
          // subscription.deleted marcava cancelamento; o mesmo cancelamento
          // chegando por subscription.updated passava batido.
          : { subscriptionStatus: 'cancelled', gracePeriodEndsAt: null }),
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
        select: { id: true, email: true, name: true, referredByAffiliateId: true },
      })

      // ── Fase 4: Comissão de afiliado — integração de Fase 3 (atribuição segura) com Fase 2 (engine)
      // Determinação do afiliado: prioridade (1) User.referredByAffiliateId congelado (renovação/segunda compra)
      // (2) affiliateId no metadata da subscription (primeira conversão, resolvido no checkout via cookie)
      // (3) null (checkout orgânico).
      let affiliateIdForCommission: string | null = user?.referredByAffiliateId ?? null
      let saleType: 'INITIAL' | 'RENEWAL' = 'INITIAL'

      if (!affiliateIdForCommission && invoice.subscription) {
        try {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          affiliateIdForCommission = sub.metadata?.affiliateId ?? null
          // Detecção de renovação: se a subscription tem múltiplas invoices pagas, esta não é a primeira.
          // Simplificado: invoices.data[0] é a mais recente; se temos mais de uma, é renovação.
          if (sub.metadata?.affiliateId && invoice.id !== sub.latest_invoice) {
            saleType = 'RENEWAL'
          }
        } catch (err) {
          console.error('[stripe/webhook] erro ao buscar subscription:', err)
        }
      }

      // Criar comissão apenas se houver afiliado válido e não for autoindicação
      if (affiliateIdForCommission && user?.id && amount > 0) {
        try {
          const affiliate = await prisma.affiliate.findUnique({
            where: { id: affiliateIdForCommission },
            select: { userId: true, status: true },
          })

          // Bloqueia autoindicação (self-referral): afiliado não pode lucrar vendendo para si mesmo
          if (affiliate && affiliate.status === 'ACTIVE' && affiliate.userId !== user.id) {
            const originalAmount = (invoice.total || 0) / 100
            const result = await createCommissionFromSale({
              affiliateId: affiliateIdForCommission,
              userId: user.id,
              processor: 'STRIPE',
              externalPaymentId: invoice.id,
              externalSubscriptionId: invoice.subscription ?? undefined,
              type: saleType,
              plan,
              originalAmount,
              discountedAmount: amount,
            })

            if (result.created) {
              console.log(
                `✅ Comissão criada: afiliado ${affiliateIdForCommission}, venda ${invoice.id}, ` +
                `R$${amount} (${saleType}), pendente por 15 dias`,
              )
              await logAudit({
                action: 'affiliate.commission.created',
                result: 'success',
                userId: user.id,
                entityType: 'AffiliateSale',
                entityId: result.sale.id,
                request,
                metadata: {
                  affiliateId: affiliateIdForCommission,
                  invoiceId: invoice.id,
                  amount,
                  saleType,
                  commissionAmount: Number(result.sale.commission?.amount ?? 0),
                },
              })
            }
          } else if (affiliate?.userId === user.id) {
            // Self-referral bloqueado
            console.log(
              `⚠️ Self-referral bloqueado: usuário ${user.id} tentou se autoreferencia via ` +
              `afiliado ${affiliateIdForCommission}`,
            )
            await logAudit({
              action: 'affiliate.commission.blocked',
              result: 'success',
              userId: user.id,
              entityType: 'Invoice',
              entityId: invoice.id,
              request,
              metadata: { reason: 'self_referral', affiliateId: affiliateIdForCommission, invoiceId: invoice.id },
            })
          } else if (affiliate?.status !== 'ACTIVE') {
            console.log(`⏭️ Afiliado inativo: ${affiliateIdForCommission}, sem comissão`)
          }
        } catch (err) {
          console.error('[stripe/webhook] erro ao criar comissão:', err)
          // Não falhar o webhook por causa de erro de comissão — billing tem prioridade.
          // Comissão pode ser criada manualmente depois se necessário.
        }
      }

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
        metadata: { amount, plan, customerId, affiliateId: affiliateIdForCommission ?? undefined },
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
        sendWelcomeEmail(user.email, user.name || '').catch((e) =>
          console.error('[stripe] e-mail de boas-vindas não enviado:', e),
        )
      }
    } catch (e) {
      console.error('[stripe] falha ao preparar o e-mail de boas-vindas:', e)
    }
  }
}

function getPlanFromPriceId(priceId: string): string | null {
  const map: Record<string, string> = {}
  if (process.env.STRIPE_PRICE_START) map[process.env.STRIPE_PRICE_START] = 'START'
  if (process.env.STRIPE_PRICE_PRO) map[process.env.STRIPE_PRICE_PRO] = 'PRO'
  if (process.env.STRIPE_PRICE_SCALE) map[process.env.STRIPE_PRICE_SCALE] = 'SCALE'
  return map[priceId] ?? null
}
