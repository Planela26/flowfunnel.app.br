import { prismaAdmin as prisma } from '@/lib/prisma'

/**
 * Verifica se já existe um FunnelEvent com o mesmo transactionId no metadata.
 * Evita registrar vendas/eventos duplicados quando o gateway reenvia o webhook.
 */
export async function isDuplicateTransaction(
  funnelId: string,
  transactionId: string | null | undefined,
  source: string,
): Promise<boolean> {
  if (!transactionId) return false
  const existing = await prisma.funnelEvent.findFirst({
    where: {
      funnelId,
      metadata: { contains: `"transactionId":"${transactionId}"` },
    },
    select: { id: true },
  })
  if (existing) {
    console.log(`⚠️  [${source}] Transação duplicada ignorada: ${transactionId}`)
    return true
  }
  return false
}
