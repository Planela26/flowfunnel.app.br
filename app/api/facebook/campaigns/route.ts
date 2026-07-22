import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveCampaigns, getAdAccountInfo } from '@/lib/facebook'

// Buscar campanhas ativas
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
      return NextResponse.json(
        { error: 'Facebook Ads não conectado' },
        { status: 400 }
      )
    }

    const config = typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config

    // Buscar informações da conta
    const accountInfo = await getAdAccountInfo(
      integration.accessToken,
      config.adAccountId
    )

    // Buscar campanhas
    const campaigns = await getActiveCampaigns(
      integration.accessToken,
      config.adAccountId
    )

    return NextResponse.json({
      success: true,
      account: accountInfo.success ? accountInfo.account : null,
      campaigns: campaigns.success ? campaigns.campaigns : [],
    })
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar campanhas' },
      { status: 500 }
    )
  }
}
