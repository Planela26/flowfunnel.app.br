/**
 * Funil próprio do FlowSara — o "laboratório".
 *
 * Todo o rastreamento existente foi construído para o funil DOS CLIENTES: o
 * tracker.js instalado no site deles, o checkout deles, o webhook deles. Este
 * módulo cobre a outra ponta — o funil do próprio FlowSara: anúncio → nossa
 * landing → nosso checkout → nosso Mercado Pago → assinatura.
 *
 * A jornada é gravada nas MESMAS tabelas (TrackedLead, TrackedSession,
 * TrackedEvent, TrackedConversion, SaleAttribution), sob a conta do Owner.
 * Não há segundo sistema de identificação nem segundo conjunto de tabelas: o
 * FlowSara passa a ser, para efeito de rastreamento, um cliente de si mesmo.
 */

import { prismaAdmin as prisma } from './prisma'

/**
 * Conta que recebe os dados do funil próprio.
 *
 * Resolvida SEMPRE no servidor. O `data-site` do tracker.js público carrega o
 * userId no HTML da página do cliente — aceitável lá, porque o dado é dele.
 * Aqui não: expor o id da conta Owner no navegador permitiria a qualquer um
 * injetar eventos falsos no funil que serve para decidir investimento em
 * anúncio. Por isso o endpoint interno não recebe identificador nenhum.
 *
 * Ordem: variável de ambiente (permite apontar para uma conta específica) e,
 * na ausência dela, o ADMIN mais antigo — que é a conta fundadora.
 */
let cacheOwnerId: string | null = null
let cacheEm = 0
const CACHE_MS = 5 * 60 * 1000

export async function getOwnerUserId(): Promise<string | null> {
  const doEnv = process.env.OWNER_TRACKING_USER_ID
  if (doEnv) return doEnv

  const agora = Date.now()
  if (cacheOwnerId && agora - cacheEm < CACHE_MS) return cacheOwnerId

  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    cacheOwnerId = admin?.id ?? null
    cacheEm = agora
    return cacheOwnerId
  } catch {
    return null
  }
}

/**
 * Autorização real do laboratório — não basta esconder o botão.
 *
 * A checagem é por papel E por ser a conta dona do funil: um segundo
 * administrador (suporte, por exemplo) continua administrando clientes sem
 * enxergar os números de marketing do negócio.
 */
export async function canAccessOwnerFunnel(user: { id?: string; role?: string } | null | undefined): Promise<boolean> {
  if (!user?.id || user.role !== 'ADMIN') return false
  const ownerId = await getOwnerUserId()
  return !!ownerId && ownerId === user.id
}

// ── Eventos da jornada ──────────────────────────────────────────────────────
//
// Nomes fixos, para que o funil em degraus e a Sara leiam sempre a mesma
// chave. Os quatro primeiros já existiam no tracker.js dos clientes; os de
// pagamento são novos e nascem aqui.
export const EVENTOS = {
  pageView: 'page_view',
  scroll25: 'scroll_25',
  scroll50: 'scroll_50',
  scroll60: 'scroll_60',
  scroll75: 'scroll_75',
  scroll90: 'scroll_90',
  ctaClick: 'cta_click',
  checkoutView: 'checkout_view',
  checkoutInitiated: 'checkout_initiated',
  pixGenerated: 'pix_generated',
  paymentStarted: 'payment_started',
  paymentApproved: 'payment_approved',
} as const

export type NomeDeEvento = (typeof EVENTOS)[keyof typeof EVENTOS]

/** Só estes nomes são aceitos do navegador — o resto é descartado. */
export const EVENTOS_DO_NAVEGADOR: string[] = [
  EVENTOS.pageView,
  EVENTOS.scroll25,
  EVENTOS.scroll50,
  EVENTOS.scroll60,
  EVENTOS.scroll75,
  EVENTOS.scroll90,
  EVENTOS.ctaClick,
  EVENTOS.checkoutView,
]

/**
 * Degraus do funil, na ordem em que a pessoa os atravessa.
 *
 * `engajamento` conta quem passou de 50% da página: é o recorte que separa
 * "abriu e saiu" de "leu de verdade", e é onde costuma estar a maior perda.
 */
