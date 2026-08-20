import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withTenantTx } from '@/lib/prisma'
import { checkRateLimit, decryptSecret } from '@/lib/security-utils'

// Buscar campanhas do Facebook Ads
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const forceSync = searchParams.get('sync') === 'true'

    // Esta rota faz upsert e chama a Graph API quando sincroniza — é um GET com
    // efeito colateral e amplificação para serviço externo. O limite contém
    // tanto abuso direto quanto disparo via navegação cross-site (sameSite=lax
    // envia cookie em navegação de topo).
    if (forceSync) {
      const rl = await checkRateLimit(`campaigns:sync:${session.user.id}`, 10, 60_000)
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Muitas sincronizações seguidas. Aguarde um momento.' },
          { status: 429 },
        )
      }
    }

    // Buscar integração ativa
    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        platform: 'META_ADS',
        isActive: true,
      },
    })

    if (!integration) {
      return NextResponse.json({
        campaigns: [],
        message: 'Meta Ads não conectado',
      })
    }

    const config = typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config

    // Verificar se precisa sincronizar
    const lastSync = await prisma.campaign.findFirst({
      where: {
        userId: session.user.id,
        platform: 'META_ADS',
      },
      orderBy: { lastSyncedAt: 'desc' },
    })

    const shouldSync = forceSync || !lastSync ||
      (Date.now() - new Date(lastSync.lastSyncedAt).getTime() > 3600000) // 1 hora

    // Falha de sincronização precisa CHEGAR na resposta.
    //
    // Antes ela só ia para o `console.error` do servidor e a rota devolvia a
    // lista do banco — vazia, com HTTP 200. Token expirado, permissão revogada
    // ou conta desvinculada apareciam na tela exatamente como "você não tem
    // campanhas", e não havia o que o usuário pudesse fazer a respeito porque
    // nada indicava que algo tinha falhado.
    let erroDeSync: string | null = null

    if (shouldSync) {
      // Buscar campanhas da API do Facebook
      try {
        const accountId = config.adAccountId.startsWith('act_') 
          ? config.adAccountId 
          : `act_${config.adAccountId}`

        const response = await fetch(
          `https://graph.facebook.com/v18.0/${accountId}/campaigns?` +
          `fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,spend`,
          // Esta rota monta o fetch por conta própria, sem passar pelo
          // `graphFetch` de lib/facebook.ts — então precisa descriptografar
          // aqui. `Integration.accessToken` vale `enc:...` no banco; mandar a
          // coluna crua rende 401 da Meta.
          { headers: { Authorization: `Bearer ${decryptSecret(integration.accessToken) || integration.accessToken}` } }
        )

        if (!response.ok) {
          const error = await response.json().catch(() => null)
          console.error('Erro ao buscar campanhas:', error)
          erroDeSync = error?.error?.message || `A Meta respondeu ${response.status}.`
        } else {
          const data = await response.json()

          // Atualizar/criar campanhas no banco
          for (const campaign of data.data || []) {
            await prisma.campaign.upsert({
              where: {
                userId_platform_campaignId: {
                  userId: session.user.id,
                  platform: 'META_ADS',
                  campaignId: campaign.id,
                },
              },
              update: {
                name: campaign.name,
                status: campaign.status,
                objective: campaign.objective,
                budget: parseFloat(campaign.daily_budget || campaign.lifetime_budget || '0') / 100,
                spend: parseFloat(campaign.spend || '0'),
                startDate: campaign.start_time ? new Date(campaign.start_time) : null,
                endDate: campaign.stop_time ? new Date(campaign.stop_time) : null,
                lastSyncedAt: new Date(),
              },
              create: {
                userId: session.user.id,
                platform: 'META_ADS',
                campaignId: campaign.id,
                name: campaign.name,
                status: campaign.status,
                objective: campaign.objective,
                budget: parseFloat(campaign.daily_budget || campaign.lifetime_budget || '0') / 100,
                spend: parseFloat(campaign.spend || '0'),
                startDate: campaign.start_time ? new Date(campaign.start_time) : null,
                endDate: campaign.stop_time ? new Date(campaign.stop_time) : null,
                isActive: campaign.status === 'ACTIVE',
                lastSyncedAt: new Date(),
              },
            })
          }

          // Se não há campanha padrão, definir a primeira ativa
          const defaultCampaign = await prisma.campaign.findFirst({
            where: {
              userId: session.user.id,
              platform: 'META_ADS',
              isDefault: true,
            },
          })

          if (!defaultCampaign) {
            const firstActive = await prisma.campaign.findFirst({
              where: {
                userId: session.user.id,
                platform: 'META_ADS',
                isActive: true,
              },
            })

            if (firstActive) {
              await prisma.campaign.update({
                where: { id: firstActive.id },
                data: { isDefault: true },
              })
            }
          }
        }
      } catch (error) {
        console.error('Erro ao sincronizar campanhas:', error)
        erroDeSync = error instanceof Error ? error.message : 'Falha ao falar com a Meta.'
      }
    }

    // Buscar campanhas do banco
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId: session.user.id,
        platform: 'META_ADS',
      },
      orderBy: [
        { isDefault: 'desc' },
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    })

    // Campanhas em cache continuam sendo devolvidas mesmo com sync falho — o
    // que já foi sincronizado ontem segue valendo hoje. O aviso vai junto, para
    // a tela poder dizer que os números podem estar desatualizados em vez de
    // apresentar dados velhos como se fossem de agora.
    return NextResponse.json({
      campaigns,
      synced: shouldSync && !erroDeSync,
      syncError: erroDeSync,
      syncErrorMessage: erroDeSync
        ? 'Não foi possível atualizar suas campanhas na Meta. O token pode ter expirado ou perdido a permissão ads_read — reconecte a conta de anúncios.'
        : null,
      reconnectUrl: erroDeSync ? '/facebook-connect' : null,
    })
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar campanhas' },
      { status: 500 }
    )
  }
}

// Definir campanha padrão
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { campaignId } = await request.json()

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID é obrigatório' },
        { status: 400 }
      )
    }

    // Validar posse ANTES de alterar qualquer estado
    const target = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: session.user.id,
        platform: 'META_ADS',
      },
    })

    if (!target) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      )
    }

    // Trocar a campanha padrão de forma atômica
    const campaign = await withTenantTx(async (tx) => {
      await tx.campaign.updateMany({
        where: {
          userId: session.user.id,
          platform: 'META_ADS',
        },
        data: { isDefault: false },
      })
      return tx.campaign.update({
        where: { id: target.id },
        data: { isDefault: true },
      })
    })

    return NextResponse.json({
      success: true,
      campaign,
    })
  } catch (error) {
    console.error('Erro ao definir campanha padrão:', error)
    return NextResponse.json(
      { error: 'Erro ao definir campanha padrão' },
      { status: 500 }
    )
  }
}
