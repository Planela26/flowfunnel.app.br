import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret, checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { safeIntegration } from '@/lib/integration-sanitize'

// Conectar Meta Ads com Access Token de longa duração
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const rl = await checkRateLimit(`integrations:meta:post:${session.user.id}`, 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { accessToken, adAccountId, appId, appSecret } = await request.json()

    if (!accessToken || !adAccountId) {
      return NextResponse.json(
        { error: 'Access Token e Ad Account ID são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se já existe integração ativa
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'META_ADS',
        isActive: true,
      },
    })

    if (existingIntegration) {
      // Atualizar integração existente
      const updated = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          accessToken: encryptSecret(accessToken) || accessToken,
          config: JSON.stringify({
            adAccountId,
            appId,
            appSecret,
            connectedAt: new Date().toISOString(),
          }),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 dias
        },
      })
      await logAudit({
        action: 'integration.connect',
        result: 'success',
        userId: session.user.id,
        entityType: 'Integration',
        entityId: updated.id,
        request,
        metadata: { platform: 'META_ADS', mode: 'updated' },
      })
      return NextResponse.json({ success: true, integration: safeIntegration(updated), action: 'updated' })
    }

    // Criar nova integração
    const integration = await prisma.integration.create({
      data: {
        userId: session.user.id,
        platform: 'META_ADS',
        accessToken: encryptSecret(accessToken) || accessToken,
        config: JSON.stringify({
          adAccountId,
          appId,
          appSecret,
          connectedAt: new Date().toISOString(),
        }),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 dias
        isActive: true,
      },
    })

    await logAudit({
      action: 'integration.connect',
      result: 'success',
      userId: session.user.id,
      entityType: 'Integration',
      entityId: integration.id,
      request,
      metadata: { platform: 'META_ADS', mode: 'created' },
    })
    return NextResponse.json({ success: true, integration: safeIntegration(integration), action: 'created' })
  } catch (error) {
    console.error('Erro ao conectar Meta Ads:', error)
    return NextResponse.json(
      { error: 'Erro ao conectar Meta Ads' },
      { status: 500 }
    )
  }
}

// Verificar status da integração
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'META_ADS',
        isActive: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        connected: false,
        message: 'Meta Ads não conectado',
      })
    }

    const config = typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config

    // Verificar se o token expirou
    const isExpired = integration.expiresAt && new Date() > integration.expiresAt

    return NextResponse.json({
      connected: true,
      isExpired,
      adAccountId: config.adAccountId,
      connectedAt: config.connectedAt,
      expiresAt: integration.expiresAt,
    })
  } catch (error) {
    console.error('Erro ao verificar Meta Ads:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar integração' },
      { status: 500 }
    )
  }
}

// Desconectar Meta Ads
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const rl = await checkRateLimit(`integrations:meta:delete:${session.user.id}`, 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    await prisma.integration.updateMany({
      where: {
        userId: session.user.id,
        platform: 'META_ADS',
      },
      data: {
        isActive: false,
      },
    })

    await logAudit({
      action: 'integration.disconnect',
      result: 'success',
      userId: session.user.id,
      entityType: 'Integration',
      entityId: null,
      request,
      metadata: { platform: 'META_ADS', scope: 'all' },
    })

    return NextResponse.json({ success: true, message: 'Meta Ads desconectado' })
  } catch (error) {
    console.error('Erro ao desconectar Meta Ads:', error)
    return NextResponse.json(
      { error: 'Erro ao desconectar' },
      { status: 500 }
    )
  }
}
