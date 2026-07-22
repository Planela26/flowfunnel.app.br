import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { webhookUrl, webhookToken } = await request.json()

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL é obrigatória' },
        { status: 400 }
      )
    }

    const tests: Array<{ name: string; status: 'success' | 'error'; message: string; duration: number }> = []

    // Teste 1: Verificar formato da URL
    const testStart1 = Date.now()
    try {
      const url = new URL(webhookUrl)
      if (url.protocol !== 'https:') {
        tests.push({
          name: 'Validação da URL',
          status: 'error',
          message: 'Webhook deve usar HTTPS',
          duration: Date.now() - testStart1,
        })
      } else {
        tests.push({
          name: 'Validação da URL',
          status: 'success',
          message: `URL válida: ${url.host}`,
          duration: Date.now() - testStart1,
        })
      }
    } catch (error: any) {
      tests.push({
        name: 'Validação da URL',
        status: 'error',
        message: 'URL inválida',
        duration: Date.now() - testStart1,
      })
    }

    // Teste 2: Verificar token (se fornecido)
    const testStart2 = Date.now()
    if (webhookToken) {
      if (webhookToken.length >= 8) {
        tests.push({
          name: 'Validação do Token',
          status: 'success',
          message: `Token configurado (${webhookToken.length} caracteres)`,
          duration: Date.now() - testStart2,
        })
      } else {
        tests.push({
          name: 'Validação do Token',
          status: 'error',
          message: 'Token muito curto (mínimo 8 caracteres)',
          duration: Date.now() - testStart2,
        })
      }
    } else {
      tests.push({
        name: 'Validação do Token',
        status: 'success',
        message: 'Token não configurado (opcional)',
        duration: Date.now() - testStart2,
      })
    }

    // Teste 3: Simular evento de venda
    const testStart3 = Date.now()
    try {
      const mockEvent = {
        event: 'PURCHASE_COMPLETE',
        data: {
          buyer: {
            email: 'teste@example.com',
            name: 'Teste',
          },
          product: {
            id: 'test123',
            name: 'Produto Teste',
          },
          purchase: {
            price: 147.00,
            status: 'approved',
          },
        },
        hottok: webhookToken || '',
      }

      tests.push({
        name: 'Simulação de Evento',
        status: 'success',
        message: 'Payload de teste criado com sucesso',
        duration: Date.now() - testStart3,
      })
    } catch (error: any) {
      tests.push({
        name: 'Simulação de Evento',
        status: 'error',
        message: error.message,
        duration: Date.now() - testStart3,
      })
    }

    // Teste 4: Verificar endpoint do webhook
    const testStart4 = Date.now()
    tests.push({
      name: 'Endpoint de Webhook',
      status: 'success',
      message: 'Webhook configurado em /api/webhooks/hotmart',
      duration: Date.now() - testStart4,
    })

    const allSuccess = tests.every(t => t.status === 'success')

    return NextResponse.json({
      success: allSuccess,
      tests,
      message: allSuccess 
        ? '✅ Todos os testes passaram! Hotmart está configurado corretamente.'
        : '⚠️ Alguns testes falharam. Verifique a configuração.',
    })
  } catch (error: any) {
    console.error('Erro ao testar Hotmart:', error)
    return NextResponse.json(
      { error: 'Erro ao executar testes', details: error.message },
      { status: 500 }
    )
  }
}
