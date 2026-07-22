import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { decryptSecret } from '@/lib/security-utils'

// Enviar mensagem para um lead
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { to, message, eventId } = await request.json()

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Número de telefone e mensagem são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar integração WhatsApp ativa do usuário
    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'WHATSAPP',
        isActive: true,
      },
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'WhatsApp não conectado. Configure em /whatsapp-connect' },
        { status: 400 }
      )
    }

    const config = typeof integration.config === 'string' 
      ? JSON.parse(integration.config) 
      : integration.config

    // Enviar mensagem via WhatsApp API
    const result = await sendWhatsAppMessage({
      phoneNumberId: config.phoneNumberId,
      accessToken: decryptSecret(integration.accessToken) || integration.accessToken,
      to,
      message,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erro ao enviar mensagem' },
        { status: 500 }
      )
    }

    // Atualizar evento no banco se fornecido
    if (eventId) {
      const event = await prisma.funnelEvent.findUnique({
        where: { id: eventId },
      })

      if (event) {
        const currentMetadata = typeof event.metadata === 'string'
          ? JSON.parse(event.metadata)
          : event.metadata

        const interactions = currentMetadata.interactions || []
        interactions.push({
          messageId: result.messageId,
          type: 'text',
          body: message,
          timestamp: new Date().toISOString(),
          direction: 'outbound',
          category: 'conversation_end',
        })

        await prisma.funnelEvent.update({
          where: { id: eventId },
          data: {
            metadata: JSON.stringify({
              ...currentMetadata,
              interactions,
              lastInteraction: new Date().toISOString(),
              messageCount: interactions.length,
            }),
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Mensagem enviada com sucesso',
    })
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error)
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem' },
      { status: 500 }
    )
  }
}

// Buscar conversas do WhatsApp
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Buscar funil do usuário
    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
    })

    if (!funnel) {
      return NextResponse.json({ conversations: [], total: 0 })
    }

    // Buscar eventos do WhatsApp
    const events = await prisma.funnelEvent.findMany({
      where: {
        funnelId: funnel.id,
        eventType: 'whatsapp_conversation_started',
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        stage: true,
      },
    })

    const total = await prisma.funnelEvent.count({
      where: {
        funnelId: funnel.id,
        eventType: 'whatsapp_conversation_started',
      },
    })

    const conversations = events.map((event: any) => {
      const metadata = typeof event.metadata === 'string'
        ? JSON.parse(event.metadata)
        : event.metadata

      return {
        id: event.id,
        whatsappNumber: metadata.whatsappNumber,
        messageCount: metadata.messageCount || 0,
        lastInteraction: metadata.lastInteraction,
        firstContact: metadata.firstContact,
        interactions: metadata.interactions || [],
        stage: event.stage.name,
        timestamp: event.timestamp,
      }
    })

    return NextResponse.json({
      conversations,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Erro ao buscar conversas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar conversas' },
      { status: 500 }
    )
  }
}
