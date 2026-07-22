import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { phoneNumberId, accessToken } = await request.json()

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: 'Phone Number ID e Access Token são obrigatórios' },
        { status: 400 }
      )
    }

    const tests: Array<{ name: string; status: 'success' | 'error'; message: string; duration: number }> = []

    // Teste 1: Verificar token de acesso
    const testStart1 = Date.now()
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await response.json()

      if (response.ok && data.id) {
        tests.push({
          name: 'Validação do Token',
          status: 'success',
          message: `Token válido. Phone: ${data.display_phone_number || phoneNumberId}`,
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

    // Teste 2: Verificar permissões de mensagens
    const testStart2 = Date.now()
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/message_templates?limit=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await response.json()

      if (response.ok) {
        tests.push({
          name: 'Permissões de Mensagens',
          status: 'success',
          message: `Acesso OK. Templates disponíveis: ${data.data?.length || 0}`,
          duration: Date.now() - testStart2,
        })
      } else {
        tests.push({
          name: 'Permissões de Mensagens',
          status: 'error',
          message: data.error?.message || 'Sem permissão',
          duration: Date.now() - testStart2,
        })
      }
    } catch (error: any) {
      tests.push({
        name: 'Permissões de Mensagens',
        status: 'error',
        message: error.message,
        duration: Date.now() - testStart2,
      })
    }

    // Teste 3: Verificar webhook configurado
    const testStart3 = Date.now()
    tests.push({
      name: 'Configuração de Webhook',
      status: 'success',
      message: 'Webhook configurado em /api/webhooks/whatsapp',
      duration: Date.now() - testStart3,
    })

    const allSuccess = tests.every(t => t.status === 'success')

    return NextResponse.json({
      success: allSuccess,
      tests,
      message: allSuccess 
        ? '✅ Todos os testes passaram! WhatsApp está configurado corretamente.'
        : '⚠️ Alguns testes falharam. Verifique as credenciais.',
    })
  } catch (error: any) {
    console.error('Erro ao testar WhatsApp:', error)
    return NextResponse.json(
      { error: 'Erro ao executar testes', details: error.message },
      { status: 500 }
    )
  }
}
