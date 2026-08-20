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

    // Falha de comunicação com a Meta NÃO é "conta sem campanhas".
    //
    // Antes esta rota fazia `campaigns.success ? campaigns.campaigns : []` e
    // devolvia 200. Qualquer erro — token expirado, permissão `ads_read`
    // revogada, conta de anúncios desvinculada do Business Manager — chegava na
    // tela como uma lista vazia, indistinguível de quem realmente não tem
    // campanha. O usuário não tinha como saber que precisava reconectar, e o
    // motivo real morria no console do servidor.
    if (!campaigns.success) {
      return NextResponse.json(
        {
          error: 'meta_api_error',
          message:
            'Não foi possível ler suas campanhas na Meta. O token pode ter expirado ou perdido a permissão ads_read — reconecte a conta de anúncios.',
          detail: campaigns.error ?? null,
          reconnectUrl: '/facebook-connect',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      account: accountInfo.success ? accountInfo.account : null,
      campaigns: campaigns.campaigns,
    })
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar campanhas' },
      { status: 500 }
    )
  }
}
