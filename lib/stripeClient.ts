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

// StripeSync singleton for webhook processing and data sync
let stripeSync: any = null

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync')
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: getSecretKey(),
    })
  }
  return stripeSync
}
