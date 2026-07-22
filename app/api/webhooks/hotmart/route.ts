import { NextResponse } from 'next/server'
import { logWebhook } from '@/lib/webhook-logger'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit, verifyHmacSignature } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findHotmartIntegrationByHottok } from '@/lib/webhook-tenant'
import { processHotmartEvent } from '@/lib/webhook-handlers'

// LEGACY URL: /api/webhooks/hotmart
// Kept for backwards compatibility with already-configured Hotmart accounts.
// Tenant is identified by the X-Hotmart-Hottok header (each tenant stores
// their own unique hottok in integration.accessToken). New customers should
// use the tokenized URL: /api/webhooks/hotmart/<webhookToken>
export async function POST(request: Request) {
  const startTime = Date.now()
  let body: any = null

  try {
    const rl = await checkRateLimit('webhook:hotmart', 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    // HMAC precisa dos BYTES EXATOS recebidos (raw body), não JSON.stringify(parsed).
    const rawBody = await request.text()
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    console.log('📦 Hotmart webhook (legacy URL):', JSON.stringify(sanitizeForLog(body)))

    const event = body.event
    const data = body.data
    const hottok = request.headers.get('X-Hotmart-Hottok')

    if (!event || !data) {
      return NextResponse.json({ success: true, message: 'No event data' })
    }

    // Hottok is required on the legacy URL — it's the only way to identify the tenant.
    if (!hottok) {
      return NextResponse.json({ error: 'Missing X-Hotmart-Hottok header' }, { status: 403 })
    }

    const { integration, ambiguous } = await findHotmartIntegrationByHottok(hottok)
    if (ambiguous) {
      // Multiple tenants share this hottok — refuse instead of guessing.
      console.warn('⛔ Hotmart hottok corresponde a múltiplas integrações — migre para a URL com token.')
      return NextResponse.json(
        { error: 'Ambiguous hottok — use tokenized webhook URL', migrate: true },
        { status: 409 },
      )
    }
    if (!integration) {
      // No tenant matches this hottok — refuse, do not silently attach to anyone.
      console.warn('❌ Hotmart hottok não corresponde a nenhuma integração ativa')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Hotmart: HMAC é opcional (hottok é a autenticação primária). Verifica só
    // quando a assinatura está presente E o secret está configurado.
    const sig = request.headers.get('X-Hotmart-Signature')
    if (sig && process.env.HOTMART_WEBHOOK_SECRET && !verifyHmacSignature(rawBody, sig, process.env.HOTMART_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Timestamp ±5min (se houver) + anti-replay. HMAC já tratado acima (secret:null).
    const guard = await guardWebhook({
      platform: 'hotmart',
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
      endpoint: '/api/webhooks/hotmart',
      payload: sanitizeForLog(body),
      response: { success: true },
      requestId,
      statusCode: 200,
      duration: Date.now() - startTime,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro no webhook Hotmart:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
