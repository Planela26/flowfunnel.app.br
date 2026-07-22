import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureWebhookToken, buildWebhookUrl } from '@/lib/webhook-tenant'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { apiKey, webhookToken } = await request.json()
    if (!apiKey) return NextResponse.json({ error: 'API Key é obrigatória' }, { status: 400 })

    const existing = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'PERFECT_PAY', isActive: true },
    })

    const data = {
      userId: session.user.id,
      platform: 'PERFECT_PAY',
      accessToken: apiKey,
      config: JSON.stringify({ webhookToken }),
      isActive: true,
    }

    let id: string
    if (existing) {
      const updated = await prisma.integration.update({ where: { id: existing.id }, data })
      id = updated.id
    } else {
      const created = await prisma.integration.create({ data })
      id = created.id
    }
    const tk = await ensureWebhookToken(id)

    return NextResponse.json({ ok: true, webhookUrl: buildWebhookUrl('PERFECT_PAY', tk) })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar integração' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const integration = await prisma.integration.findFirst({
      where: { userId: session.user.id, platform: 'PERFECT_PAY', isActive: true },
    })
    if (!integration) return NextResponse.json({ connected: false })

    const tk = await ensureWebhookToken(integration.id)
    return NextResponse.json({
      connected: true,
      webhookEndpoint: `/api/webhooks/perfect-pay/${tk}`,
      webhookUrl: buildWebhookUrl('PERFECT_PAY', tk),
      legacyEndpoint: '/api/webhooks/perfect-pay',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao verificar integração' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await prisma.integration.deleteMany({
    where: { userId: session.user.id, platform: 'PERFECT_PAY' },
  })

  return NextResponse.json({ ok: true })
}
