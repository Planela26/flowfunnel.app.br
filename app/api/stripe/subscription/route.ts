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
      select: {
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        email: true,
        trialStatus: true,
        subscriptionStatus: true,
        paymentMethodAddedAt: true,
        gracePeriodEndsAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
      // Mas mesmo sem Stripe, o usuário pode ter pago via PIX MercadoPago —
      // nesse caso subscriptionStatus='active' e o panel deve refletir isso.
      if (user.subscriptionStatus === 'active') {
        return NextResponse.json({
          plan: user.plan,
          status: 'active',
          hasStripe: false,
          subscription: {
            id: 'mercadopago',
            status: 'active',
            cancelAtPeriodEnd: false,
            currentPeriodEnd:
              user.gracePeriodEndsAt
                ? new Date(user.gracePeriodEndsAt).toLocaleDateString('pt-BR')
                : null,
            priceId: null,
            amountBrl: null,
          },
        })
      }
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

    // Regra de negócio:
// 1) PIX / MercadoPago pagamento confirmado → User.subscriptionStatus='active'.
//    Não importa o que a Stripe diz (sub 'trialing' órfão, etc.) — manter
//    status 'active' e ignorar a janela de trial remanescente.
// 2) Stripe em 'trialing' SÓ conta como trial válido se o cartão foi cadastrado
//    (activate-trial marca trialStatus='active'). Sem isso, "Em trial" não pode
//    aparecer — exibe como 'free' para evitar prometer período grátis sem
//    cartão de fato registrado.

// Calcula os campos derivados ANTES das ramificações (eram declarados tarde demais).
const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toLocaleDateString('pt-BR')
      : null
const priceId = subscription.items?.data?.[0]?.price?.id
const amount = subscription.items?.data?.[0]?.price?.unit_amount
const buildSub = (status: string) => ({
      id: subscription.id,
      status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: periodEnd,
      priceId,
      // Vírgula: o valor é exibido direto em SubscriptionCard, em pt-BR.
      amountBrl: amount ? (amount / 100).toFixed(2).replace('.', ',') : null,
    })

    if (user.subscriptionStatus === 'active') {
      return NextResponse.json({
        plan: user.plan,
        status: 'active',
        hasStripe: true,
        subscription: buildSub('active'),
      })
    }

    // Sub Stripe em 'trialing' SÓ é assinatura de verdade se houver cartão
    // cadastrado (paymentMethodAddedAt). O modo "conhecer a plataforma" também
    // seta trialStatus='active' SEM cartão — por isso trialStatus NÃO serve
    // como critério aqui. Sem cartão e sem pagamento → exibir como plano grátis.
    if (subscription.status === 'trialing' && !user.paymentMethodAddedAt) {
      return NextResponse.json({
        plan: user.plan,
        status: 'free',
        subscription: null,
        hasStripe: true,
      })
    }

    return NextResponse.json({
      plan: user.plan,
      status: subscription.status,
      hasStripe: true,
      subscription: buildSub(subscription.status),
    })
  } catch (error: any) {
    console.error('Erro ao buscar assinatura:', error)
    return NextResponse.json({ error: 'Erro ao consultar a assinatura.' }, { status: 500 })
  }
}
