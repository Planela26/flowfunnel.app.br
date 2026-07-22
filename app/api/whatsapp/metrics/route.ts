import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey, CacheTTL } from '@/lib/cache'

// Buscar métricas do WhatsApp para o dashboard
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integrationId')

    // Resolver phoneNumberId do filtro (se houver)
    let filterPhoneNumberId: string | null = null
    if (integrationId) {
      const integration = await prisma.integration.findFirst({
        where: { id: integrationId, userId: session.user.id },
      })
      if (integration) {
        try {
          const c = JSON.parse(integration.config || '{}')
          filterPhoneNumberId = c.phoneNumberId || null
        } catch {}
      }
    }

    // Verificar cache (chave inclui o filtro)
    const cacheKey = generateCacheKey(session.user.id, `whatsapp-metrics-${integrationId || 'all'}`)
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Buscar funil do usuário
    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
      include: { stages: true },
    })

    if (!funnel) {
      return NextResponse.json({
        conversasIniciadas: 0,
        conversasNaoTerminadas: 0,
        leadsQualificados: 0,
        mediaConversasDia: 0,
        taxaResposta: '0%',
        tempoMedioResposta: '0min',
      })
    }

    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Buscar todas as conversas (filtro por phoneNumberId feito em memória)
    const rawConversations = await prisma.funnelEvent.findMany({
      where: {
        funnelId: funnel.id,
        eventType: 'whatsapp_conversation_started',
        timestamp: { gte: last30Days },
      },
    })

    // Filtrar por phoneNumberId do workspace (se especificado)
    const allConversations = filterPhoneNumberId
      ? rawConversations.filter((ev) => {
          try {
            const m = JSON.parse(ev.metadata || '{}')
            return m.phoneNumberId === filterPhoneNumberId || m.from_phone_number_id === filterPhoneNumberId
          } catch { return false }
        })
      : rawConversations

    const conversasIniciadas = allConversations.length
    const conversasUltimos7Dias = allConversations.filter((ev) => ev.timestamp >= last7Days).length
    const mediaConversasDia = Math.round(conversasUltimos7Dias / 7)

    // Analisar conversas
    let conversasNaoTerminadas = 0
    let leadsQualificados = 0
    let totalResponseTimes = 0
    let responsesCount = 0

    for (const conversation of allConversations) {
      let metadata: Record<string, any> = {}
      try {
        metadata = typeof conversation.metadata === 'string'
          ? JSON.parse(conversation.metadata)
          : (conversation.metadata as unknown as Record<string, any>) || {}
      } catch {
        metadata = {}
      }

      const interactions = metadata.interactions || []
      const hasConversationEnd = interactions.some((interaction: any) => {
        const text = String(interaction.body || '').toLowerCase()
        const category = String(interaction.category || '').toLowerCase()
        const type = String(interaction.type || '').toLowerCase()
        return (
          category === 'conversation_end' ||
          category === 'end_conversation' ||
          type === 'checkout' ||
          type === 'link' ||
          text.includes('checkout') ||
          text.includes('link') ||
          text.includes('final') ||
          text.includes('finaliz')
        )
      })
      
      // Conta conversas não terminadas: sem evento de fim + mais de 12h sem atividade
      if (!hasConversationEnd && metadata.lastInteraction) {
        const lastInteractionDate = new Date(metadata.lastInteraction)
        const hoursSinceLastInteraction = (now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceLastInteraction > 12 && interactions.length < 5) {
          conversasNaoTerminadas++
        }
      }

      // Conta leads qualificados (conversas com mais de 3 interações)
      if (interactions.length >= 3) {
        leadsQualificados++
      }

      // Calcula tempo médio de resposta
      for (let i = 1; i < interactions.length; i++) {
        const prev = interactions[i - 1]
        const curr = interactions[i]
        
        // Se anterior foi do cliente (inbound) e atual foi nossa resposta (outbound)
        if (prev.direction === 'inbound' && curr.direction === 'outbound') {
          const prevTime = new Date(prev.timestamp).getTime()
          const currTime = new Date(curr.timestamp).getTime()
          const responseTime = (currTime - prevTime) / (1000 * 60) // em minutos
          
          totalResponseTimes += responseTime
          responsesCount++
        }
      }
    }

    const tempoMedioResposta = responsesCount > 0 
      ? Math.round(totalResponseTimes / responsesCount) 
      : 0

    const taxaResposta = conversasIniciadas > 0
      ? Math.round((responsesCount / conversasIniciadas) * 100)
      : 0

    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    const plan = userRecord?.plan || 'FREE'
    const monthlyLimit = plan === 'START' ? 1000 : plan === 'PRO' ? 3000 : null

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const conversasEsteMes = await prisma.funnelEvent.count({
      where: {
        funnelId: funnel.id,
        eventType: 'whatsapp_conversation_started',
        timestamp: { gte: startOfMonth },
      },
    })

    const limitWarning = monthlyLimit !== null && conversasEsteMes >= monthlyLimit * 0.9
    const limitExceeded = monthlyLimit !== null && conversasEsteMes >= monthlyLimit

    let totalMessages = 0
    for (const conv of allConversations) {
      try {
        const m = JSON.parse(conv.metadata || '{}')
        totalMessages += Array.isArray(m.interactions) ? m.interactions.length : 0
      } catch {}
    }

    const result = {
      conversasIniciadas,
      conversasNaoTerminadas,
      leadsQualificados,
      mediaConversasDia,
      taxaResposta: `${taxaResposta}%`,
      tempoMedioResposta: `${tempoMedioResposta}min`,
      conversasEsteMes,
      limiteConversasMes: monthlyLimit,
      limitWarning,
      limitExceeded,
      plan,
      data: {
        conversations: conversasIniciadas,
        messages: totalMessages,
        responseRate: taxaResposta,
      },
    }

    // Salvar no cache por 2 minutos
    cache.set(cacheKey, result, CacheTTL.MEDIUM)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar métricas WhatsApp:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    )
  }
}
