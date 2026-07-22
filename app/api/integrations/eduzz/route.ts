import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureWebhookToken, buildWebhookUrl } from '@/lib/webhook-tenant'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { email, publicKey } = await request.json()
    if (!email || !publicKey) {
      return NextResponse.json({ error: 'E-mail e Public Key são obrigatórios' }, { status: 400 })
    }

    const existing = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'EDUZZ', isActive: true },
    })

    const data = {
      accessToken: publicKey,
      config: JSON.stringify({ email, connectedAt: new Date().toISOString() }),
    }

    if (existing) {
      const updated = await prisma.integration.update({ where: { id: existing.id }, data })
      const tk = await ensureWebhookToken(updated.id)
      return NextResponse.json({ success: true, action: 'updated', webhookUrl: buildWebhookUrl('EDUZZ', tk) })
    }

    const integration = await prisma.integration.create({
      data: { userId: session.user.id, platform: 'EDUZZ', isActive: true, ...data },
    })
    const tk = await ensureWebhookToken(integration.id)
    return NextResponse.json({ success: true, action: 'created', webhookUrl: buildWebhookUrl('EDUZZ', tk) })
  } catch (error) {
    console.error('Erro ao conectar Eduzz:', error)
    return NextResponse.json({ error: 'Erro ao conectar Eduzz' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const integration = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'EDUZZ', isActive: true },
    })

    if (!integration) return NextResponse.json({ connected: false })

    let config: Record<string, any> = {}
    try { config = JSON.parse(integration.config || '{}') } catch {}

    const tk = await ensureWebhookToken(integration.id)
    return NextResponse.json({
      connected: true,
      email: config.email,
      connectedAt: config.connectedAt,
      webhookEndpoint: `/api/webhooks/eduzz/${tk}`,
      webhookUrl: buildWebhookUrl('EDUZZ', tk),
      legacyEndpoint: '/api/webhooks/eduzz',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao verificar integração' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const deleted = await prisma.integration.deleteMany({ where: { userId: session.user.id, platform: 'EDUZZ' } })
    return NextResponse.json({ success: true, deleted: deleted.count })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao desconectar Eduzz' }, { status: 500 })
  }
}
