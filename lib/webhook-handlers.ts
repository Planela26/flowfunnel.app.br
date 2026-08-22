import { prismaAdmin as prisma } from './prisma'
import { mapPlatformStatusToStage, ensureFunnelWithStages, pickStage } from './webhook-stages'
import { isDuplicateTransaction } from './webhook-dedup'
import { isIngestionBlockedForUser } from './account-status'
import { attributeSale } from './attribution'
import { dataDeWebhook, valorDaCompra } from './webhook-time'

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

/**
 * Resultado da ingestão, para que a rota registre o que REALMENTE aconteceu.
 *
 * Antes esta função devolvia `void`: quando a conta estava vencida ela
 * descartava o evento e retornava, e a rota gravava `WebhookLog` com status 200
 * e `{success:true}`. Entrega engolida ficava idêntica a entrega processada, e
 * a única pista era um `console.warn` no PM2. Quem olhava a interface via o
 * card zerado sem nenhuma explicação em lugar nenhum.
 */
export type ResultadoIngestao =
  | { ingerido: true; evento: string }
  | { ingerido: false; motivo: 'conta_vencida' | 'evento_nao_tratado'; evento: string }

export async function processHotmartEvent(
  event: string,
  data: any,
  userId: string,
): Promise<ResultadoIngestao> {
  if (await isIngestionBlockedForUser(userId)) {
    console.warn(`⛔ [account-status] plano vencido — ingestão Hotmart pausada para ${userId}`)
    return { ingerido: false, motivo: 'conta_vencida', evento: event }
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
    case 'PURCHASE_BILLET_PRINTED':
      await hotmartPurchaseDelayed(data, userId)
      break
    // Abandono de carrinho é evento próprio da Hotmart 2.0.0. Sem tratá-lo, o
    // número de "abandonados" do card não tinha fonte nenhuma — era sempre 0.
    case 'PURCHASE_OUT_OF_SHOPPING_CART':
      await hotmartCartAbandoned(data, userId)
      break
    case 'PURCHASE_CHARGEBACK':
      console.log('⚠️ Chargeback recebido:', data?.purchase?.transaction)
      break
    default:
      console.log(`Evento Hotmart não tratado: ${event}`)
      return { ingerido: false, motivo: 'evento_nao_tratado', evento: event }
  }
  return { ingerido: true, evento: event }
}

