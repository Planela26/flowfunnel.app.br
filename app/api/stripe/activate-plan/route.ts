import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'

function getPlanFromPrice(priceId: string): string | null {
  const map: Record<string, string> = {}
  if (process.env.STRIPE_PRICE_START) map[process.env.STRIPE_PRICE_START] = 'START'
  if (process.env.STRIPE_PRICE_PRO) map[process.env.STRIPE_PRICE_PRO] = 'PRO'
  if (process.env.STRIPE_PRICE_SCALE) map[process.env.STRIPE_PRICE_SCALE] = 'SCALE'
  return map[priceId] ?? null
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`stripe:activate-plan:${session.user.id}`, 10, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { subscriptionId } = await request.json()
    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId obrigatório' }, { status: 400 })
    }

    const stripe = await getUncachableStripeClient()

    // Verify the subscription belongs to this user's customer
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    // Security check: subscription must belong to this user's customer
    if (subscription.customer !== user?.stripeCustomerId) {
      console.error('Subscription customer mismatch:', subscription.customer, '!=', user?.stripeCustomerId)
      return NextResponse.json({ error: 'Assinatura não pertence a este usuário' }, { status: 403 })
    }

    // O servidor é a autoridade sobre o estado da assinatura. Só 'active' e
    // 'trialing' liberam plano — e 'trialing' apenas com cartão confirmado.
    //
    // 'past_due' NÃO entra: era o caminho que desfazia o downgrade por
    // inadimplência (o usuário chamava esta rota e recuperava o plano sem pagar).
    const validStatuses = ['active', 'trialing']
    if (!validStatuses.includes(subscription.status)) {
      return NextResponse.json({
        error: `Status da assinatura inválido: ${subscription.status}`,
        status: subscription.status,
      }, { status: 400 })
    }

    // Assinatura em teste nasce 'trialing' SEM cartão (create-trial usa
    // trial_period_days). Sem esta trava, bastava criar um trial e chamar esta
    // rota para ganhar o plano pago sem nunca cadastrar cartão — e repetir a
    // cada ciclo. Mesma regra que o webhook já aplica em subscription.created.
    if (subscription.status === 'trialing') {
      const sub = subscription as any
      const pm = sub.default_payment_method
      let hasRealCard = !!(pm && typeof pm === 'object' && pm.type === 'card')
      if (!hasRealCard && typeof pm === 'string') {
        try {
          const retrieved = await stripe.paymentMethods.retrieve(pm)
          hasRealCard = retrieved?.type === 'card'
        } catch (e) {
          // `hasRealCard` fica false porque não deu para PERGUNTAR à Stripe,
          // que é diferente de o cliente não ter cartão — e as duas situações
          // levam a decisões distintas sobre ativar o plano.
          console.error('🚨 [stripe] não consegui consultar o meio de pagamento na Stripe:', e)
        }
      }
      if (!hasRealCard) {
        try {
          const cardPms = await stripe.paymentMethods.list({
            customer: subscription.customer as string,
            type: 'card',
            limit: 1,
          })
          hasRealCard = cardPms.data.length > 0
        } catch (e) {
          console.error('🚨 [stripe] não consegui listar os cartões do cliente na Stripe:', e)
        }
      }

      if (!hasRealCard) {
        await logAudit({
          action: 'billing.plan_activation_blocked',
          result: 'failure',
          userId: session.user.id,
          entityType: 'Subscription',
          entityId: subscriptionId,
          request,
          metadata: { reason: 'trialing_without_payment_method' },
        })
        return NextResponse.json(
          { error: 'É necessário cadastrar um cartão para ativar o plano.' },
          { status: 400 },
        )
      }
    }

    const priceId = subscription.items?.data?.[0]?.price?.id
    const plan = priceId ? getPlanFromPrice(priceId) : null

    if (!plan) {
      console.error(`Price ID não mapeado: ${priceId} — recusando ativação`)
      return NextResponse.json({ error: 'Plano não reconhecido. Contate o suporte.' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        plan,
        stripeSubscriptionId: subscriptionId,
      },
    })

    console.log(`✅ Plano ${plan} ativado para usuário ${session.user.id}`)

    await logAudit({
      action: 'billing.plan_activated',
      result: 'success',
      userId: session.user.id,
      entityType: 'Subscription',
      entityId: subscriptionId,
      request,
      metadata: { plan },
    })

    return NextResponse.json({ success: true, plan })
  } catch (error: any) {
    // Detalhe fica no log; o cliente recebe mensagem genérica (erros da Stripe
    // carregam customer id, price id e estado interno da conta).
    console.error('Erro ao ativar plano:', error?.message ?? error)
    return NextResponse.json({ error: 'Erro ao ativar plano. Tente novamente.' }, { status: 500 })
  }
}
