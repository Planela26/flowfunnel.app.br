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
 * Atomically claim a Mercado Pago event (keyed by `${paymentId}:${status}`).
 * Returns true if this is the first time we see the event; false if it was
 * already processed (in DB or in-memory L1).
 *
 * Uses a Postgres unique constraint so duplicate webhook deliveries are
 * deduped even across server restarts / multiple instances (unlike the old
 * in-memory-only Map).
 */
export async function claimMercadoPagoEvent(eventId: string): Promise<boolean> {
  if (!eventId) return true
  if (memCache.has(eventId)) return false

  try {
    await prisma.mercadoPagoProcessedEvent.create({
      data: { eventId },
    })
    rememberMem(eventId)
    return true
  } catch (err: any) {
    if (err?.code === 'P2002') {
      rememberMem(eventId)
      return false
    }
    console.error('[mercadopago-dedup] erro ao registrar evento', eventId, err?.message || err)
    return true
  }
}

/**
 * Release a previously claimed event so a retry can reprocess it. Call this
 * when processing fails AFTER the claim succeeded, to keep billing
 * at-least-once instead of dropping the event on a transient failure.
 */
export async function releaseMercadoPagoEvent(eventId: string): Promise<void> {
  if (!eventId) return
  memCache.delete(eventId)
  try {
    await prisma.mercadoPagoProcessedEvent.deleteMany({ where: { eventId } })
  } catch (err: any) {
    console.error('[mercadopago-dedup] erro ao liberar evento', eventId, err?.message || err)
  }
}