async function hotmartPurchaseComplete(data: any, userId: string) {
  const transactionId = data?.purchase?.transaction
  // Três campos de preço possíveis; ver valorDaCompra em lib/webhook-time.ts.
  const { valor: price, moeda, campo: campoDoPreco } = valorDaCompra(data?.purchase)
  if (price === 0) {
    // Venda gravada com valor zero contamina faturamento e ticket médio do
    // período inteiro. Se nenhum dos três campos veio, isso precisa aparecer.
    console.warn(
      `⚠️ [hotmart] venda ${transactionId} sem valor: nenhum de ` +
      `price/full_price/original_offer_price veio preenchido no payload.`,
    )
  }
  const approvedDate = data?.purchase?.approved_date
  // A Hotmart 2.0.0 manda milissegundos; ver lib/webhook-time.ts.
  const quandoAprovou = dataDeWebhook(approvedDate)

  // Usa o mesmo criador que os outros handlers. A versão que existia aqui
  // criava um funil com apenas 4 estágios; quando ela rodava primeiro numa
  // conta nova, 'Abandonado' e 'Recusado' nunca existiam, e os handlers que
  // procuram por eles caíam no `stages[length-1]` — um carrinho abandonado
  // acabava gravado no estágio 'Pago'.
  const funnel = await ensureFunnelWithStages(userId)

  const paidStage = pickStage(funnel.stages, 'Pago')

  const dados = {
    stageId: paidStage.id,
    eventType: 'hotmart_purchase_complete',
    timestamp: quandoAprovou,
    metadata: JSON.stringify({
      buyerEmail: data?.buyer?.email,
      buyerName: data?.buyer?.name,
      productName: data?.product?.name,
      productId: data?.product?.id,
      price,
      moeda,
      // De qual dos três campos o valor saiu, e os três como vieram. Sem isto,
      // um faturamento errado não tem como ser conferido depois: o payload
      // original não fica guardado em lugar nenhum permanente.
      campoDoPreco,
      precosRecebidos: {
        price: data?.purchase?.price?.value ?? null,
        full_price: data?.purchase?.full_price?.value ?? null,
        original_offer_price: data?.purchase?.original_offer_price?.value ?? null,
      },
      status: data?.purchase?.status,
      approvedDate,
    }),
  }

  // A unicidade no banco é (funnelId, source, transactionId) — SEM eventType.
  // Uma transação tem, portanto, UMA linha, que avança de estágio; é assim que
  // `hotmartPurchaseCanceled` já a trata.
  //
  // Boleto e PIX expõem o problema disso: `PURCHASE_BILLET_PRINTED` grava a
  // transação como 'hotmart_checkout_started' e, quando o pagamento é aprovado,
  // o dedup encontrava essa linha e ABORTAVA — a venda nunca era registrada e o
  // pedido ficava pendente para sempre. Aqui a linha é PROMOVIDA a venda, que é
  // o que de fato aconteceu com ela.
  const existente = transactionId
    ? await prisma.funnelEvent.findFirst({
        where: { funnelId: funnel.id, source: 'hotmart', transactionId: String(transactionId) },
        select: { id: true, eventType: true },
      })
    : null

  if (existente?.eventType === 'hotmart_purchase_complete') return // reentrega real

  if (existente) {
    await prisma.funnelEvent.update({ where: { id: existente.id }, data: dados })
  } else {
    await prisma.funnelEvent.create({
      data: {
        funnelId: funnel.id,
        source: 'hotmart',
        transactionId: transactionId ? String(transactionId) : null,
        ...dados,
      },
    })
  }

  await updateLeadStatusFromSale(
    userId,
    { isPaid: true, isLost: false },
    {
      phone: data?.buyer?.checkout_phone || data?.buyer?.phone || null,
      name: data?.buyer?.name || null,
      email: data?.buyer?.email || null,
    },
  )

  // Atribuição: o sck (injetado pelo tracker no link do checkout) volta aqui.
  if (transactionId) {
    try {
      await attributeSale(userId, {
        platform: 'hotmart',
        transactionId: String(transactionId),
        value: price,
        product: data?.product?.name || null,
        buyerEmail: data?.buyer?.email || null,
        buyerPhone: data?.buyer?.checkout_phone || data?.buyer?.phone || null,
        saleTime: quandoAprovou,
        trackingParams: [
          data?.purchase?.origin?.sck,
          data?.purchase?.sckPaymentLink,
          data?.purchase?.tracking?.source_sck,
          data?.purchase?.checkout_origin?.sck,
        ],
        metadata: { source: 'webhook' },
      })
    } catch (attrErr) {
      console.error('[attribution] hotmart', transactionId, attrErr)
    }
  }
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
  // `findFirst` sem funil devolvia silenciosamente: boleto emitido antes da
  // primeira venda aprovada sumia sem deixar rastro.
  const funnel = await ensureFunnelWithStages(userId)
  const checkoutStage = pickStage(funnel.stages, 'Checkout')

  // Sem dedup, uma reentrega da Hotmart violava a constraint única e a rota
  // devolvia 500 — o que faz a Hotmart tentar de novo, em laço.
  if (await isDuplicateTransaction(funnel.id, transactionId, 'hotmart')) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: checkoutStage.id,
      eventType: 'hotmart_checkout_started',
      source: 'hotmart',
      transactionId: String(transactionId),
      timestamp: dataDeWebhook(data?.purchase?.order_date),
      metadata: JSON.stringify({
        buyerEmail: data?.buyer?.email,
        buyerName: data?.buyer?.name,
        productName: data?.product?.name,
        price: valorDaCompra(data?.purchase).valor,
        status: 'delayed',
      }),
    },
  })
}

/**
 * PURCHASE_OUT_OF_SHOPPING_CART — a pessoa chegou ao checkout e não concluiu.
 *
 * Este é o único evento que a Hotmart manda para abandono. Sem ele, o número
 * "Abandonados" do card era calculado como `checkouts - confirmados`, e como
 * `checkouts` só contava boletos pendentes, o resultado era sempre 0.
 *
 * O carrinho abandonado não tem `transaction` (não houve transação). A chave de
 * dedup passa a ser o e-mail do comprador, que é o que a Hotmart manda aqui.
 */
