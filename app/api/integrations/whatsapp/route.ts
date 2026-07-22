import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret, checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { safeIntegration } from '@/lib/integration-sanitize'
import { getMaxWhatsappNumbers, normalizePlan } from '@/lib/plans'

// Conectar número WhatsApp (POST) — suporta múltiplos números
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const rl = await checkRateLimit(`integrations:whatsapp:post:${session.user.id}`, 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { accessToken, phoneNumberId, businessAccountId, webhookUrl, nickname, connectionType } = await request.json()

    if (!accessToken || !phoneNumberId || !businessAccountId) {
      return NextResponse.json(
        { error: 'accessToken, phoneNumberId e businessAccountId são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar limite do plano (centralizado em lib/plans.ts)
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true } })
    const plan = normalizePlan(user?.plan)
    const limit = getMaxWhatsappNumbers(plan)

    // Verificar se já existe um número com esse phoneNumberId
    const allIntegrations = await prisma.integration.findMany({
      where: { userId: session.user.id, platform: 'WHATSAPP' },
    })

    const existing = allIntegrations.find((i) => {
      try {
        const c = JSON.parse(i.config || '{}')
        return c.phoneNumberId === phoneNumberId
      } catch { return false }
    })

    if (existing) {
      // Atualiza o existente
      const updated = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          accessToken: encryptSecret(accessToken) || accessToken,
          nickname: nickname || existing.nickname,
          config: JSON.stringify({
            phoneNumberId,
            businessAccountId,
            webhookUrl: webhookUrl || '',
            connectedAt: new Date().toISOString(),
            connectionType: connectionType || 'BUSINESS_API',
          }),
          isActive: true,
          updatedAt: new Date(),
        },
      })
      await logAudit({
        action: 'integration.connect',
        result: 'success',
        userId: session.user.id,
        entityType: 'Integration',
        entityId: updated.id,
        request,
        metadata: { platform: 'WHATSAPP', mode: 'updated' },
      })
      return NextResponse.json({ success: true, integration: safeIntegration(updated), action: 'updated' })
    }

    // Verificar se atingiu o limite do plano (limit === -1 significa ilimitado)
    if (limit !== -1 && allIntegrations.length >= limit) {
      return NextResponse.json(
        {
          error: 'plan_limit_reached',
          resource: 'whatsapp_numbers',
          currentPlan: plan,
          limit,
          current: allIntegrations.length,
          message: `Seu plano ${plan} permite até ${limit} número(s) de WhatsApp. Faça upgrade para adicionar mais.`,
          upgradeUrl: '/billing',
        },
        { status: 402 }
      )
    }

    // Novo número — se for o primeiro, marcar como padrão
    const hasAny = allIntegrations.length === 0
    const integration = await prisma.integration.create({
      data: {
        userId: session.user.id,
        platform: 'WHATSAPP',
        nickname: nickname || `Número ${allIntegrations.length + 1}`,
        accessToken: encryptSecret(accessToken) || accessToken,
        config: JSON.stringify({
          phoneNumberId,
          businessAccountId,
          webhookUrl: webhookUrl || '',
          connectedAt: new Date().toISOString(),
          connectionType: connectionType || 'BUSINESS_API',
        }),
        isActive: true,
        isDefault: hasAny,
      },
    })

    await logAudit({
      action: 'integration.connect',
      result: 'success',
      userId: session.user.id,
      entityType: 'Integration',
      entityId: integration.id,
      request,
      metadata: { platform: 'WHATSAPP', mode: 'created' },
    })
    return NextResponse.json({ success: true, integration: safeIntegration(integration), action: 'created' })
  } catch (error) {
    console.error('Erro ao conectar WhatsApp:', error)
    return NextResponse.json({ error: 'Erro ao conectar WhatsApp' }, { status: 500 })
  }
}

