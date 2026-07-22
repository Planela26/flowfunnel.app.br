import { NextResponse } from 'next/server'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findIntegrationByWebhookToken } from '@/lib/webhook-tenant'
import { processPerfectPayEvent } from '@/lib/webhook-handlers'

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const startTime = Date.now()
  try {
    const { token } = await params
    const rl = await checkRateLimit(`webhook:perfect-pay:${token}`, 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const rawBody = await request.text()

    // Auth-first: valida HMAC/secret (fail-closed) ANTES de consultar o banco,
    // para reduzir enumeração de token e custo de DB sob tráfego malicioso.
    const sig = request.headers.get('X-Perfect-Pay-Signature')
    const guard = await guardWebhook({
      platform: `perfect-pay:${token}`,
      rawBody,
      signature: sig,
      secret: process.env.PERFECT_PAY_WEBHOOK_SECRET,
      headers: request.headers,
      requireSecret: true,
    })
    if (!guard.ok) {
      if (guard.duplicate) return NextResponse.json({ received: true, duplicate: true })
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const integration = await findIntegrationByWebhookToken('PERFECT_PAY', token)
    if (!integration) {
      return NextResponse.json({ error: 'Invalid webhook token' }, { status: 404 })
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    console.log('📦 Perfect Pay webhook (tokenized):', JSON.stringify(sanitizeForLog(body)))
    await processPerfectPayEvent(body, integration.userId, startTime, `/api/webhooks/perfect-pay/${token.slice(0, 8)}…`)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Erro webhook Perfect Pay (tokenized):', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Perfect Pay webhook ativo' })
}
