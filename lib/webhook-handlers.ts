import { prismaAdmin as prisma } from './prisma'
import { mapPlatformStatusToStage, ensureFunnelWithStages, pickStage } from './webhook-stages'
import { isDuplicateTransaction } from './webhook-dedup'
import { isIngestionBlockedForUser } from './account-status'

// Atualiza o LeadStatus do contato a partir do resultado de uma venda.
// Usado por TODAS as plataformas (Hotmart/Kiwify/Eduzz/Monetizze/Perfect Pay)
// para manter o CRM de leads consistente — pago → GANHO, perdido → PERDIDO.
async function updateLeadStatusFromSale(
  userId: string,
  mapped: { isPaid: boolean; isLost: boolean },
  contact: { phone?: string | null; name?: string | null; email?: string | null }
) {
  const phone = (contact.phone || '').trim()
  if (!phone) return
  const name = contact.name || undefined
  const email = contact.email || undefined
  try {
    if (mapped.isPaid) {
      await prisma.leadStatus.upsert({
        where: { userId_phone: { userId, phone } },
        create: { userId, phone, name: contact.name || null, email: contact.email || null, stage: 'GANHO' },
        update: { stage: 'GANHO', name, email },
      })
    } else if (mapped.isLost) {
      await prisma.leadStatus.upsert({
        where: { userId_phone: { userId, phone } },
        create: { userId, phone, name: contact.name || null, email: contact.email || null, stage: 'PERDIDO' },
        update: { stage: 'PERDIDO' },
      })
    }
  } catch (e) {
    console.error('Erro ao atualizar leadStatus:', e)
  }
}

// Shared event processors used by both the tokenized routes
// (/api/webhooks/<platform>/[token]) and the legacy single-tenant
// fallback routes. Keeps tenant-resolution and signature validation
// at the route layer; pure event-processing logic lives here.

// ---------- HOTMART ----------

export async function processHotmartEvent(event: string, data: any, userId: string) {
  if (await isIngestionBlockedForUser(userId)) {
    console.warn(`⛔ [account-status] plano vencido — ingestão Hotmart pausada para ${userId}`)
    return
  }
  switch (event) {
    case 'PURCHASE_COMPLETE':
    case 'PURCHASE_APPROVED':
      await hotmartPurchaseComplete(data, userId)
      break
    case 'PURCHASE_CANCELED':
    case 'PURCHASE_REFUNDED':
      await hotmartPurchaseCanceled(data, userId, event)
      break
    case 'PURCHASE_DELAYED':
      await hotmartPurchaseDelayed(data, userId)
      break
    case 'PURCHASE_CHARGEBACK':
      console.log('⚠️ Chargeback recebido:', data?.purchase?.transaction)
      break
    default:
      console.log(`Evento Hotmart não tratado: ${event}`)
  }
}

async function hotmartPurchaseComplete(data: any, userId: string) {
  const transactionId = data?.purchase?.transaction
  const price = data?.purchase?.price?.value || 0
  const approvedDate = data?.purchase?.approved_date

  let funnel = await prisma.funnel.findFirst({
    where: { userId },
    include: { stages: true },
  })

  if (!funnel) {
    funnel = await prisma.funnel.create({
      data: {
        userId,
        name: 'Funil Principal',
        description: 'Funil de vendas criado automaticamente',
        startDate: new Date(),
        stages: {
          create: [
            { name: 'Lead', order: 1 },
            { name: 'Qualificado', order: 2 },
            { name: 'Checkout', order: 3 },
            { name: 'Pago', order: 4 },
          ],
        },
      },
      include: { stages: true },
    })
  }

  const paidStage = funnel.stages.find((s: any) => s.name === 'Pago') || funnel.stages[funnel.stages.length - 1]
  if (await isDuplicateTransaction(funnel.id, transactionId, 'hotmart')) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: paidStage.id,
      eventType: 'hotmart_purchase_complete',
      timestamp: approvedDate ? new Date(approvedDate * 1000) : new Date(),
      metadata: JSON.stringify({
        buyerEmail: data?.buyer?.email,
        buyerName: data?.buyer?.name,
        productName: data?.product?.name,
        productId: data?.product?.id,
        transactionId,
        price,
        status: data?.purchase?.status,
        approvedDate,
        source: 'hotmart',
      }),
    },
  })

  await updateLeadStatusFromSale(
    userId,
    { isPaid: true, isLost: false },
    {
      phone: data?.buyer?.checkout_phone || data?.buyer?.phone || null,
      name: data?.buyer?.name || null,
      email: data?.buyer?.email || null,
    },
  )
}

