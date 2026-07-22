import { NextResponse } from 'next/server'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findIntegrationByWebhookToken } from '@/lib/webhook-tenant'
import { processKiwifyEvent } from '@/lib/webhook-handlers'

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const startTime = Date.now()
  try {
    const { token } = await params
    const rl = await checkRateLimit(`webhook:kiwify:${token}`, 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const rawBody = await request.text()

    // Auth-first: valida HMAC/secret (fail-closed) ANTES de consultar o banco,
    // para reduzir enumeração de token e custo de DB sob tráfego malicioso.
    const sig = request.headers.get('X-Kiwify-Signature')
    const guard = await guardWebhook({
      platform: `kiwify:${token}`,
      rawBody,
      signature: sig,
      secret: process.env.KIWIFY_WEBHOOK_SECRET,
      headers: request.headers,
      requireSecret: true,
    })
    if (!guard.ok) {
      if (guard.duplicate) return NextResponse.json({ success: true, duplicate: true })
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const integration = await findIntegrationByWebhookToken('KIWIFY', token)
    if (!integration) {
      return NextResponse.json({ error: 'Invalid webhook token' }, { status: 404 })
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    console.log('📦 Kiwify webhook (tokenized):', JSON.stringify(sanitizeForLog(body)))
    await processKiwifyEvent(body, integration.userId, startTime, `/api/webhooks/kiwify/${token.slice(0, 8)}…`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro webhook Kiwify (tokenized):', error)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