// Buscar todos os números WhatsApp conectados (GET)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const rl = await checkRateLimit(`integrations:whatsapp:get:${session.user.id}`, 60, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const integrations = await prisma.integration.findMany({
      where: { userId: session.user.id, platform: 'WHATSAPP', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })

    if (integrations.length === 0) {
      return NextResponse.json({ connected: false, numbers: [], message: 'Nenhum número conectado' })
    }

    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    })

    const now = new Date()
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const allConvs = funnel
      ? await prisma.funnelEvent.findMany({
          where: {
            funnelId: funnel.id,
            eventType: 'whatsapp_conversation_started',
            timestamp: { gte: last30 },
          },
          select: { metadata: true, timestamp: true },
        })
      : []

    const numbers = integrations.map((i) => {
      let config: Record<string, any> = {}
      try { config = JSON.parse(i.config || '{}') } catch {}
      const phoneNumberId = config.phoneNumberId

      const convs = phoneNumberId
        ? allConvs.filter((c) => {
            try {
              const m = JSON.parse(c.metadata || '{}')
              return m.phoneNumberId === phoneNumberId || m.from_phone_number_id === phoneNumberId
            } catch { return false }
          })
        : []

      let abandonadas = 0
      let qualificadas = 0
      let totalMessages = 0
      let respCount = 0
      let respTotal = 0
      for (const c of convs) {
        try {
          const m = JSON.parse(c.metadata || '{}')
          const interactions = Array.isArray(m.interactions) ? m.interactions : []
          totalMessages += interactions.length
          if (interactions.length >= 3) qualificadas++
          if (m.lastInteraction) {
            const hours = (now.getTime() - new Date(m.lastInteraction).getTime()) / 3600000
            if (hours > 24 && interactions.length < 5) abandonadas++
          }
          for (let k = 1; k < interactions.length; k++) {
            const prev = interactions[k - 1]
            const curr = interactions[k]
            if (prev?.direction === 'inbound' && curr?.direction === 'outbound') {
              respTotal += (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000
              respCount++
            }
          }
        } catch {}
      }

      const last7Count = convs.filter((c) => c.timestamp >= last7).length
      const taxaResposta = convs.length > 0 ? Math.round((respCount / convs.length) * 100) : 0

      return {
        id: i.id,
        nickname: i.nickname || `Número ${i.id.slice(-4)}`,
        phoneNumberId,
        businessAccountId: config.businessAccountId,
        connectedAt: config.connectedAt,
        connectionType: config.connectionType || 'BUSINESS_API',
        isDefault: i.isDefault,
        webhookEndpoint: '/api/webhooks/whatsapp',
        stats: {
          conversasIniciadas: convs.length,
          conversasAbandonadas: abandonadas,
          leadsQualificados: qualificadas,
          mediaPorDia: Math.round(last7Count / 7),
          totalMensagens: totalMessages,
          taxaResposta: `${taxaResposta}%`,
          tempoMedioResposta: respCount > 0 ? `${Math.round(respTotal / respCount)}min` : '—',
        },
      }
    })

    return NextResponse.json({ connected: true, numbers })
  } catch (error) {
    console.error('Erro ao buscar WhatsApp:', error)
    return NextResponse.json({ error: 'Erro ao verificar integração' }, { status: 500 })
  }
}

// Desconectar um número específico ou todos (DELETE)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const rl = await checkRateLimit(`integrations:whatsapp:delete:${session.user.id}`, 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('id')

    if (integrationId) {
      await prisma.integration.deleteMany({
        where: { id: integrationId, userId: session.user.id },
      })
    } else {
      await prisma.integration.deleteMany({
        where: { userId: session.user.id, platform: 'WHATSAPP' },
      })
    }

    await logAudit({
      action: 'integration.disconnect',
      result: 'success',
      userId: session.user.id,
      entityType: 'Integration',
      entityId: integrationId || null,
      request,
      metadata: { platform: 'WHATSAPP', scope: integrationId ? 'single' : 'all' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao desconectar WhatsApp:', error)
    return NextResponse.json({ error: 'Erro ao desconectar WhatsApp' }, { status: 500 })
  }
}

// Definir número padrão (PATCH)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const rl = await checkRateLimit(`integrations:whatsapp:patch:${session.user.id}`, 30, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { integrationId } = await request.json()
    if (!integrationId) {
      return NextResponse.json({ error: 'integrationId é obrigatório' }, { status: 400 })
    }

    // SEGURANÇA (IDOR): confirma que a integração pertence ao usuário antes de
    // alterar qualquer coisa. Sem isto, um usuário poderia marcar como padrão a
    // integração de outra conta passando um integrationId arbitrário.
    const owned = await prisma.integration.findFirst({
      where: { id: integrationId, userId: session.user.id, platform: 'WHATSAPP' },
      select: { id: true },
    })
    if (!owned) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })
    }

    // Remove padrão de todos
    await prisma.integration.updateMany({
      where: { userId: session.user.id, platform: 'WHATSAPP' },
      data: { isDefault: false },
    })

    // Marca o escolhido como padrão (escopo por userId — defesa redundante)
    await prisma.integration.updateMany({
      where: { id: integrationId, userId: session.user.id, platform: 'WHATSAPP' },
      data: { isDefault: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao definir padrão' }, { status: 500 })
  }
}
