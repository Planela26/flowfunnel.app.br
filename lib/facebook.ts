// Biblioteca de funções para Meta/Facebook Ads API

import { GRAPH_API_BASE } from './graph-api'
import { decryptSecret } from './security-utils'

/**
 * Chamada à Graph API com o token no header, nunca na query string.
 *
 * URLs acabam em log de proxy, APM, header Referer e rastro de erro — o próprio
 * projeto já documenta isso em app/api/cron/snapshot/route.ts ("secret deve vir
 * SOMENTE no header Authorization"). O timeout evita que um upstream lento
 * segure a conexão indefinidamente.
 *
 * ── Por que a descriptografia acontece AQUI ─────────────────────────────────
 *
 * `Integration.accessToken` é gravado por `encryptSecret` e vale
 * `enc:<iv>:<tag>:<dados>` no banco. Cada rota que lia a coluna mandava esse
 * texto para a Meta como se fosse o token — campanhas, métricas, relatório em
 * PDF e o snapshot diário, todas. A Meta respondia 401, o `catch` de cada
 * função devolvia `success: false`, e quem chamava traduzia isso em lista
 * vazia: a tela dizia "nenhuma campanha" para uma conta cheia de campanhas.
 *
 * Descriptografar em cada chamador seria repetir a mesma linha cinco vezes e
 * esperar que a sexta rota também lembrasse. Aqui é o ponto por onde todo
 * acesso à Graph API obrigatoriamente passa.
 *
 * `decryptSecret` devolve o valor intacto quando não há o prefixo `enc:`, então
 * token recém-vindo do OAuth (ainda em texto puro, como na tela de conexão) e
 * token legado gravado antes da criptografia continuam funcionando.
 */
function graphFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const token = decryptSecret(accessToken) || accessToken

  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  })
}