async function hotmartPurchaseCanceled(data: any, userId: string, event?: string) {
  const transactionId = data?.purchase?.transaction
  if (!transactionId) return

  // PURCHASE_REFUNDED → Reembolsado; PURCHASE_CANCELED → Recusado.
  const isRefund = event === 'PURCHASE_REFUNDED'
  const targetStageName = isRefund ? 'Reembolsado' : 'Recusado'
  const newStatus = isRefund ? 'refunded' : 'canceled'

  // Restrict the lookup to this user's funnels to avoid cross-tenant updates
  // even in the unlikely event of a transactionId collision.
  const funnel = await ensureFunnelWithStages(userId)
  const funnels = await prisma.funnel.findMany({
    where: { userId },
    select: { id: true },
  })
  const funnelIds = funnels.map((f) => f.id)
  if (funnelIds.length === 0) return

  const targetStage = pickStage(funnel.stages, targetStageName)

  const existingEvent = await prisma.funnelEvent.findFirst({
    where: {
      funnelId: { in: funnelIds },
      eventType: 'hotmart_purchase_complete',
      metadata: { contains: transactionId },
    },
  })

  if (existingEvent) {
    let metadata: Record<string, any> = {}
    try {
      metadata = typeof existingEvent.metadata === 'string'
        ? JSON.parse(existingEvent.metadata)
        : (existingEvent.metadata as unknown as Record<string, any>) || {}
    } catch { metadata = {} }

    // Move o evento para o estágio Reembolsado/Recusado e marca o status
    // (isCanceledSale passa a excluí-lo de receita em todos os relatórios).
    await prisma.funnelEvent.update({
      where: { id: existingEvent.id },
      data: {
        stageId: targetStage.id,
        metadata: JSON.stringify({
          ...metadata,
          status: newStatus,
          canceledAt: new Date().toISOString(),
        }),
      },
    })

    await updateLeadStatusFromSale(
      userId,
      { isPaid: false, isLost: true },
      {
        phone: data?.buyer?.checkout_phone || data?.buyer?.phone || metadata.buyerPhone || null,
        name: data?.buyer?.name || metadata.buyerName || null,
        email: data?.buyer?.email || metadata.buyerEmail || null,
      },
    )
  }
}

async function hotmartPurchaseDelayed(data: any, userId: string) {
  const transactionId = data?.purchase?.transaction
  const funnel = await prisma.funnel.findFirst({
    where: { userId },
    include: { stages: true },
  })
  if (!funnel) return
  const checkoutStage = funnel.stages.find((s: any) => s.name === 'Checkout') || funnel.stages[2]
  if (!checkoutStage) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: checkoutStage.id,
      eventType: 'hotmart_checkout_started',
      timestamp: new Date(),
      metadata: JSON.stringify({
        buyerEmail: data?.buyer?.email,
        transactionId,
        status: 'delayed',
        source: 'hotmart',
      }),
    },
  })
}

// ---------- KIWIFY ----------

export async function processKiwifyEvent(body: any, userId: string, startTime: number, endpoint: string) {
  if (await isIngestionBlockedForUser(userId)) {
    console.warn(`⛔ [account-status] plano vencido — ingestão Kiwify pausada para ${userId}`)
    return
  }
  const rawStatus = body.order_status || body.status
  const orderId = body.order?.id || body.order_id || null
  const mapped = mapPlatformStatusToStage(rawStatus)
  const eventType = `kiwify_${mapped.eventSuffix}`

  await prisma.webhookLog.create({
    data: {
      userId,
      platform: 'KIWIFY',
      event: eventType,
      method: 'POST',
      endpoint,
      payload: JSON.stringify(body),
      response: JSON.stringify({ success: true }),
      statusCode: 200,
      duration: Date.now() - startTime,
    },
  })

  if (!mapped.stage) return
  const funnel = await ensureFunnelWithStages(userId)
  const stage = pickStage(funnel.stages, mapped.stage)
  if (orderId && (await isDuplicateTransaction(funnel.id, String(orderId), 'kiwify'))) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: stage.id,
      eventType,
      timestamp: new Date(),
      metadata: JSON.stringify({
        orderId,
        amount: (body.amount || 0) / 100,
        buyerEmail: body.customer?.email || body.email,
        buyerName: body.customer?.name || body.name,
        productName: body.product?.name || body.product_name,
        status: rawStatus,
        source: 'kiwify',
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: body.customer?.phone || body.customer?.mobile || body.phone || null,
    name: body.customer?.name || body.name || null,
    email: body.customer?.email || body.email || null,
  })
}

// ---------- EDUZZ ----------

