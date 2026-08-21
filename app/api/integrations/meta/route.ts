import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret, checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { safeIntegration } from '@/lib/integration-sanitize'
import { assertCanCreateIntegration } from '@/lib/integration-gate'
import { exchangeForLongLivedToken } from '@/lib/facebook'

// Conectar Meta Ads com Access Token de longa duração
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const rl = await checkRateLimit(`integrations:meta:post:${session.user.id}`, 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })
    const gate = await assertCanCreateIntegration(request)
    if (gate) return gate

    const { accessToken, adAccountId, appId, appSecret } = await request.json()

    if (!accessToken || !adAccountId) {
      return NextResponse.json(
        { error: 'Access Token e Ad Account ID são obrigatórios' },
        { status: 400 }
      )
    }

    // ── Troca por token de longa duração ──────────────────────────────────────
    //
    // O token que se gera no Graph API Explorer — o caminho que o próprio
    // tutorial da tela ensina — vale ENTRE 1 E 2 HORAS. Antes, `appId` e
    // `appSecret` eram recebidos, guardados no config e nunca usados: a troca
    // existia em lib/facebook.ts e ninguém chamava. O token curto era salvo com
    // `expiresAt` cravado em 60 dias, e uma hora depois TUDO da Meta parava —
    // campanhas, métricas, snapshot, Sara — sem nenhuma pista do motivo, porque
    // o banco jurava que o token estava válido por dois meses.
    //
    // Com App ID e App Secret, a Meta devolve um token de ~60 dias. Sem eles,
    // não há o que trocar; nesse caso gravamos uma validade curta e HONESTA, em
    // vez de inventar uma data que não se sustenta.
    let tokenFinal: string = accessToken
    let expiraEm: Date
    let avisoDeValidade: string | null = null

    if (appId && appSecret) {
      const troca = await exchangeForLongLivedToken(appId, appSecret, accessToken)
      if (troca.success && troca.accessToken) {
        tokenFinal = troca.accessToken
        // `expires_in` vem em segundos. Quando a Meta não informa, 60 dias é o
        // padrão dela para token de longa duração.
        const segundos = typeof troca.expiresIn === 'number' && troca.expiresIn > 0
          ? troca.expiresIn
          : 60 * 24 * 60 * 60
        expiraEm = new Date(Date.now() + segundos * 1000)
      } else {
        // Troca recusada (App ID/Secret errados, app sem permissão). O token
        // curto ainda serve agora, mas dura pouco — e é isso que gravamos.
        expiraEm = new Date(Date.now() + 2 * 60 * 60 * 1000)
        avisoDeValidade =
          `Não foi possível estender a validade do token (${troca.error ?? 'motivo desconhecido'}). ` +
          'Ele vai expirar em cerca de 1 hora. Confira o App ID e o App Secret e conecte de novo.'
      }
    } else {
      expiraEm = new Date(Date.now() + 2 * 60 * 60 * 1000)
      avisoDeValidade =
        'Conectado sem App ID e App Secret: este token expira em cerca de 1 hora e as campanhas ' +
        'vão parar de atualizar. Para uma conexão duradoura, reconecte informando os dois.'
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
          accessToken: encryptSecret(tokenFinal) || tokenFinal,
          config: JSON.stringify({
            adAccountId,
            appId,
            appSecret,
            connectedAt: new Date().toISOString(),
            tokenDeLongaDuracao: !avisoDeValidade,
          }),
          expiresAt: expiraEm,
        },
      })
      await logAudit({
        action: 'integration.connect',
        result: 'success',
        userId: session.user.id,
        entityType: 'Integration',
        entityId: updated.id,
        request,
        metadata: { platform: 'META_ADS', mode: 'updated', longLived: !avisoDeValidade },
      })
      return NextResponse.json({
        success: true,
        integration: safeIntegration(updated),
        action: 'updated',
        expiresAt: expiraEm.toISOString(),
        warning: avisoDeValidade,
      })
    }

    // Criar nova integração
    const integration = await prisma.integration.create({
      data: {
        userId: session.user.id,
        platform: 'META_ADS',
        accessToken: encryptSecret(tokenFinal) || tokenFinal,
        config: JSON.stringify({
          adAccountId,
          appId,
          appSecret,
          connectedAt: new Date().toISOString(),
          tokenDeLongaDuracao: !avisoDeValidade,
        }),
        expiresAt: expiraEm,
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
      metadata: { platform: 'META_ADS', mode: 'created', longLived: !avisoDeValidade },
    })
    return NextResponse.json({
      success: true,
      integration: safeIntegration(integration),
      action: 'created',
      expiresAt: expiraEm.toISOString(),
      warning: avisoDeValidade,
    })
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
