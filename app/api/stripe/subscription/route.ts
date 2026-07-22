import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true, email: true, trialStatus: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
      return NextResponse.json({
        plan: user.plan,
        status: 'free',
        subscription: null,
        hasStripe: false,
      })
    }

    const stripe = await getUncachableStripeClient()

    let subscription: any
    try {
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    } catch (stripeErr: any) {
      if (stripeErr?.statusCode === 404 || stripeErr?.code === 'resource_missing') {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { stripeSubscriptionId: null, plan: 'FREE' },
        })
        return NextResponse.json({
          plan: 'FREE',
          status: 'free',
          subscription: null,
          hasStripe: true,
        })
      }
      throw stripeErr
    }

    // Regra de negócio: uma assinatura em 'trialing' SÓ conta como teste grátis
    // depois que o cartão foi cadastrado (activate-trial marca trialStatus='active').
    // Se a Stripe ainda mostra 'trialing' mas o trial não foi ativado no nosso
    // banco, o usuário NÃO completou o cadastro do cartão — não exiba "Em trial".
    if (subscription.status === 'trialing' && user.trialStatus !== 'active') {
      return NextResponse.json({
        plan: user.plan,
        status: 'free',
        subscription: null,
        hasStripe: true,
      })
    }

    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toLocaleDateString('pt-BR')
      : null

    const priceId = subscription.items?.data?.[0]?.price?.id
    const amount = subscription.items?.data?.[0]?.price?.unit_amount

    return NextResponse.json({
      plan: user.plan,
      status: subscription.status,
      hasStripe: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: periodEnd,
        priceId,
        amountBrl: amount ? (amount / 100).toFixed(2) : null,
      },
    })
  } catch (error: any) {
    console.error('Erro ao buscar assinatura:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
