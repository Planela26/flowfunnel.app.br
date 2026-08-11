import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { getBaseUrl } from '@/lib/base-url'

const PLAN_PRICES: Record<string, string> = {
  START: process.env.STRIPE_PRICE_START || '',
  PRO:   process.env.STRIPE_PRICE_PRO   || '',
  SCALE: process.env.STRIPE_PRICE_SCALE || '',
}

function getSafeOrigin(request: Request) {
  const base = getBaseUrl()
  const origin = request.headers.get('origin')
  if (origin && origin === base) return origin
  return base
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`stripe:embedded-checkout:${session.user.id}`, 10, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { plan } = await request.json()
    const planKey = plan?.toUpperCase()
    const priceId = PLAN_PRICES[planKey]

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

    const origin = getSafeOrigin(request)

    const checkoutSession = await stripe.checkout.sessions.create({
      ui_mode: 'embedded' as any,
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${origin}/dashboard?plan_activated=${planKey}&session_id={CHECKOUT_SESSION_ID}`,
      locale: 'pt-BR',
      metadata: { userId: session.user.id, plan: planKey },
      tax_id_collection: { enabled: false },
    })

    return NextResponse.json({ clientSecret: checkoutSession.client_secret })
  } catch (error: any) {
    console.error('Erro ao criar embedded checkout:', error)
    return NextResponse.json({ error: 'Erro ao iniciar o checkout. Tente novamente.' }, { status: 500 })
  }
}
