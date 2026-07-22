import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureWebhookToken, buildWebhookUrl } from '@/lib/webhook-tenant'

// Connect Hotmart integration (POST)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { hotmartId, webhookToken, email } = await request.json()

    if (!hotmartId || !webhookToken) {
      return NextResponse.json(
        { error: 'Hotmart ID e Webhook Token são obrigatórios' },
        { status: 400 }
      )
    }

    const existingIntegration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'HOTMART',
        isActive: true,
      },
    })

    if (existingIntegration) {
      const updated = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          accessToken: webhookToken,
          config: JSON.stringify({
            hotmartId,
            email,
            connectedAt: new Date().toISOString(),
          }),
        },
      })
      const tk = await ensureWebhookToken(updated.id)
      return NextResponse.json({
        success: true,
        action: 'updated',
        webhookUrl: buildWebhookUrl('HOTMART', tk),
      })
    }

    const integration = await prisma.integration.create({
      data: {
        userId: session.user.id,
        platform: 'HOTMART',
        accessToken: webhookToken,
        config: JSON.stringify({
          hotmartId,
          email,
          connectedAt: new Date().toISOString(),
        }),
        isActive: true,
      },
    })
    const tk = await ensureWebhookToken(integration.id)

    return NextResponse.json({
      success: true,
      action: 'created',
      webhookUrl: buildWebhookUrl('HOTMART', tk),
    })
  } catch (error) {
    console.error('Erro ao conectar Hotmart:', error)
    return NextResponse.json({ error: 'Erro ao conectar Hotmart' }, { status: 500 })
  }
}

// Check Hotmart integration status (GET)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'HOTMART',
        isActive: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        connected: false,
        message: 'Hotmart não conectado',
      })
    }

    let config: Record<string, any> = {}
    try {
      config = typeof integration.config === 'string'
        ? JSON.parse(integration.config)
        : (integration.config as unknown as Record<string, any>) || {}
    } catch { config = {} }

    const tk = await ensureWebhookToken(integration.id)
    return NextResponse.json({
      connected: true,
      hotmartId: config.hotmartId,
      email: config.email,
      connectedAt: config.connectedAt,
      // Tokenized URL — multi-tenant safe. Configure this in the Hotmart Dashboard:
      webhookEndpoint: `/api/webhooks/hotmart/${tk}`,
      webhookUrl: buildWebhookUrl('HOTMART', tk),
      legacyEndpoint: '/api/webhooks/hotmart',
    })
  } catch (error) {
    console.error('Erro ao verificar Hotmart:', error)
    return NextResponse.json({ error: 'Erro ao verificar integração' }, { status: 500 })
  }
}

// Disconnect Hotmart integration (DELETE)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const deleted = await prisma.integration.deleteMany({
      where: {
        userId: session.user.id,
        platform: 'HOTMART',
      },
    })

    return NextResponse.json({ success: true, deleted: deleted.count })
  } catch (error) {
    console.error('Erro ao desconectar Hotmart:', error)
    return NextResponse.json({ error: 'Erro ao desconectar Hotmart' }, { status: 500 })
  }
}
