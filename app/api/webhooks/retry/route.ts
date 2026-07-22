import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { logId } = await request.json()

    // Load the original failed log
    const log = await prisma.webhookLog.findFirst({
      where: { id: logId, userId: session.user.id },
    })

    if (!log) {
      return NextResponse.json({ error: 'Log não encontrado' }, { status: 404 })
    }

    if (!log.payload) {
      return NextResponse.json({ error: 'Payload não disponível para retry' }, { status: 400 })
    }

    // Determine the retry endpoint based on platform
    const endpointMap: Record<string, string> = {
      WHATSAPP: '/api/webhooks/whatsapp',
      HOTMART:  '/api/webhooks/hotmart',
      KIWIFY:   '/api/webhooks/kiwify',
      EDUZZ:    '/api/webhooks/eduzz',
      MONETIZZE:'/api/webhooks/monetizze',
    }

    const endpoint = endpointMap[log.platform]
    if (!endpoint) {
      return NextResponse.json({ error: 'Plataforma não suportada para retry' }, { status: 400 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:5000'
    const retryUrl = `${baseUrl}${endpoint}`

    let payload: any
    try {
      payload = JSON.parse(log.payload)
    } catch {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const startTime = Date.now()
    const response = await fetch(retryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-retry': '1' },
      body: JSON.stringify(payload),
    })

    const duration = Date.now() - startTime
    const success = response.ok

    // Log the retry attempt
    await prisma.webhookLog.create({
      data: {
        userId: session.user.id,
        platform: log.platform,
        event: `${log.event}_retry`,
        method: 'POST',
        endpoint: log.endpoint,
        payload: log.payload,
        response: JSON.stringify({ retried: true, originalLogId: logId }),
        statusCode: response.status,
        duration,
        error: success ? null : `Retry falhou com status ${response.status}`,
      },
    })

    return NextResponse.json({
      success,
      status: response.status,
      duration,
      message: success ? 'Webhook reenviado com sucesso!' : `Retry falhou: HTTP ${response.status}`,
    })
  } catch (error: any) {
    console.error('Erro no retry de webhook:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
