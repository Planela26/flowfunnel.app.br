import { NextResponse } from 'next/server'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findSingleActiveIntegration } from '@/lib/webhook-tenant'
import { processMonetizzeEvent } from '@/lib/webhook-handlers'

// LEGACY URL: /api/webhooks/monetizze
// Single-tenant fallback only. Migrate to /api/webhooks/monetizze/<webhookToken>.
export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const rl = await checkRateLimit('webhook:monetizze', 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const rawBody = await request.text()
    const sig = request.headers.get('X-Monetizze-Signature')

    const guard = await guardWebhook({
      platform: 'monetizze',
      rawBody,
      signature: sig,
      secret: process.env.MONETIZZE_WEBHOOK_SECRET,
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

    const { integration, ambiguous } = await findSingleActiveIntegration('MONETIZZE')
    if (ambiguous) {
      console.warn('⛔ Monetizze legacy URL: múltiplas integrações ativas — migre para URL com token.')
      return NextResponse.json(
        { error: 'Multiple tenants — use tokenized webhook URL', migrate: true },
        { status: 409 },
      )
    }
    if (!integration) {
      return NextResponse.json({ success: true, message: 'No active integration' })
    }

    console.log('📦 Monetizze webhook (legacy URL, single tenant):', JSON.stringify(sanitizeForLog(body)))
    await processMonetizzeEvent(body, integration.userId, startTime, '/api/webhooks/monetizze')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao processar webhook Monetizze:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook Monetizze' }, { status: 500 })
  }
}
