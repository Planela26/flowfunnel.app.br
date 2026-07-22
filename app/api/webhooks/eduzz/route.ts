import { NextResponse } from 'next/server'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findSingleActiveIntegration } from '@/lib/webhook-tenant'
import { processEduzzEvent } from '@/lib/webhook-handlers'

// LEGACY URL: /api/webhooks/eduzz
// Single-tenant fallback only. Migrate to /api/webhooks/eduzz/<webhookToken>.
export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const rl = await checkRateLimit('webhook:eduzz', 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const rawBody = await request.text()
    const sig = request.headers.get('X-Eduzz-Signature')

    const guard = await guardWebhook({
      platform: 'eduzz',
      rawBody,
      signature: sig,
      secret: process.env.EDUZZ_WEBHOOK_SECRET,
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

    const { integration, ambiguous } = await findSingleActiveIntegration('EDUZZ')
    if (ambiguous) {
      console.warn('⛔ Eduzz legacy URL: múltiplas integrações ativas — migre para URL com token.')
      return NextResponse.json(
        { error: 'Multiple tenants — use tokenized webhook URL', migrate: true },
        { status: 409 },
      )
    }
    if (!integration) {
      return NextResponse.json({ success: true, message: 'No active integration' })
    }

    console.log('📦 Eduzz webhook (legacy URL, single tenant):', JSON.stringify(sanitizeForLog(body)))
    await processEduzzEvent(body, integration.userId, startTime, '/api/webhooks/eduzz')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao processar webhook Eduzz:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook Eduzz' }, { status: 500 })
  }
}
