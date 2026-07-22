import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { logWebhook } from '@/lib/webhook-logger'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit, verifyHmacSignature } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findIntegrationByWebhookToken } from '@/lib/webhook-tenant'
import { processHotmartEvent } from '@/lib/webhook-handlers'

// Tokenized Hotmart webhook URL: /api/webhooks/hotmart/<webhookToken>
// Each tenant has a unique webhookToken so the request unambiguously
// resolves to the correct user — eliminating cross-tenant attribution.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const startTime = Date.now()
  let body: any = null

  try {
    const { token } = await params
    const rl = await checkRateLimit(`webhook:hotmart:${token}`, 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    // HMAC precisa dos BYTES EXATOS recebidos (raw body), não JSON.stringify(parsed).
    const rawBody = await request.text()
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const integration = await findIntegrationByWebhookToken('HOTMART', token)
    if (!integration) {
      return NextResponse.json({ error: 'Invalid webhook token' }, { status: 404 })
    }

    const event = body.event
    const data = body.data
    if (!event || !data) {
      return NextResponse.json({ success: true, message: 'No event data' })
    }

    const hottok = request.headers.get('X-Hotmart-Hottok')

    if (integration.accessToken && (!hottok || hottok !== integration.accessToken)) {
      const requestId = request.headers.get('X-Request-ID') || undefined
      await logWebhook({
        userId: integration.userId,
        platform: 'HOTMART',
        event: event || 'unknown',
        method: 'POST',
        endpoint: `/api/webhooks/hotmart/${token.slice(0, 8)}…`,
        payload: { event, summary: sanitizeForLog(data) },
        response: { error: 'Invalid hottok' },
        statusCode: 403,
        duration: Date.now() - startTime,
        error: 'Invalid hottok',
        requestId,
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Hotmart: HMAC é opcional (hottok é a autenticação primária).
    const sig = request.headers.get('X-Hotmart-Signature')
    if (sig && process.env.HOTMART_WEBHOOK_SECRET && !verifyHmacSignature(rawBody, sig, process.env.HOTMART_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Timestamp ±5min (se houver) + anti-replay.
    const guard = await guardWebhook({
      platform: `hotmart:${token}`,
      rawBody,
      signature: sig,
      secret: null,
      headers: request.headers,
    })
    if (!guard.ok) {
      if (guard.duplicate) return NextResponse.json({ success: true, duplicate: true })
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    await processHotmartEvent(event, data, integration.userId)

    const requestId = request.headers.get('X-Request-ID') || undefined
    await logWebhook({
      userId: integration.userId,
      platform: 'HOTMART',
      event,
      method: 'POST',
      endpoint: `/api/webhooks/hotmart/${token.slice(0, 8)}…`,
      requestId,
      payload: sanitizeForLog(body),
      response: { success: true },
      statusCode: 200,
      duration: Date.now() - startTime,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro no webhook Hotmart (tokenized):', error)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
