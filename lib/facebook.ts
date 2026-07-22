// Biblioteca de funções para Meta/Facebook Ads API

interface AdInsights {
  impressions: number
  clicks: number
  spend: number
  cpc: number
  cpm: number
  ctr: number
  frequency: number
  reach: number
}

// Buscar insights de campanhas
export async function getAdInsights(
  accessToken: string,
  adAccountId: string,
  datePreset: string = 'last_30d',
  campaignId?: string,
  timeRange?: { since: string; until: string }
): Promise<{ success: boolean; data?: AdInsights; error?: string }> {
  try {
    const fields = [
      'impressions',
      'clicks',
      'spend',
      'cpc',
      'cpm',
      'ctr',
      'frequency',
      'reach',
    ].join(',')

    // Se campaignId for fornecido, buscar insights da campanha específica
    // Senão, buscar insights da conta inteira (todas as campanhas)
    const endpoint = campaignId 
      ? `${campaignId}/insights` 
      : `act_${adAccountId}/insights`

    // time_range tem precedência sobre date_preset quando fornecido
    const dateParam = timeRange
      ? `time_range=${encodeURIComponent(JSON.stringify(timeRange))}`
      : `date_preset=${datePreset}`

    const url = `https://graph.facebook.com/v18.0/${endpoint}?fields=${fields}&${dateParam}&access_token=${accessToken}`

    const response = await fetch(url)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao buscar insights')
    }

    // Agregar dados se houver múltiplas campanhas
    const insights = result.data || []
    
    if (insights.length === 0) {
      return {
        success: true,
        data: {
          impressions: 0,
          clicks: 0,
          spend: 0,
          cpc: 0,
          cpm: 0,
          ctr: 0,
          frequency: 0,
          reach: 0,
        },
      }
    }

    const aggregated = insights.reduce(
      (acc: any, item: any) => ({
        impressions: acc.impressions + parseInt(item.impressions || 0),
        clicks: acc.clicks + parseInt(item.clicks || 0),
        spend: acc.spend + parseFloat(item.spend || 0),
        reach: acc.reach + parseInt(item.reach || 0),
      }),
      { impressions: 0, clicks: 0, spend: 0, reach: 0 }
    )

    // Calcular métricas derivadas
    const cpc = aggregated.clicks > 0 ? aggregated.spend / aggregated.clicks : 0
    const cpm = aggregated.impressions > 0 ? (aggregated.spend / aggregated.impressions) * 1000 : 0
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks / aggregated.impressions) * 100 : 0
    const frequency = aggregated.reach > 0 ? aggregated.impressions / aggregated.reach : 0

    return {
      success: true,
      data: {
        impressions: aggregated.impressions,
        clicks: aggregated.clicks,
        spend: aggregated.spend,
        cpc: parseFloat(cpc.toFixed(2)),
        cpm: parseFloat(cpm.toFixed(2)),
        ctr: parseFloat(ctr.toFixed(2)),
        frequency: parseFloat(frequency.toFixed(2)),
        reach: aggregated.reach,
      },
    }
  } catch (error) {
    console.error('Erro ao buscar insights:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Buscar campanhas ativas
export async function getActiveCampaigns(
  accessToken: string,
  adAccountId: string
) {
  try {
    const fields = [
      'id',
      'name',
      'status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'created_time',
      'updated_time',
    ].join(',')

    const url = `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?fields=${fields}&access_token=${accessToken}`

    const response = await fetch(url)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao buscar campanhas')
    }

    return {
      success: true,
      campaigns: result.data || [],
    }
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Buscar informações da conta de anúncios
export async function getAdAccountInfo(
  accessToken: string,
  adAccountId: string
) {
  try {
    const fields = [
      'id',
      'name',
      'account_status',
      'currency',
      'timezone_name',
      'amount_spent',
      'balance',
    ].join(',')

    const url = `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=${fields}&access_token=${accessToken}`

    const response = await fetch(url)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao buscar informações da conta')
    }

    return {
      success: true,
      account: result,
    }
  } catch (error) {
    console.error('Erro ao buscar informações da conta:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Trocar token de curta duração por token de longa duração
export async function exchangeForLongLivedToken(
  appId: string,
  appSecret: string,
  shortLivedToken: string
) {
  try {
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`

    const response = await fetch(url)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao trocar token')
    }

    return {
      success: true,
      accessToken: result.access_token,
      expiresIn: result.expires_in, // ~60 dias
    }
  } catch (error) {
    console.error('Erro ao trocar token:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Buscar contas de anúncios disponíveis
export async function getAdAccounts(accessToken: string) {
  try {
    const fields = ['id', 'name', 'account_status', 'currency'].join(',')
    const url = `https://graph.facebook.com/v18.0/me/adaccounts?fields=${fields}&access_token=${accessToken}`

    const response = await fetch(url)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao buscar contas de anúncios')
    }

    return {
      success: true,
      accounts: result.data || [],
    }
  } catch (error) {
    console.error('Erro ao buscar contas de anúncios:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Validar access token
export async function validateAccessToken(accessToken: string) {
  try {
    const url = `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`

    const response = await fetch(url)
    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error?.message || 'Token inválido',
      }
    }

    return {
      success: true,
      user: result,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}
