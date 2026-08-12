import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { getPayment } from '@/lib/mercadopago'
import { logAudit } from '@/lib/audit'
import { sendWelcomeEmail } from '@/lib/email'
import { claimMercadoPagoEvent, releaseMercadoPagoEvent } from '@/lib/mercadopago-dedup'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { createCommissionFromSale, reverseCommission } from '@/lib/affiliate-ledger'

/**
 * Verify Mercado Pago webhook signature.
 * Mercado Pago sends `x-signature` header: `ts=<timestamp>,v1=<signature>`
 * where signature = HMAC_SHA256(secret, `${timestamp}:${rawBody}`)
 *
 * NOTE: This function is intentionally async because Web Crypto is async-only.
 * We await it in the route handler before doing any plan mutations.
 */
async function verifyWebhookSignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error('🚫 MERCADOPAGO_WEBHOOK_SECRET not configured — webhook rejected (fail-closed)')
    return false
  }

  const signatureHeader = request.headers.get('x-signature') || request.headers.get('X-Signature')
  if (!signatureHeader) {
    console.warn('⚠️ Missing x-signature header — rejecting webhook')
    return false
  }

  // Parse "ts=<timestamp>,v1=<signature>"
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.trim().split('=')
    if (key && value) acc[key] = value
    return acc
  }, {} as Record<string, string>)

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) {
    console.warn('⚠️ Invalid x-signature format — rejecting webhook')
    return false
  }

  // Replay window: reject if timestamp > 5 min old
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(ts, 10)) > 300) {
    console.warn('⚠️ Webhook signature timestamp too old — rejecting')
    return false
  }

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${ts}:${rawBody}`))
    const expected = Buffer.from(sig).toString('hex')

    // Use timing-safe comparison to prevent timing attacks
    if (expected.length !== v1.length) return false
    let match = 0
    for (let i = 0; i < expected.length; i++) {
      match |= expected.charCodeAt(i) ^ v1.charCodeAt(i)
    }
    return match === 0
  } catch (err) {
    console.error('⚠️ Webhook signature verification error:', err)
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Verify signature (if MERCADOPAGO_WEBHOOK_SECRET is configured)
    const signatureValid = await verifyWebhookSignature(request, rawBody)
    if (!signatureValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const paymentId = body.data?.id || body.id
    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 })
    }

    // Get payment details from Mercado Pago (confirms the payment exists)
    const payment = await getPayment(Number(paymentId))
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    console.log(`📩 Mercado Pago webhook: ${payment.status} (payment ${payment.id})`)

    // Idempotency: skip duplicate events (DB-backed, survives restarts)
    const eventKey = `${payment.id}:${payment.status}`
    const claimed = await claimMercadoPagoEvent(eventKey)
    if (!claimed) {
      console.log(`⏭️ Duplicate event for payment ${payment.id} — skipping`)
      return NextResponse.json({ received: true, status: payment.status, dedup: true })
    }

    try {
      return await processPayment(request, payment)
    } catch (err) {
      // Release the claim so Mercado Pago retries can reprocess after a
      // transient failure (keeps billing at-least-once).
      await releaseMercadoPagoEvent(eventKey)
      throw err
    }
  } catch (error: any) {
    console.error('Erro no webhook Mercado Pago:', error)
    return NextResponse.json({ error: 'Erro ao processar o webhook.' }, { status: 500 })
  }
}

async function processPayment(request: Request, payment: any) {
  const externalRef = payment.external_reference
  if (!externalRef) {
    return NextResponse.json({ error: 'Missing external reference' }, { status: 400 })
  }

    const refParts = externalRef.split(':')
    const userRef = refParts[0]
    const planKey = refParts[1]
    const affiliateId = refParts[2] || null
    if (!userRef || !planKey) {
      return NextResponse.json({ error: 'Invalid external reference' }, { status: 400 })
    }

    // Resolve userRef: can be UUID (userId) or email (for anonymous checkout)
    let userId: string | null = null
    let userEmail: string | null = null
    if (userRef.includes('@')) {
      // It's an email
      userEmail = userRef
      const existingUser = await prisma.user.findUnique({
        where: { email: userRef },
        select: { id: true },
      })
      if (existingUser) {
        userId = existingUser.id
      } else {
        // Create a new user for this email
        const newUser = await prisma.user.create({
          data: {
            email: userRef,
            plan: 'FREE',
            role: 'USER',
          },
        })
        userId = newUser.id
        console.log(`👤 Novo usuário criado para ${userEmail}: ${userId}`)
      }
    } else {
      // It's a userId (UUID)
      userId = userRef
      const user = await prisma.user.findUnique({
        where: { id: userRef },
        select: { email: true },
      })
      if (user) userEmail = user.email
    }

    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user plan based on payment status
    if (payment.status === 'approved') {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { plan: planKey, subscriptionStatus: 'active', gracePeriodEndsAt: null },
      })

      // ── Fase 4: Comissão de afiliado — integração de Fase 3 (atribuição segura) com Fase 2 (engine)
      // Mercado Pago: cada payment.approved é INITIAL (sem renovação automática — Seção 4.0.3).
      // Determinação do afiliado: prioridade (1) User.referredByAffiliateId congelado
      // (2) affiliateId da external_reference (verificado aqui, resolvido no checkout via cookie)
      // (3) null.
      let affiliateIdForCommission: string | null = user.referredByAffiliateId ?? null
      if (!affiliateIdForCommission) {
        affiliateIdForCommission = affiliateId // Do external_reference, se houver
      }

      if (affiliateIdForCommission && payment.transaction_amount > 0) {
        try {
          const affiliate = await prisma.affiliate.findUnique({
            where: { id: affiliateIdForCommission },
            select: { userId: true, status: true },
          })

          // Bloqueia autoindicação (self-referral)
          if (affiliate && affiliate.status === 'ACTIVE' && affiliate.userId !== userId) {
            const result = await createCommissionFromSale({
              affiliateId: affiliateIdForCommission,
              userId,
              processor: 'MERCADOPAGO',
              externalPaymentId: String(payment.id),
              type: 'INITIAL', // MP não tem renovação automática (Seção 4.0.3)
              plan: planKey,
              originalAmount: payment.transaction_amount,
              discountedAmount: payment.transaction_amount,
            })

            if (result.created) {
              console.log(
                `✅ Comissão criada: afiliado ${affiliateIdForCommission}, MP payment ${payment.id}, ` +
                `R$${payment.transaction_amount} (INITIAL), pendente por 15 dias`,
              )
              await logAudit({
                action: 'affiliate.commission.created',
                result: 'success',
                userId,
                entityType: 'AffiliateSale',
                entityId: result.sale.id,
                request,
                metadata: {
                  affiliateId: affiliateIdForCommission,
                  paymentId: payment.id,
                  amount: payment.transaction_amount,
                  saleType: 'INITIAL',
                  commissionAmount: Number(result.sale.commission?.amount ?? 0),
                },
              })
            }
          } else if (affiliate?.userId === userId) {
            console.log(
              `⚠️ Self-referral bloqueado: usuário ${userId} tentou se autoreferencia via ` +
              `afiliado ${affiliateIdForCommission}`,
            )
            await logAudit({
              action: 'affiliate.commission.blocked',
              result: 'success',
              userId,
              entityType: 'Payment',
              entityId: String(payment.id),
              request,
              metadata: { reason: 'self_referral', affiliateId: affiliateIdForCommission, paymentId: payment.id },
            })
          } else if (affiliate?.status !== 'ACTIVE') {
            console.log(`⏭️ Afiliado inativo: ${affiliateIdForCommission}, sem comissão`)
          }
        } catch (err) {
          console.error('[mercadopago/webhook] erro ao criar comissão:', err)
          // Não falhar o webhook por comissão — billing tem prioridade
        }
      }

      await logAudit({
        action: 'billing.plan_change',
        result: 'success',
        userId: user.id,
        entityType: 'User',
        entityId: user.id,
        request,
        metadata: {
          plan: planKey,
          paymentMethod: 'mercadopago',
          paymentId: payment.id,
          amount: payment.transaction_amount,
          affiliateId: affiliateIdForCommission ?? undefined,
        },
      })

      // Send welcome email if new user
      if (user.emailVerified && user.plan === planKey) {
        await sendWelcomeEmail(user.email!, user.name || 'Usuário').catch(() => {})
      }

      // ── Meta Purchase (CAPI) — fired ONLY on approved payment. Same event_id
      // persisted for the browser Pixel to dedup against.
      try {
        const value = Number(payment.transaction_amount) || 0
        if (value > 0) {
          const eventId = `purchase_mp_${payment.id}`
          const currency = (payment.currency_id || 'BRL').toUpperCase()
          await sendMetaCapiEvent({
            eventName: 'Purchase',
            eventId,
            userData: { email: user.email, externalId: user.id },
            customData: { value, currency, content_name: planKey },
          })
          await prisma.user.update({
            where: { id: user.id },
            data: { metaPurchase: JSON.stringify({ eventId, value, currency, plan: planKey }) },
          }).catch(() => {})
        }
      } catch (e) {
        console.error('[mercadopago/webhook] erro ao enviar Purchase Meta:', e)
      }

      console.log(`✅ Plano ${planKey} ativado para usuário ${userId} via Mercado Pago`)
    } else if (payment.status === 'cancelled' || payment.status === 'refunded') {
      // Downgrade to FREE on cancellation/refund — but ONLY when the user's
      // current plan matches the plan this payment paid for. Otherwise a refund
      // of an old/superseded purchase would wipe out a plan the user later
      // acquired through a different payment.
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      })
      if (current?.plan === planKey) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: 'FREE', subscriptionStatus: 'cancelled', gracePeriodEndsAt: null },
        })

        // Fase 4 — Reversão de comissão em refund/cancel
        try {
          const sale = await prisma.affiliateSale.findFirst({
            where: { externalPaymentId: String(payment.id), processor: 'MERCADOPAGO' },
            select: { commission: { select: { id: true } } },
          })
          if (sale?.commission) {
            const idempotencyKey = `reverse:MERCADOPAGO:${payment.id}`
            await reverseCommission(sale.commission.id, `${payment.status} of payment ${payment.id}`, idempotencyKey).catch(
              (err) => console.error(`[mercadopago/webhook] failed to reverse commission: ${err.message}`),
            )
            await logAudit({
              action: 'affiliate.commission.reversed',
              result: 'success',
              userId,
              entityType: 'Payment',
              entityId: String(payment.id),
              request,
              metadata: { reason: payment.status, paymentId: payment.id },
            })
          }
        } catch (err) {
          console.error('[mercadopago/webhook] error checking/reversing commission on refund:', err)
        }

        await logAudit({
          action: 'billing.plan_change',
          result: 'success',
          userId,
          entityType: 'User',
          entityId: userId,
          request,
          metadata: {
            plan: 'FREE',
            reason: payment.status,
            paymentMethod: 'mercadopago',
            paymentId: payment.id,
          },
        })

        console.log(`⚠️ Plano ${planKey} cancelado/reembolsado para usuário ${userId}, downgrade para FREE`)
      } else {
        console.log(`⏭️ Refund/cancel de ${planKey} ignorado: plano atual do usuário ${userId} é ${current?.plan}`)
      }
    } else if (payment.status === 'charged_back') {
      // Fase 4 — Chargeback do Mercado Pago (achado da auditoria anterior, Seção 4.4).
      // Mesmo tratamento que refund: downgrade e reversão de comissão.
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      })
      if (current?.plan === planKey) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: 'FREE', subscriptionStatus: 'disputed', gracePeriodEndsAt: null },
        })

        // Reversão de comissão em chargeback
        try {
          const sale = await prisma.affiliateSale.findFirst({
            where: { externalPaymentId: String(payment.id), processor: 'MERCADOPAGO' },
            select: { commission: { select: { id: true } } },
          })
          if (sale?.commission) {
            const idempotencyKey = `reverse:MERCADOPAGO:chargeback:${payment.id}`
            await reverseCommission(sale.commission.id, `Chargeback of payment ${payment.id}`, idempotencyKey).catch(
              (err) => console.error(`[mercadopago/webhook] failed to reverse commission: ${err.message}`),
            )
            await logAudit({
              action: 'affiliate.commission.reversed',
              result: 'success',
              userId,
              entityType: 'Payment',
              entityId: String(payment.id),
              request,
              metadata: { reason: 'charged_back', paymentId: payment.id },
            })
          }
        } catch (err) {
          console.error('[mercadopago/webhook] error checking/reversing commission on chargeback:', err)
        }

        await logAudit({
          action: 'billing.chargeback',
          result: 'success',
          userId,
          entityType: 'Payment',
          entityId: String(payment.id),
          request,
          metadata: {
            plan: 'FREE',
            reason: 'charged_back',
            paymentMethod: 'mercadopago',
            paymentId: payment.id,
            amount: payment.transaction_amount,
          },
        })

        console.log(`⚠️ Chargeback para usuário ${userId} (payment ${payment.id}), plano downgrade para FREE`)
      } else {
        console.log(`⏭️ Chargeback de ${planKey} ignorado: plano atual do usuário ${userId} é ${current?.plan}`)
      }
    }

    return NextResponse.json({ received: true, status: payment.status })
}
