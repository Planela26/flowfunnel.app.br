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

    // Only activate for valid statuses (active or trialing)
    const validStatuses = ['active', 'trialing', 'past_due']
    if (!validStatuses.includes(subscription.status)) {
      return NextResponse.json({
        error: `Status da assinatura inválido: ${subscription.status}`,
        status: subscription.status,
      }, { status: 400 })
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
    console.error('Erro ao ativar plano:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
