import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { accessToken, adAccountId } = await request.json()

    if (!accessToken || !adAccountId) {
      return NextResponse.json(
        { error: 'Access Token e Ad Account ID são obrigatórios' },
        { status: 400 }
      )
    }

    const tests: Array<{ name: string; status: 'success' | 'error'; message: string; duration: number }> = []

    // Teste 1: Validar token de acesso
    const testStart1 = Date.now()
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await response.json()

      if (response.ok && data.id) {
        tests.push({
          name: 'Validação do Token',
          status: 'success',
          message: `Token válido. User: ${data.name || data.id}`,
          duration: Date.now() - testStart1,
        })
      } else {
        tests.push({
          name: 'Validação do Token',
          status: 'error',
          message: data.error?.message || 'Token inválido',
          duration: Date.now() - testStart1,
        })
      }
    } catch (error: any) {
      tests.push({
        name: 'Validação do Token',
        status: 'error',
        message: error.message,
        duration: Date.now() - testStart1,
      })
    }

    // Teste 2: Verificar acesso à conta de anúncios
    const testStart2 = Date.now()
    try {
      const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${accountId}?fields=name,account_id,account_status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await response.json()

      if (response.ok && data.id) {
        const statusText = data.account_status === 1 ? 'Ativa' : 'Inativa'
        tests.push({
          name: 'Acesso à Conta de Anúncios',
          status: 'success',
          message: `Conta: ${data.name || data.account_id} (${statusText})`,
          duration: Date.now() - testStart2,
        })
      } else {
        tests.push({
          name: 'Acesso à Conta de Anúncios',
          status: 'error',
          message: data.error?.message || 'Sem acesso à conta',
          duration: Date.now() - testStart2,
        })
      }
    } catch (error: any) {
      tests.push({
        name: 'Acesso à Conta de Anúncios',
        status: 'error',
        message: error.message,
        duration: Date.now() - testStart2,
      })
    }

    // Teste 3: Verificar permissões de insights
    const testStart3 = Date.now()
    try {
      const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${accountId}/campaigns?fields=id,name,status&limit=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await response.json()

      if (response.ok) {
        tests.push({
          name: 'Leitura de Campanhas',
          status: 'success',
          message: `Acesso OK. Campanhas encontradas: ${data.data?.length || 0}`,
          duration: Date.now() - testStart3,
        })
      } else {
        tests.push({
          name: 'Leitura de Campanhas',
          status: 'error',
          message: data.error?.message || 'Sem permissão para ler campanhas',
          duration: Date.now() - testStart3,
        })
      }
    } catch (error: any) {
      tests.push({
        name: 'Leitura de Campanhas',
        status: 'error',
        message: error.message,
        duration: Date.now() - testStart3,
      })
    }

    // Teste 4: Verificar leitura de insights
    const testStart4 = Date.now()
    try {
      const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${accountId}/insights?fields=impressions,clicks,spend&date_preset=last_7d`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await response.json()

      if (response.ok) {
        tests.push({
          name: 'Leitura de Insights',
          status: 'success',
          message: `Métricas acessíveis. Dados disponíveis: ${data.data?.length || 0} períodos`,
          duration: Date.now() - testStart4,
        })
      } else {
        tests.push({
          name: 'Leitura de Insights',
          status: 'error',
          message: data.error?.message || 'Sem permissão para ler insights',
          duration: Date.now() - testStart4,
        })
      }
    } catch (error: any) {
      tests.push({
        name: 'Leitura de Insights',
        status: 'error',
        message: error.message,
        duration: Date.now() - testStart4,
      })
    }

    const allSuccess = tests.every(t => t.status === 'success')

    return NextResponse.json({
      success: allSuccess,
      tests,
      message: allSuccess 
        ? '✅ Todos os testes passaram! Facebook Ads está configurado corretamente.'
        : '⚠️ Alguns testes falharam. Verifique as credenciais e permissões.',
    })
  } catch (error: any) {
    console.error('Erro ao testar Facebook:', error)
    return NextResponse.json(
      { error: 'Erro ao executar testes', details: error.message },
      { status: 500 }
    )
  }
}
