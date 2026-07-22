// Mapeamento centralizado de status de plataformas externas → estágio do funil interno.
// Usado pelos webhooks Eduzz/Kiwify/Monetizze/Perfect Pay/Hotmart.

export type FunnelStageName =
  | 'Lead'
  | 'Qualificado'
  | 'Checkout'
  | 'Pago'
  | 'Recusado'
  | 'Reembolsado'
  | 'Chargeback'
  | 'Abandonado'

export const DEFAULT_STAGES: { name: FunnelStageName; order: number }[] = [
  { name: 'Lead', order: 1 },
  { name: 'Qualificado', order: 2 },
  { name: 'Checkout', order: 3 },
  { name: 'Pago', order: 4 },
  { name: 'Recusado', order: 5 },
  { name: 'Reembolsado', order: 6 },
  { name: 'Chargeback', order: 7 },
  { name: 'Abandonado', order: 8 },
]

const PAID = ['paid', 'approved', 'pago', 'aprovado', '3', 'sale_approved']
const REFUSED = ['refused', 'recusado', 'declined', 'rejected', 'cancelled', 'canceled', 'sale_refused', '2']
const REFUNDED = ['refunded', 'reembolsado', 'sale_refunded']
const CHARGEBACK = ['chargeback', 'disputed', 'sale_chargeback']
const ABANDONED = ['abandoned', 'abandonado', 'cart_abandoned', 'expired', 'pending', 'aguardando']
const CHECKOUT = ['checkout_started', 'checkout_iniciado', 'sale_started', 'cart_started', 'sale_billet_printed', 'sale_pix_pending']

export type StageMapResult = {
  stage: FunnelStageName | null
  isPaid: boolean
  isLost: boolean
  eventSuffix: string
}

export function mapPlatformStatusToStage(rawStatus: string | null | undefined): StageMapResult {
  const s = String(rawStatus || '').toLowerCase().trim()
  if (!s) return { stage: null, isPaid: false, isLost: false, eventSuffix: 'unknown' }
  if (PAID.includes(s)) return { stage: 'Pago', isPaid: true, isLost: false, eventSuffix: 'purchase_complete' }
  if (REFUSED.includes(s)) return { stage: 'Recusado', isPaid: false, isLost: true, eventSuffix: 'refused' }
  if (REFUNDED.includes(s)) return { stage: 'Reembolsado', isPaid: false, isLost: true, eventSuffix: 'refunded' }
  if (CHARGEBACK.includes(s)) return { stage: 'Chargeback', isPaid: false, isLost: true, eventSuffix: 'chargeback' }
  if (ABANDONED.includes(s)) return { stage: 'Abandonado', isPaid: false, isLost: false, eventSuffix: 'abandoned' }
  if (CHECKOUT.includes(s)) return { stage: 'Checkout', isPaid: false, isLost: false, eventSuffix: 'checkout_started' }
  return { stage: null, isPaid: false, isLost: false, eventSuffix: s.replace(/[^a-z0-9_]/g, '_') }
}

import { prismaAdmin as prisma } from './prisma'

export async function ensureFunnelWithStages(userId: string) {
  let funnel = await prisma.funnel.findFirst({
    where: { userId },
    include: { stages: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!funnel) {
    funnel = await prisma.funnel.create({
      data: {
        userId,
        name: 'Funil Principal',
        description: 'Funil de vendas criado automaticamente',
        startDate: new Date(),
        stages: { create: DEFAULT_STAGES },
      },
      include: { stages: true },
    })
    return funnel
  }

  // Garantir que os estágios novos (Recusado/Reembolsado/Chargeback/Abandonado) existam
  const existingNames = new Set(funnel.stages.map((s: any) => s.name))
  const missing = DEFAULT_STAGES.filter((s) => !existingNames.has(s.name))
  if (missing.length > 0) {
    const maxOrder = Math.max(0, ...funnel.stages.map((s: any) => s.order))
    for (let i = 0; i < missing.length; i++) {
      try {
        await prisma.funnelStage.create({
          data: {
            funnelId: funnel.id,
            name: missing[i].name,
            order: maxOrder + i + 1,
          },
        })
      } catch {
        // Ignore order conflicts
      }
    }
    funnel = await prisma.funnel.findFirst({
      where: { id: funnel.id },
      include: { stages: true },
    }) as any
  }

  return funnel!
}

export function pickStage(stages: { id: string; name: string }[], target: FunnelStageName) {
  return stages.find((s) => s.name === target) || stages[stages.length - 1]
}