interface AdInsights {
  impressions: number
  clicks: number
  /**
   * Cliques que abrem o link do anúncio. `clicks` da Meta conta TODA
   * interação — curtida, comentário, clique no perfil, expandir a imagem —
   * então é sempre maior. Para comparar contra visitas registradas no site,
   * este é o número honesto; o outro acusaria uma perda que não existe.
   */
  linkClicks: number
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
): Promise<{ success: boolean; data?: AdInsights; error?: string; hasDelivery?: boolean }> {
  try {
    const fields = [
      'impressions',
      'clicks',
      'inline_link_clicks',
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

    const url = `${GRAPH_API_BASE}/${endpoint}?fields=${fields}&${dateParam}`

    const response = await graphFetch(url, accessToken)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error?.message || 'Erro ao buscar insights')
    }

    // Agregar dados se houver múltiplas campanhas
    const insights = result.data || []
    
    // Lista vazia = a campanha não teve veiculação no período pedido. É uma
    // resposta LEGÍTIMA da Meta, não uma falha — mas devolver só zeros faz ela
    // ficar idêntica a "não consegui ler", e quem olha a tela conclui que o
    // sistema quebrou. `hasDelivery` deixa o chamador dizer qual dos dois é.
    if (insights.length === 0) {
      return {
        success: true,
        hasDelivery: false,
        data: {
          impressions: 0,
          clicks: 0,
          linkClicks: 0,
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
        linkClicks: acc.linkClicks + parseInt(item.inline_link_clicks || 0),
        spend: acc.spend + parseFloat(item.spend || 0),
        reach: acc.reach + parseInt(item.reach || 0),
      }),
      { impressions: 0, clicks: 0, linkClicks: 0, spend: 0, reach: 0 }
    )

    // Calcular métricas derivadas
    const cpc = aggregated.clicks > 0 ? aggregated.spend / aggregated.clicks : 0
    const cpm = aggregated.impressions > 0 ? (aggregated.spend / aggregated.impressions) * 1000 : 0
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks / aggregated.impressions) * 100 : 0
    const frequency = aggregated.reach > 0 ? aggregated.impressions / aggregated.reach : 0

    return {
      success: true,
      hasDelivery: true,
      data: {
        impressions: aggregated.impressions,
        clicks: aggregated.clicks,
        linkClicks: aggregated.linkClicks,
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

/**
 * Insights do período, com queda para soma por campanha.
 *
 * A consulta no nível da CONTA (`act_<id>/insights`) volta vazia em algumas
 * contas mesmo com campanha entregando — foi o que aconteceu aqui: a aba
 * Campanhas mostrava 1.386 impressões consultando `<campaignId>/insights`,
 * enquanto o card do dashboard e a Sara, que perguntavam pela conta, recebiam
 * lista vazia e concluíam "sem veiculação no período".
 *
 * Não dá para saber de fora por que a conta não reporta no agregado — depende
 * de permissão, de como a conta foi criada e de mudanças entre versões da API.
 * Mas dá para contornar: se o agregado não trouxer entrega e houver campanhas
 * conhecidas, somamos campanha a campanha, que é o caminho comprovadamente
 * funcional.
 *
 * A ordem importa: a conta primeiro, porque é UMA requisição em vez de N.
 * A soma só entra quando o barato não responde.
 */
export async function getInsightsComFallback(
  accessToken: string,
  adAccountId: string,
  datePreset: string,
  campaignIds: string[] = [],
): Promise<{ success: boolean; data?: AdInsights; error?: string; hasDelivery?: boolean; fonte?: 'conta' | 'campanhas' }> {
  const daConta = await getAdInsights(accessToken, adAccountId, datePreset)

  if (daConta.success && daConta.hasDelivery) {
    return { ...daConta, fonte: 'conta' }
  }
  if (campaignIds.length === 0) {
    return { ...daConta, fonte: 'conta' }
  }

  // Teto de 25 campanhas: além disso o custo em requisições passa a doer, e
  // conta com esse volume normalmente reporta no agregado.
  const alvos = campaignIds.slice(0, 25)
  const resultados = await Promise.all(
    alvos.map(id => getAdInsights(accessToken, adAccountId, datePreset, id)),
  )

  const comEntrega = resultados.filter(r => r.success && r.hasDelivery && r.data)
  if (comEntrega.length === 0) {
    // Nem a conta nem as campanhas entregaram: aí é ausência de veiculação
    // mesmo, e a resposta da conta já descreve isso corretamente.
    const falhou = resultados.find(r => !r.success)
    if (!daConta.success && falhou) return { ...daConta, fonte: 'campanhas' }
    return { ...daConta, fonte: 'campanhas' }
  }

  const soma = comEntrega.reduce(
    (acc, r) => ({
      impressions: acc.impressions + (r.data!.impressions || 0),
      clicks: acc.clicks + (r.data!.clicks || 0),
      linkClicks: acc.linkClicks + (r.data!.linkClicks || 0),
      spend: acc.spend + (r.data!.spend || 0),
      reach: acc.reach + (r.data!.reach || 0),
    }),
    { impressions: 0, clicks: 0, linkClicks: 0, spend: 0, reach: 0 },
  )

  // Derivadas recalculadas sobre o total. Somar CPC/CTR de cada campanha daria
  // média de razões, que não é a razão dos totais.
  const cpc = soma.clicks > 0 ? soma.spend / soma.clicks : 0
  const cpm = soma.impressions > 0 ? (soma.spend / soma.impressions) * 1000 : 0
  const ctr = soma.impressions > 0 ? (soma.clicks / soma.impressions) * 100 : 0
  const frequency = soma.reach > 0 ? soma.impressions / soma.reach : 0

  return {
    success: true,
    hasDelivery: true,
    fonte: 'campanhas',
    data: {
      impressions: soma.impressions,
      clicks: soma.clicks,
      linkClicks: soma.linkClicks,
      spend: soma.spend,
      cpc: parseFloat(cpc.toFixed(2)),
      cpm: parseFloat(cpm.toFixed(2)),
      ctr: parseFloat(ctr.toFixed(2)),
      frequency: parseFloat(frequency.toFixed(2)),
      reach: soma.reach,
    },
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

    const url = `${GRAPH_API_BASE}/act_${adAccountId}/campaigns?fields=${fields}`

    const response = await graphFetch(url, accessToken)
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

    const url = `${GRAPH_API_BASE}/act_${adAccountId}?fields=${fields}`

    const response = await graphFetch(url, accessToken)
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
    // Endpoint de OAuth: ainda não existe bearer token para enviar no header, e
    // a própria Meta espera estes parâmetros no corpo/query. Enviamos via POST
    // para que `client_secret` não fique na URL (que vaza em log e Referer).
    const url = `${GRAPH_API_BASE}/oauth/access_token`
    const form = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    })
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
    const url = `${GRAPH_API_BASE}/me/adaccounts?fields=${fields}`

    const response = await graphFetch(url, accessToken)
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
    const url = `${GRAPH_API_BASE}/me`

    const response = await graphFetch(url, accessToken)
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
