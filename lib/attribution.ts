import { prismaAdmin as prisma } from './prisma'

/**
 * Motor de atribuição de vendas da FlowSara.
 *
 * Estratégia A — DETERMINÍSTICA (prioridade máxima, confidence = 1.0):
 *   1. lead_id devolvido pelo parâmetro nativo do checkout no webhook
 *      (Hotmart sck, Kiwify s1, Eduzz utm_content, Monetizze/Perfect Pay src,
 *      Stripe client_reference_id) → matchedBy: 'checkout_param'
 *   2. lead_id devolvido pela thank-you page (flowsara-conversion.js),
 *      casado por order_id/transactionId → matchedBy: 'thank_you_page'
 *
 * Estratégia B — PROBABILÍSTICA (fallback, nunca sobrescreve determinística):
 *   3. email do comprador ↔ email capturado no CRM/lead → 'email' (0.7)
 *   4. telefone do comprador ↔ conversa WhatsApp → 'phone' (0.6)
 *   5. janela temporal: último click_checkout do tenant nas 24h anteriores
 *      à venda → 'time_window' (0.3)
 *   6. nada encontrado → method 'unmatched' (0), permanece elegível para
 *      reconciliação posterior pela thank-you page.
 */

export interface SaleInfo {
  platform: string // hotmart | kiwify | eduzz | monetizze | perfect_pay | stripe
  transactionId: string
  value?: number
  currency?: string
  product?: string | null
  buyerEmail?: string | null
  buyerPhone?: string | null
  saleTime?: Date
  // Campos de tracking devolvidos pelo webhook (parâmetro nativo do checkout)
  trackingParams?: (string | null | undefined)[]
  metadata?: Record<string, any>
}

const LEAD_ID_RX = /^l_[a-z0-9]+_[a-z0-9]+$/i

function extractLeadId(candidates: (string | null | undefined)[] = []): string | null {
  for (const c of candidates) {
    if (!c) continue
    const v = String(c).trim()
    if (LEAD_ID_RX.test(v)) return v
    // Alguns checkouts devolvem "sck=l_xxx|outra_coisa" ou URL-encoded
    const m = v.match(/l_[a-z0-9]+_[a-z0-9]+/i)
    if (m) return m[0]
  }
  return null
}

async function findTrackedLead(userId: string, leadId: string) {
  return prisma.trackedLead.findUnique({
    where: { userId_leadId: { userId, leadId } },
  })
}

async function upsertAttribution(
  userId: string,
  sale: SaleInfo,
  resolved: {
    leadId: string | null
    method: 'deterministic' | 'probabilistic' | 'unmatched'
    matchedBy: string | null
    confidence: number
  }
) {
  const lead = resolved.leadId ? await findTrackedLead(userId, resolved.leadId) : null

  const data = {
    leadId: resolved.leadId,
    method: resolved.method,
    matchedBy: resolved.matchedBy,
    confidence: resolved.confidence,
    utmSource: lead?.utmSource ?? null,
    utmCampaign: lead?.utmCampaign ?? null,
    utmMedium: lead?.utmMedium ?? null,
    utmContent: lead?.utmContent ?? null,
    fbclid: lead?.fbclid ?? null,
    gclid: lead?.gclid ?? null,
    value: sale.value ?? 0,
    currency: (sale.currency || 'BRL').toUpperCase(),
    product: sale.product ?? null,
    buyerEmail: sale.buyerEmail ?? null,
    buyerPhone: sale.buyerPhone ?? null,
    metadata: sale.metadata ? JSON.stringify(sale.metadata).slice(0, 4000) : null,
  }

  const existing = await prisma.saleAttribution.findUnique({
    where: {
      userId_platform_transactionId: {
        userId,
        platform: sale.platform,
        transactionId: sale.transactionId,
      },
    },
  })

  if (existing) {
    // NUNCA rebaixa: só atualiza se a nova resolução é mais confiável.
    if (existing.method === 'deterministic' && resolved.method !== 'deterministic') return existing
    if (existing.confidence >= resolved.confidence && existing.method === resolved.method) return existing
    return prisma.saleAttribution.update({ where: { id: existing.id }, data })
  }

  return prisma.saleAttribution.create({
    data: { userId, platform: sale.platform, transactionId: sale.transactionId, ...data },
  })
}

/**
 * Ponto de entrada principal — chamado pelos handlers de webhook após
 * registrar a venda. Tenta A (determinística) e cai para B (probabilística).
 */
