import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { regenerateWebhookToken, buildWebhookUrl } from '@/lib/webhook-tenant'
import { logAudit } from '@/lib/audit'

// Regenera o token de webhook de uma integração.
// Body: { platform: string }
// Retorna: { success: true, webhookUrl: string, webhookEndpoint: string }
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { platform } = await request.json()
    if (!platform) {
      return NextResponse.json({ error: 'Plataforma obrigatória' }, { status: 400 })
    }

    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: platform.toUpperCase(),
        isActive: true,
      },
      select: { id: true, platform: true, webhookToken: true },
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integração não encontrada' },
        { status: 404 },
      )
    }

    const newToken = await regenerateWebhookToken(integration.id)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const webhookUrl = buildWebhookUrl(integration.platform, newToken, baseUrl)

    await logAudit({
      action: 'integration.webhook_token_regenerated',
      result: 'success',
      userId: session.user.id,
      entityType: 'Integration',
      entityId: integration.id,
      request,
      metadata: { platform: integration.platform },
    })

    return NextResponse.json({
      success: true,
      webhookUrl,
      webhookEndpoint: `/api/webhooks/${integration.platform.toLowerCase().replace(/_/g, '-')}/${newToken}`,
    })
  } catch (error) {
    console.error('Erro ao regenerar token de webhook:', error)
    return NextResponse.json(
      { error: 'Erro ao regenerar token' },
      { status: 500 },
    )
  }
}
