import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { logWebhook } from '@/lib/webhook-logger'
import { sanitizeForLog, maskPhone } from '@/lib/sanitize'
import { getEffectivePlan } from '@/lib/trial'
import { isIngestionBlockedForUser } from '@/lib/account-status'

// Verifica a assinatura X-Hub-Signature-256 enviada pela Meta (HMAC-SHA256 do
// corpo bruto, usando o App Secret). Só é OBRIGATÓRIA quando WHATSAPP_APP_SECRET
// está configurado — mantém compatibilidade com integrações ainda sem o secret,
// mas fail-closed (rejeita) quando a assinatura está presente e não confere.
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET
  if (!secret) return true // sem secret configurado → não há como verificar
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const provided = signatureHeader.slice('sha256='.length)
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'))
  } catch {
    return false
  }
}

// SEGURANÇA: localiza a integração pelo phone_number_id do payload (multi-tenant).
// Sem isso, o webhook caía no "primeiro" usuário e vazava cross-tenant.
async function findIntegrationByPhoneNumberId(phoneNumberId?: string) {
  if (!phoneNumberId) return null
  const candidates = await prisma.integration.findMany({
    where: { platform: 'WHATSAPP', isActive: true },
  })
  for (const i of candidates) {
    try {
      const cfg = JSON.parse(i.config || '{}')
      if (cfg.phoneNumberId === phoneNumberId) return i
    } catch {}
  }
  return null
}

const PLAN_LIMITS: Record<string, number> = {
  FREE: 0, START: 1000, PRO: 3000, SCALE: -1,
}

