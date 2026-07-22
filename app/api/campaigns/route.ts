import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withTenantTx } from '@/lib/prisma'

// Buscar campanhas do Facebook Ads
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const forceSync = searchParams.get('sync') === 'true'

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

    if (shouldSync) {
      // Buscar campanhas da API do Facebook
      try {
        const accountId = config.adAccountId.startsWith('act_') 
          ? config.adAccountId 
          : `act_${config.adAccountId}`

        const response = await fetch(
          `https://graph.facebook.com/v18.0/${accountId}/campaigns?` +
          `fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,spend`,
          { headers: { Authorization: `Bearer ${integration.accessToken}` } }
        )

        if (!response.ok) {
          const error = await response.json()
          console.error('Erro ao buscar campanhas:', error)
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

    return NextResponse.json({
      campaigns,
      synced: shouldSync,
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
