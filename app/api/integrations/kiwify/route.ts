import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureWebhookToken, buildWebhookUrl } from '@/lib/webhook-tenant'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { storeId, secretKey } = await request.json()

    if (!storeId || !secretKey) {
      return NextResponse.json(
        { error: 'Store ID e Secret Key são obrigatórios' },
        { status: 400 }
      )
    }

    const existing = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'KIWIFY', isActive: true },
    })

    if (existing) {
      const updated = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          accessToken: secretKey,
          config: JSON.stringify({ storeId, connectedAt: new Date().toISOString() }),
        },
      })
      const tk = await ensureWebhookToken(updated.id)
      return NextResponse.json({ success: true, action: 'updated', webhookUrl: buildWebhookUrl('KIWIFY', tk) })
    }

    const integration = await prisma.integration.create({
      data: {
        userId: session.user.id,
        platform: 'KIWIFY',
        accessToken: secretKey,
        config: JSON.stringify({ storeId, connectedAt: new Date().toISOString() }),
        isActive: true,
      },
    })
    const tk = await ensureWebhookToken(integration.id)

    return NextResponse.json({ success: true, action: 'created', webhookUrl: buildWebhookUrl('KIWIFY', tk) })
  } catch (error) {
    console.error('Erro ao conectar Kiwify:', error)
    return NextResponse.json({ error: 'Erro ao conectar Kiwify' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const integration = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'KIWIFY', isActive: true },
    })

    if (!integration) {
      return NextResponse.json({ connected: false, message: 'Kiwify não conectada' })
    }

    let config: Record<string, any> = {}
    try { config = JSON.parse(integration.config || '{}') } catch { config = {} }

    const tk = await ensureWebhookToken(integration.id)
    return NextResponse.json({
      connected: true,
      storeId: config.storeId,
      connectedAt: config.connectedAt,
      webhookEndpoint: `/api/webhooks/kiwify/${tk}`,
      webhookUrl: buildWebhookUrl('KIWIFY', tk),
      legacyEndpoint: '/api/webhooks/kiwify',
    })
  } catch (error) {
    console.error('Erro ao verificar Kiwify:', error)
    return NextResponse.json({ error: 'Erro ao verificar integração' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const deleted = await prisma.integration.deleteMany({
      where: { userId: session.user.id, platform: 'KIWIFY' },
    })

    return NextResponse.json({ success: true, deleted: deleted.count })
  } catch (error) {
    console.error('Erro ao desconectar Kiwify:', error)
    return NextResponse.json({ error: 'Erro ao desconectar Kiwify' }, { status: 500 })
  }
}