// Meta webhook verification (GET)
// Meta sends: ?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('❌ WHATSAPP_VERIFY_TOKEN não configurado')
    return NextResponse.json({ error: 'Verify token not configured' }, { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WhatsApp webhook verificado com sucesso')
    return new NextResponse(challenge, { status: 200 })
  }

  console.error('❌ Falha na verificação do webhook WhatsApp')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Receive incoming WhatsApp messages (POST)
// Meta sends POST with the message payload
export async function POST(request: Request) {
  const startTime = Date.now()
  let body: any = null

  try {
    const rawBody = await request.text()

    // SEGURANÇA: valida a assinatura HMAC da Meta antes de processar qualquer coisa.
    const signature = request.headers.get('x-hub-signature-256')
    if (!verifyMetaSignature(rawBody, signature)) {
      console.warn('⛔ Assinatura X-Hub-Signature-256 inválida no webhook WhatsApp')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    body = JSON.parse(rawBody)
    console.log('📩 WhatsApp webhook recebido:', JSON.stringify(sanitizeForLog(body)))

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      return NextResponse.json({ success: true, message: 'No value in webhook' })
    }

    // SEGURANÇA: localiza a integração pelo phone_number_id (multi-tenant safe)
    const phoneNumberId = value.metadata?.phone_number_id
    const integration = await findIntegrationByPhoneNumberId(phoneNumberId)

    const userId = integration?.userId

    // Modo somente leitura: se o plano do tenant está vencido (teste grátis
    // expirado ou assinatura inativa), NÃO ingerimos NENHUM dado novo — nem
    // mensagens, nem atualizações de status, nem logs de webhook. Os dados
    // existentes continuam acessíveis na plataforma; apenas a entrada de novos
    // dados é interrompida até renovar a assinatura.
    const hasInbound = (value.messages?.length ?? 0) > 0 || (value.statuses?.length ?? 0) > 0
    if (userId && hasInbound && (await isIngestionBlockedForUser(userId))) {
      console.warn(`⛔ [account-status] plano vencido — ingestão WhatsApp pausada para ${userId}`)
      return NextResponse.json(
        { skipped: true, reason: 'subscription_expired' },
        { status: 200 }
      )
    }

    // Check plan usage limit before processing messages.
    // FONTE ÚNICA DE VERDADE: usamos a MESMA métrica exibida ao usuário em
    // GET /api/usage (contagem de webhookLog 'message' no mês). Antes havia uma
    // segunda contagem divergente (funnelEvent conversation_started) dentro de
    // processIncomingMessage — removida para o uso exibido e o uso aplicado
    // coincidirem (B18: padronização).
    if (userId && value.messages?.length > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, trialEndsAt: true, trialPlan: true },
      })
      const plan = getEffectivePlan(user ?? { plan: 'FREE' })
      const limit = PLAN_LIMITS[plan] ?? 0
      if (limit !== -1) {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const used = await prisma.webhookLog.count({
          where: { userId, platform: 'WHATSAPP', event: 'message', createdAt: { gte: startOfMonth } },
        })
        if (used >= limit) {
          console.warn(`⛔ Limite de conversas atingido para ${userId} (${used}/${limit}) — bloqueando webhook`)
          return NextResponse.json(
            { blocked: true, reason: 'plan_limit_reached', used, limit },
            { status: 429 }
          )
        }
      }
    }

    // Process incoming messages — só se houver integração casada (multi-tenant safe)
    if (value.messages?.length > 0 && integration) {
      for (const message of value.messages) {
        await processIncomingMessage(message, value.metadata, integration)
      }
    }

    // Process message status updates (delivered, read, failed)
    if (value.statuses?.length > 0) {
      for (const status of value.statuses) {
        console.log('📊 Status de mensagem:', {
          id: status.id,
          status: status.status,
          recipient: status.recipient_id,
        })
      }
    }

    // Log the webhook call
    const requestId = request.headers.get('X-Request-ID') || undefined
    if (userId) {
      const eventType = value.messages?.length > 0 ? 'message' : value.statuses?.length > 0 ? 'status' : 'unknown'
      await logWebhook({
        userId,
        platform: 'WHATSAPP',
        event: eventType,
        method: 'POST',
        endpoint: '/api/webhooks/whatsapp',
        payload: sanitizeForLog(body),
        response: { success: true },
        statusCode: 200,
        duration: Date.now() - startTime,
        requestId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao processar webhook WhatsApp:', error)

    // Try to log the error usando o phone_number_id do payload se possível
    try {
      const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
      const integration = await findIntegrationByPhoneNumberId(phoneNumberId)
      if (integration?.userId) {
        await logWebhook({
          userId: integration.userId,
          platform: 'WHATSAPP',
          event: 'error',
          method: 'POST',
          endpoint: '/api/webhooks/whatsapp',
          payload: sanitizeForLog(body),
          response: { error: error.message },
          statusCode: 500,
          duration: Date.now() - startTime,
          error: error.message,
        })
      }
    } catch (logErr) {
      console.error('Erro ao logar falha de webhook:', logErr)
    }

    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}

async function processIncomingMessage(message: any, metadata: any, integration: any) {
  try {
    const phoneNumberId = metadata?.phone_number_id
    const from = message.from
    const messageId = message.id
    const timestamp = parseInt(message.timestamp) * 1000
    const messageType = message.type
    const messageBody = message.text?.body || message.interactive?.button_reply?.title || ''

    // SEGURANÇA: não logar conteúdo de mensagem nem o telefone bruto
    console.log('📨 Mensagem recebida:', {
      from: maskPhone(from),
      messageType,
      phoneNumberId,
    })

    // Find or create a default funnel for this user
    let funnel = await prisma.funnel.findFirst({
      where: { userId: integration.userId },
      include: { stages: true },
    })

    if (!funnel) {
      funnel = await prisma.funnel.create({
        data: {
          userId: integration.userId,
          name: 'Funil Principal',
          description: 'Funil de vendas criado automaticamente',
          startDate: new Date(),
          stages: {
            create: [
              { name: 'Lead', order: 1 },
              { name: 'Qualificado', order: 2 },
              { name: 'Negociação', order: 3 },
              { name: 'Fechado', order: 4 },
            ],
          },
        },
        include: { stages: true },
      })
    }

    // Check for existing conversation from this number
    const existingEvent = await prisma.funnelEvent.findFirst({
      where: {
        funnelId: funnel.id,
        metadata: { contains: from },
      },
      orderBy: { timestamp: 'desc' },
    })

    if (existingEvent) {
      const currentMetadata = typeof existingEvent.metadata === 'string'
        ? JSON.parse(existingEvent.metadata)
        : existingEvent.metadata || {}

      const interactions = currentMetadata.interactions || []
      interactions.push({
        messageId,
        type: messageType,
        body: messageBody,
        timestamp: new Date(timestamp).toISOString(),
        direction: 'inbound',
      })

      await prisma.funnelEvent.update({
        where: { id: existingEvent.id },
        data: {
          metadata: JSON.stringify({
            ...currentMetadata,
            interactions,
            lastInteraction: new Date(timestamp).toISOString(),
            messageCount: interactions.length,
          }),
        },
      })

      console.log('✅ Conversa atualizada:', maskPhone(from))
    } else {
      // O limite de plano é aplicado UMA única vez na entrada do webhook
      // (contagem de mensagens em webhookLog → 429). Evitamos uma segunda
      // contagem divergente aqui (antes via funnelEvent) para não ter dupla
      // fonte de verdade sobre o uso.
      const leadStage = funnel.stages.find((s: any) => s.order === 1)

      await prisma.funnelEvent.create({
        data: {
          funnelId: funnel.id,
          stageId: leadStage!.id,
          eventType: 'whatsapp_conversation_started',
          timestamp: new Date(timestamp),
          metadata: JSON.stringify({
            whatsappNumber: from,
            phoneNumberId,
            interactions: [{
              messageId,
              type: messageType,
              body: messageBody,
              timestamp: new Date(timestamp).toISOString(),
              direction: 'inbound',
            }],
            firstContact: new Date(timestamp).toISOString(),
            lastInteraction: new Date(timestamp).toISOString(),
            messageCount: 1,
            source: 'whatsapp',
          }),
        },
      })

      console.log('✅ Nova conversa criada:', maskPhone(from))
    }
  } catch (error) {
    console.error('Erro ao processar mensagem recebida:', error)
    throw error
  }
}