export async function attributeSale(userId: string, sale: SaleInfo) {
  try {
    // ESTRATÉGIA A.1 — lead_id no parâmetro nativo do checkout
    const directLeadId = extractLeadId(sale.trackingParams)
    if (directLeadId && (await findTrackedLead(userId, directLeadId))) {
      return upsertAttribution(userId, sale, {
        leadId: directLeadId,
        method: 'deterministic',
        matchedBy: 'checkout_param',
        confidence: 1,
      })
    }

    // ESTRATÉGIA A.2 — thank-you page já reportou este order_id
    if (sale.transactionId) {
      const conv = await prisma.trackedConversion.findFirst({
        where: {
          userId,
          orderId: sale.transactionId,
          NOT: { leadId: { startsWith: 'unknown_' } },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (conv && (await findTrackedLead(userId, conv.leadId))) {
        return upsertAttribution(userId, sale, {
          leadId: conv.leadId,
          method: 'deterministic',
          matchedBy: 'thank_you_page',
          confidence: 1,
        })
      }
    }

    // ESTRATÉGIA B.3 — email (comprador ↔ lead CRM com mesmo email)
    // TrackedLead não tem email; LeadStatus tem. Um lead CRM com email igual
    // e telefone presente indica conversa WhatsApp — vínculo indireto.
    // Só serve para marcar origem provável, não liga a um TrackedLead.
    // Para atribuição de UTM, tentamos o último lead rastreado do visitante
    // que clicou em checkout numa janela de 24h.
    const saleTime = sale.saleTime || new Date()
    const windowStart = new Date(saleTime.getTime() - 24 * 60 * 60 * 1000)

    if (sale.buyerEmail || sale.buyerPhone) {
      const or: any[] = []
      if (sale.buyerEmail) or.push({ email: { equals: sale.buyerEmail, mode: 'insensitive' } })
      if (sale.buyerPhone) or.push({ phone: sale.buyerPhone })
      const crmLead = await prisma.leadStatus.findFirst({ where: { userId, OR: or } })
      if (crmLead) {
        // Vínculo probabilístico via CRM (sem TrackedLead → sem UTM snapshot)
        return upsertAttribution(userId, sale, {
          leadId: null,
          method: 'probabilistic',
          matchedBy: sale.buyerEmail && crmLead.email?.toLowerCase() === sale.buyerEmail.toLowerCase() ? 'email' : 'phone',
          confidence: sale.buyerEmail ? 0.7 : 0.6,
        })
      }
    }

    // ESTRATÉGIA B.5 — janela temporal: último click_checkout nas 24h
    const lastCheckoutClick = await prisma.trackedEvent.findFirst({
      where: {
        userId,
        eventName: 'click_checkout',
        createdAt: { gte: windowStart, lte: saleTime },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (lastCheckoutClick) {
      return upsertAttribution(userId, sale, {
        leadId: lastCheckoutClick.leadId,
        method: 'probabilistic',
        matchedBy: 'time_window',
        confidence: 0.3,
      })
    }

    // Nada encontrado — registra como unmatched (reconciliável depois)
    return upsertAttribution(userId, sale, {
      leadId: null,
      method: 'unmatched',
      matchedBy: null,
      confidence: 0,
    })
  } catch (e: any) {
    console.error('[attribution] erro:', e?.message)
    return null
  }
}

/**
 * Reconciliação via thank-you page (flowsara-conversion.js).
 *
 * SEGURANÇA: /api/track/conversion é público (como todo pixel). Por isso a
 * thank-you page NUNCA cria registros de receita/atribuição sozinha — ela só
 * PROMOVE uma venda que já foi confirmada por um webhook autenticado da
 * plataforma. Se a thank-you chegar ANTES do webhook, a TrackedConversion
 * gravada fica aguardando: o webhook posterior a encontra pela Estratégia A.2.
 *
 * Match estrito: quando a plataforma é informada, exige (platform,
 * transactionId); sem plataforma, só promove se houver exatamente UM registro
 * com aquele transactionId (evita atualizar venda errada em colisão de IDs).
 */
export async function attributeFromThankYouPage(
  userId: string,
  info: {
    leadId: string
    orderId: string | null
    platform: string | null
    value: number
    currency: string
    product: string | null
  }
) {
  if (!info.orderId) return null
  const lead = await findTrackedLead(userId, info.leadId)
  if (!lead) return null

  let existing = null
  if (info.platform) {
    existing = await prisma.saleAttribution.findUnique({
      where: {
        userId_platform_transactionId: {
          userId,
          platform: info.platform,
          transactionId: info.orderId,
        },
      },
    })
  } else {
    const candidates = await prisma.saleAttribution.findMany({
      where: { userId, transactionId: info.orderId },
      take: 2,
    })
    // Ambíguo (mesmo transactionId em 2+ plataformas) → não arriscar.
    existing = candidates.length === 1 ? candidates[0] : null
  }

  if (!existing) return null // aguarda o webhook; A.2 fecha o vínculo depois
  if (existing.method === 'deterministic' && existing.leadId) return existing

  return prisma.saleAttribution.update({
    where: { id: existing.id },
    data: {
      leadId: info.leadId,
      method: 'deterministic',
      matchedBy: 'thank_you_page',
      confidence: 1,
      utmSource: lead.utmSource,
      utmCampaign: lead.utmCampaign,
      utmMedium: lead.utmMedium,
      utmContent: lead.utmContent,
      fbclid: lead.fbclid,
      gclid: lead.gclid,
    },
  })
}
