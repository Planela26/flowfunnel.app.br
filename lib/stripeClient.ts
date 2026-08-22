import Stripe from 'stripe'

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')
  return key
}

export function getPublishableKey(): string {
  const key = process.env.STRIPE_PUBLISHABLE_KEY
  if (!key) throw new Error('STRIPE_PUBLISHABLE_KEY não configurada')
  return key
}

// WARNING: Never cache this client.
// Always call this function to get a fresh client.
export async function getUncachableStripeClient() {
  return new Stripe(getSecretKey(), {
    apiVersion: '2024-11-20.acacia' as any,
  })
}

export async function getStripePublishableKey() {
  return getPublishableKey()
}

export async function getStripeSecretKey() {
  return getSecretKey()
}

// Aqui existia `getStripeSync()`, resquício da época em que o projeto rodava no
// Replit. Ninguém a chamava — conferido em todo o app, lib e components. Mas ela
// arrastava `stripe-replit-sync` para dentro de cada build, que por sua vez traz
// `pg-node-migrations` com `require` dinâmico: era a origem do aviso "Critical
// dependency: the request of a dependency is an expression" que aparecia em todo
// build, com rastro passando por lib/stripeClient.ts.
//
// E, se algum dia fosse chamada, abriria um SEGUNDO pool de conexões ao Postgres
// (max: 2) em paralelo ao do Prisma, fora de qualquer controle deste projeto.
