import { prismaAdmin as prisma } from './prisma'

const memCache = new Set<string>()
const MAX_MEM = 500

function rememberMem(eventId: string) {
  if (memCache.size >= MAX_MEM) {
    const first = memCache.values().next().value
    if (first) memCache.delete(first)
  }
  memCache.add(eventId)
}

/**
 * Atomically claim a Stripe event id. Returns true if this is the first time
 * we see the event; false if it was already processed (in DB or in-memory L1).
 *
 * Uses Postgres unique constraint to prevent race conditions when multiple
 * webhook deliveries land concurrently.
 */
export async function claimStripeEvent(eventId: string, eventType?: string): Promise<boolean> {
  if (!eventId) return true
  if (memCache.has(eventId)) return false

  try {
    await prisma.stripeProcessedEvent.create({
      data: { eventId, eventType: eventType || null },
    })
    rememberMem(eventId)
    return true
  } catch (err: any) {
    // P2002 = unique constraint violation -> already processed by another delivery
    if (err?.code === 'P2002') {
      rememberMem(eventId)
      return false
    }
    // Don't crash the webhook handler over a dedup write failure.
    console.error('[stripe-dedup] erro ao registrar evento', eventId, err?.message || err)
    return true
  }
}

/**
 * Release a previously claimed event so Stripe retries can reprocess it.
 * Call this when processing fails AFTER claimStripeEvent succeeded, to keep
 * billing at-least-once instead of dropping the event on a transient failure.
 */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  if (!eventId) return
  memCache.delete(eventId)
  try {
    await prisma.stripeProcessedEvent.deleteMany({ where: { eventId } })
  } catch (err: any) {
    console.error('[stripe-dedup] erro ao liberar evento', eventId, err?.message || err)
  }
}