export const DEGRAUS: Array<{ chave: string; rotulo: string; eventos: string[] }> = [
  { chave: 'visitas', rotulo: 'Visitas na LP', eventos: [EVENTOS.pageView] },
  { chave: 'engajamento', rotulo: 'Engajamento', eventos: [EVENTOS.scroll50, EVENTOS.scroll60, EVENTOS.scroll75, EVENTOS.scroll90] },
  { chave: 'cta', rotulo: 'Clique no CTA', eventos: [EVENTOS.ctaClick] },
  { chave: 'checkout', rotulo: 'Checkout', eventos: [EVENTOS.checkoutView, EVENTOS.checkoutInitiated] },
  { chave: 'pagamentoIniciado', rotulo: 'Pagamento iniciado', eventos: [EVENTOS.paymentStarted, EVENTOS.pixGenerated] },
  { chave: 'compras', rotulo: 'Compras', eventos: [EVENTOS.paymentApproved] },
]

/**
 * Registra um evento da jornada própria.
 *
 * Best-effort por princípio: rastreamento nunca pode derrubar o fluxo que está
 * observando. Uma falha aqui custa uma linha de estatística; uma exceção
 * propagada custaria o pagamento do cliente.
 */
export async function registrarEventoProprio(params: {
  leadId: string
  sessionId?: string | null
  evento: NomeDeEvento
  url?: string | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const ownerId = await getOwnerUserId()
    if (!ownerId) return

    await prisma.trackedEvent.create({
      data: {
        userId: ownerId,
        leadId: params.leadId,
        sessionId: params.sessionId ?? null,
        eventName: params.evento,
        url: params.url ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata).slice(0, 4000) : null,
      },
    })
  } catch (e) {
    console.error('[owner-funnel] falha ao registrar evento:', e)
  }
}

/**
 * Registra a COMPRA do funil próprio e fecha a atribuição.
 *
 * Chamado somente pelo webhook, na confirmação real do Mercado Pago. Grava em
 * TrackedConversion (a venda) e em SaleAttribution (o vínculo com a jornada),
 * as mesmas tabelas que a atribuição de venda dos clientes usa — então os
 * relatórios e a Sara leem tudo pelo mesmo caminho.
 *
 * Idempotente por duas vias: a chave única de SaleAttribution
 * (userId+platform+transactionId) e a verificação de conversão já existente
 * pelo orderId. Webhook reenviado não duplica receita.
 */
export async function registrarCompraDoFunilProprio(params: {
  leadId: string
  paymentId: string
  plano: string
  valor: number
  metodo?: string | null
}): Promise<void> {
  const ownerId = await getOwnerUserId()
  if (!ownerId) return

  const { leadId, paymentId, plano, valor, metodo } = params

  const jaRegistrada = await prisma.trackedConversion.findFirst({
    where: { userId: ownerId, orderId: paymentId },
    select: { id: true },
  })
  if (jaRegistrada) return

  await prisma.trackedConversion.create({
    data: {
      userId: ownerId,
      leadId,
      orderId: paymentId,
      platform: 'mercadopago',
      currency: 'BRL',
      value: valor,
      product: plano,
      source: 'flowsara_self',
      metadata: JSON.stringify({ metodo }),
    },
  })

  // Snapshot da origem no momento da compra. Guardar aqui, e não resolver por
  // consulta depois, é o que preserva a resposta de "veio de qual anúncio"
  // mesmo que a campanha seja renomeada ou o lead receba novos cliques.
  const lead = await prisma.trackedLead.findFirst({
    where: { userId: ownerId, leadId },
    select: {
      utmSource: true, utmCampaign: true, utmMedium: true, utmContent: true,
      fbclid: true, gclid: true, campaignId: true, adsetId: true, adId: true,
    },
  })

  await prisma.saleAttribution.upsert({
    where: {
      userId_platform_transactionId: {
        userId: ownerId,
        platform: 'mercadopago',
        transactionId: paymentId,
      },
    },
    update: {},
    create: {
      userId: ownerId,
      platform: 'mercadopago',
      transactionId: paymentId,
      leadId,
      // Determinística com confiança 1: o lead_id atravessou a jornada inteira
      // dentro da referência externa do pagamento. Não há inferência aqui.
      method: 'deterministic',
      matchedBy: 'checkout_param',
      confidence: 1,
      utmSource: lead?.utmSource ?? null,
      utmCampaign: lead?.utmCampaign ?? null,
      utmMedium: lead?.utmMedium ?? null,
      utmContent: lead?.utmContent ?? null,
      fbclid: lead?.fbclid ?? null,
      gclid: lead?.gclid ?? null,
      value: valor,
      currency: 'BRL',
      product: plano,
      metadata: JSON.stringify({
        metodo,
        campaignId: lead?.campaignId ?? null,
        adsetId: lead?.adsetId ?? null,
        adId: lead?.adId ?? null,
      }),
    },
  })
}
