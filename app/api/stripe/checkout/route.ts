import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'

const PLAN_PRICES: Record<string, string> = {
  START: process.env.STRIPE_PRICE_START || '',
  PRO:   process.env.STRIPE_PRICE_PRO   || '',
  SCALE: process.env.STRIPE_PRICE_SCALE || '',
}

export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(`stripe:checkout:${request.headers.get('x-forwarded-for') || 'anon'}`, 10, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { plan } = await request.json()
    const priceId = PLAN_PRICES[plan?.toUpperCase()]

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
      const customer = await stripe.customers.create(
        {
          email: user?.email || session.user.email || '',
          name: user?.name || session.user.name || '',
          metadata: { userId: session.user.id },
        },
        { idempotencyKey: `customer_create_${session.user.id}` },
      )
      customerId = customer.id
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : process.env.NEXTAUTH_URL || 'http://localhost:5000'

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${domain}/dashboard?plan_activated=${plan}`,
      cancel_url: `${domain}/pricing`,
      locale: 'pt-BR',
      metadata: { userId: session.user.id, plan },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('Erro ao criar checkout Stripe:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