async function hotmartCartAbandoned(data: any, userId: string) {
  const funnel = await ensureFunnelWithStages(userId)
  const abandonedStage = pickStage(funnel.stages, 'Abandonado')

  const email = data?.buyer?.email || null
  const produto = data?.product?.id ?? data?.product?.ucode ?? 'sem-produto'
  // Sem transactionId, o par (e-mail, produto) é o que identifica a tentativa.
  const chave = email ? `cart:${produto}:${email}` : null
  if (chave && (await isDuplicateTransaction(funnel.id, chave, 'hotmart'))) return

  await prisma.funnelEvent.create({
    data: {
      funnelId: funnel.id,
      stageId: abandonedStage.id,
      eventType: 'hotmart_cart_abandoned',
      source: 'hotmart',
      transactionId: chave,
      timestamp: dataDeWebhook(data?.creation_date ?? data?.purchase?.order_date),
      metadata: JSON.stringify({
        buyerEmail: email,
        buyerName: data?.buyer?.name,
        productName: data?.product?.name,
        status: 'abandoned',
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
      source: 'kiwify',
      transactionId: String(orderId),
      timestamp: new Date(),
      metadata: JSON.stringify({
        amount: (body.amount || 0) / 100,
        buyerEmail: body.customer?.email || body.email,
        buyerName: body.customer?.name || body.name,
        productName: body.product?.name || body.product_name,
        status: rawStatus,
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: body.customer?.phone || body.customer?.mobile || body.phone || null,
    name: body.customer?.name || body.name || null,
    email: body.customer?.email || body.email || null,
  })

  // Atribuição: s1 (injetado pelo tracker no link do checkout) volta aqui.
  if (mapped.isPaid && orderId) {
    try {
      await attributeSale(userId, {
        platform: 'kiwify',
        transactionId: String(orderId),
        value: (body.amount || 0) / 100,
        product: body.product?.name || body.product_name || null,
        buyerEmail: body.customer?.email || body.email || null,
        buyerPhone: body.customer?.phone || body.customer?.mobile || body.phone || null,
        trackingParams: [
          body.TrackingParameters?.s1,
          body.TrackingParameters?.s2,
          body.TrackingParameters?.s3,
          body.tracking?.s1,
          body.s1,
        ],
        metadata: { source: 'webhook' },
      })
    } catch (attrErr) {
      console.error('[attribution] kiwify', orderId, attrErr)
    }
  }
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
      source: 'eduzz',
      transactionId: String(transactionId),
      timestamp: new Date(),
      metadata: JSON.stringify({
        amount: body.trans_value || body.amount || 0,
        buyerEmail: body.cus_email || body.email,
        buyerName: body.cus_name || body.name,
        productName: body.con_title || body.product_name,
        status: rawStatus,
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: body.cus_tel || body.cus_phone || body.phone || null,
    name: body.cus_name || body.name || null,
    email: body.cus_email || body.email || null,
  })

  // Atribuição: utm_content (injetado pelo tracker) volta nos campos utm.
  if (mapped.isPaid && transactionId) {
    try {
      await attributeSale(userId, {
        platform: 'eduzz',
        transactionId: String(transactionId),
        value: body.trans_value || body.amount || 0,
        product: body.con_title || body.product_name || null,
        buyerEmail: body.cus_email || body.email || null,
        buyerPhone: body.cus_tel || body.cus_phone || body.phone || null,
        trackingParams: [body.utm_content, body.trans_utm_content, body.tracker, body.tracker2, body.tracker3],
        metadata: { source: 'webhook' },
      })
    } catch (attrErr) {
      console.error('[attribution] eduzz', transactionId, attrErr)
    }
  }
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
      source: 'monetizze',
      transactionId: String(transactionId),
      timestamp: new Date(),
      metadata: JSON.stringify({
        amount: body.amount || body.price || 0,
        buyerEmail: body.buyer?.email || body.email,
        buyerName: body.buyer?.name || body.name,
        productName: body.product?.name || body.product_name,
        status: rawStatus,
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: body.buyer?.phone || body.comprador?.telefone || body.telefone || body.phone || null,
    name: body.buyer?.name || body.comprador?.nome || body.name || null,
    email: body.buyer?.email || body.comprador?.email || body.email || null,
  })

  // Atribuição: src (injetado pelo tracker) volta no tracking do webhook.
  if (mapped.isPaid && transactionId) {
    try {
      await attributeSale(userId, {
        platform: 'monetizze',
        transactionId: String(transactionId),
        value: body.amount || body.price || 0,
        product: body.product?.name || body.product_name || null,
        buyerEmail: body.buyer?.email || body.comprador?.email || body.email || null,
        buyerPhone: body.buyer?.phone || body.comprador?.telefone || body.telefone || body.phone || null,
        trackingParams: [body.tracking?.src, body.src, body.venda?.src, body.tracking?.utm_content],
        metadata: { source: 'webhook' },
      })
    } catch (attrErr) {
      console.error('[attribution] monetizze', transactionId, attrErr)
    }
  }
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
      source: 'perfect_pay',
      transactionId: String(transactionId),
      timestamp: new Date(),
      metadata: JSON.stringify({
        amount,
        buyerEmail,
        buyerName,
        productName: body.product?.name || body.product_name,
        status: rawStatus,
      }),
    },
  })

  await updateLeadStatusFromSale(userId, mapped, {
    phone: buyerPhone || null,
    name: buyerName || null,
    email: buyerEmail || null,
  })

  // Atribuição: src (injetado pelo tracker) volta no tracking do webhook.
  if (mapped.isPaid && transactionId) {
    try {
      await attributeSale(userId, {
        platform: 'perfect_pay',
        transactionId: String(transactionId),
        value: amount,
        product: body.product?.name || body.product_name || null,
        buyerEmail: buyerEmail || null,
        buyerPhone: buyerPhone || null,
        trackingParams: [body.tracking?.src, body.src, body.metadata?.src, body.tracking?.utm_content],
        metadata: { source: 'webhook' },
      })
    } catch (attrErr) {
      console.error('[attribution] perfect_pay', transactionId, attrErr)
    }
  }
}
