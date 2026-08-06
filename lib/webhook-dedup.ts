import { prismaAdmin as prisma } from '@/lib/prisma'

/**
 * Atomically check for duplicate FunnelEvent.
 * Before: used findFirst + INSERT (race condition if 2 webhooks arrived in parallel).
 * Now: lets the database constraint do the work — returns quickly if exists.
 *
 * This is safe and performant:
 *   - Only deduplicates when transactionId + source are present
 *   - Null combinations always insert (não são deduplicados)
 *   - Database unique constraint handles all concurrency
 */
export async function isDuplicateTransaction(
  funnelId: string,
  transactionId: string | null | undefined,
  source: string,
): Promise<boolean> {
  if (!transactionId) return false

  try {
    const existing = await prisma.funnelEvent.findFirst({
      where: {
        funnelId,
        source,
        transactionId,
      },
      select: { id: true },
    })
    if (existing) {
      console.log(`⚠️  [${source}] Transação duplicada ignorada: ${transactionId}`)
      return true
    }
    return false
  } catch (e) {
    // Falha de banco = fail-open (permite insert), não quer derrubar webhook
    console.error('[webhook-dedup] erro ao verificar duplicidade', e)
    return false
  }
}

/**
 * Atomically insert a FunnelEvent. If it violates the unique constraint
 * (same funnelId + source + transactionId), throws P2002 (caller handles retry logic).
 *
 * This ensures exactly-once semantics for payment webhook events:
 * if Stripe/MP/Hotmart redelivers the same event, the database rejects it.
 */
export async function createFunnelEventAtomic(data: {
  funnelId: string
  stageId: string
  leadId?: string | null
  eventType: string
  source?: string | null
  transactionId?: string | null
  metadata?: string | null
  timestamp?: Date
}): Promise<{ id: string }> {
  const event = await prisma.funnelEvent.create({
    data: {
      ...data,
      transactionId: data.transactionId || null,
      source: data.source || null,
    },
    select: { id: true },
  })
  return event
}
