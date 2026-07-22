import { NextResponse } from 'next/server'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findSingleActiveIntegration } from '@/lib/webhook-tenant'
import { processKiwifyEvent } from '@/lib/webhook-handlers'

// LEGACY URL: /api/webhooks/kiwify
// Backwards-compat ONLY for setups with a single active Kiwify integration.
// If two or more tenants have Kiwify connected, the request is refused —
// callers must migrate to the tokenized URL: /api/webhooks/kiwify/<webhookToken>
export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const rl = await checkRateLimit('webhook:kiwify', 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    // HMAC deve usar os BYTES EXATOS recebidos (raw body), nunca JSON.stringify(parsed).
    const rawBody = await request.text()
    const sig = request.headers.get('X-Kiwify-Signature')

    const guard = await guardWebhook({
      platform: 'kiwify',
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

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { integration, ambiguous } = await findSingleActiveIntegration('KIWIFY')
    if (ambiguous) {
      console.warn('⛔ Kiwify legacy URL: múltiplas integrações ativas — recuse para evitar cross-tenant. Migre para a URL com token.')
      return NextResponse.json(
        { error: 'Multiple tenants — use tokenized webhook URL', migrate: true },
        { status: 409 },
      )
    }
    if (!integration) {
      return NextResponse.json({ success: true, message: 'No active integration' })
    }

    console.log('📦 Kiwify webhook (legacy URL, single tenant):', JSON.stringify(sanitizeForLog(body)))
    await processKiwifyEvent(body, integration.userId, startTime, '/api/webhooks/kiwify')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao processar webhook Kiwify:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook Kiwify' }, { status: 500 })
  }
}
