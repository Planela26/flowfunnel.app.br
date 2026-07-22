import { getUncachableStripeClient } from '../lib/stripeClient'

async function seedProducts() {
  const stripe = await getUncachableStripeClient()

  const plans = [
    {
      name: 'START',
      description: 'Ideal para começar — 1.000 conversas iniciadas/mês',
      amount: 9700, // R$ 97,00 em centavos
      metadata: { plan: 'START', limit_conversas: '1000' },
    },
    {
      name: 'PRO',
      description: 'Para quem escala — 3.000 conversas iniciadas/mês',
      amount: 14700, // R$ 147,00
      metadata: { plan: 'PRO', limit_conversas: '3000' },
    },
    {
      name: 'SCALE',
      description: 'Ilimitado — para operações de alto volume',
      amount: 29700, // R$ 297,00
      metadata: { plan: 'SCALE', limit_conversas: 'unlimited' },
    },
  ]

  const priceIds: Record<string, string> = {}

  for (const plan of plans) {
    const existing = await stripe.products.search({ query: `name:'${plan.name}'` })

    if (existing.data.length > 0) {
      console.log(`✅ Produto ${plan.name} já existe, pulando criação`)
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true })
      if (prices.data.length > 0) {
        priceIds[plan.name] = prices.data[0].id
        console.log(`   Price ID: ${prices.data[0].id}`)
      }
      continue
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    })

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: 'brl',
      recurring: { interval: 'month' },
      metadata: plan.metadata,
    })

    priceIds[plan.name] = price.id
    console.log(`✅ Criado: ${plan.name} — Price ID: ${price.id}`)
  }

  console.log('\n📋 Configure estas variáveis de ambiente:')
  for (const [plan, priceId] of Object.entries(priceIds)) {
    console.log(`STRIPE_PRICE_${plan}=${priceId}`)
  }
}

seedProducts().catch(console.error)