export async function processEduzzEvent(body: any, userId: string, startTime: number, endpoint: string) {
  if (await isIngestionBlockedForUser(userId)) {
    console.warn(`⛔ [account-status] plano vencido — ingestão Eduzz pausada para ${userId}`)
    return
  }
  const rawStatus = body.trans_status_name || body.event || body.status
  const transactionId = body.trans_cod || body.transaction || null
  const mapped = mapPlatformStatusToStage(rawStatus)
  const eventType = `eduzz_${mapped.eventSuffix}`

  await prisma.webhookLog.create({
    data: {
      userId,
      platform: 'EDUZZ',
      event: eventType,
      method: 'POST',
      endpoint,
      payload: JSON.stringify(body),
      response: JSON.stringify({ success: true }),
      statusCode: 200,
      duration: Date.now() - startTime,
    },
  })

  if (!mapped.stage) return
  const funnel = await ensureFunnelWithStages(userId)
  const stage = pickStage(funnel.stages, mapped.stage)
  if (transactionId && (await isDuplicateTransaction(funnel.id, String(transactionId), 'eduzz'))) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: stage.id,
      eventType,
      timestamp: new Date(),
      metadata: JSON.stringify({
        transactionId,
        amount: body.trans_value || body.amount || 0,
        buyerEmail: body.cus_email || body.email,
        buyerName: body.cus_name || body.name,
        productName: body.con_title || body.product_name,
        status: rawStatus,
        source: 'eduzz',
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: body.cus_tel || body.cus_phone || body.phone || null,
    name: body.cus_name || body.name || null,
    email: body.cus_email || body.email || null,
  })
}

// ---------- MONETIZZE ----------

export async function processMonetizzeEvent(body: any, userId: string, startTime: number, endpoint: string) {
  if (await isIngestionBlockedForUser(userId)) {
    console.warn(`⛔ [account-status] plano vencido — ingestão Monetizze pausada para ${userId}`)
    return
  }
  const rawStatus = body.status_name || body.event || body.status
  const transactionId = body.transaction || body.code || null
  const mapped = mapPlatformStatusToStage(rawStatus)
  const eventType = `monetizze_${mapped.eventSuffix}`

  await prisma.webhookLog.create({
    data: {
      userId,
      platform: 'MONETIZZE',
      event: eventType,
      method: 'POST',
      endpoint,
      payload: JSON.stringify(body),
      response: JSON.stringify({ success: true }),
      statusCode: 200,
      duration: Date.now() - startTime,
    },
  })

  if (!mapped.stage) return
  const funnel = await ensureFunnelWithStages(userId)
  const stage = pickStage(funnel.stages, mapped.stage)
  if (transactionId && (await isDuplicateTransaction(funnel.id, String(transactionId), 'monetizze'))) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: stage.id,
      eventType,
      timestamp: new Date(),
      metadata: JSON.stringify({
        transactionId,
        amount: body.amount || body.price || 0,
        buyerEmail: body.buyer?.email || body.email,
        buyerName: body.buyer?.name || body.name,
        productName: body.product?.name || body.product_name,
        status: rawStatus,
        source: 'monetizze',
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: body.buyer?.phone || body.comprador?.telefone || body.telefone || body.phone || null,
    name: body.buyer?.name || body.comprador?.nome || body.name || null,
    email: body.buyer?.email || body.comprador?.email || body.email || null,
  })
}

// ---------- PERFECT PAY ----------

export async function processPerfectPayEvent(body: any, userId: string, startTime: number, endpoint: string) {
  if (await isIngestionBlockedForUser(userId)) {
    console.warn(`⛔ [account-status] plano vencido — ingestão Perfect Pay pausada para ${userId}`)
    return
  }
  const rawStatus = body.sale_status_enum || body.status
  const transactionId = body.sale_id || body.id || null
  const mapped = mapPlatformStatusToStage(rawStatus)
  const eventType = `perfect_pay_${mapped.eventSuffix}`

  await prisma.webhookLog.create({
    data: {
      userId,
      platform: 'PERFECT_PAY',
      event: eventType,
      method: 'POST',
      endpoint,
      payload: JSON.stringify(body),
      statusCode: 200,
      duration: Date.now() - startTime,
    },
  })

  const buyerName = body.customer?.name || body.buyer_name || ''
  const buyerEmail = body.customer?.email || body.buyer_email || ''
  const buyerPhone = body.customer?.phone || body.buyer_phone || ''
  const amount = parseFloat(body.sale_amount || body.amount || '0')

  if (!mapped.stage) return
  const funnel = await ensureFunnelWithStages(userId)
  const stage = pickStage(funnel.stages, mapped.stage)
  if (transactionId && (await isDuplicateTransaction(funnel.id, String(transactionId), 'perfect_pay'))) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: stage.id,
      eventType,
      timestamp: new Date(),
      metadata: JSON.stringify({
        transactionId,
        amount,
        buyerEmail,
        buyerName,
        productName: body.product?.name || body.product_name,
        status: rawStatus,
        source: 'perfect_pay',
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: buyerPhone || null,
    name: buyerName || null,
    email: buyerEmail || null,
  })
}
