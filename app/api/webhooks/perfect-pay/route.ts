import { NextResponse } from 'next/server'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findSingleActiveIntegration } from '@/lib/webhook-tenant'
import { processPerfectPayEvent } from '@/lib/webhook-handlers'

// LEGACY URL: /api/webhooks/perfect-pay
// Single-tenant fallback only. Migrate to /api/webhooks/perfect-pay/<webhookToken>.
export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const rl = await checkRateLimit('webhook:perfect-pay', 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const rawBody = await request.text()
    const sig = request.headers.get('X-Perfect-Pay-Signature')

    const guard = await guardWebhook({
      platform: 'perfect-pay',
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

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { integration, ambiguous } = await findSingleActiveIntegration('PERFECT_PAY')
    if (ambiguous) {
      console.warn('⛔ Perfect Pay legacy URL: múltiplas integrações ativas — migre para URL com token.')
      return NextResponse.json(
        { error: 'Multiple tenants — use tokenized webhook URL', migrate: true },
        { status: 409 },
      )
    }
    if (!integration) {
      return NextResponse.json({ received: true, message: 'No active integration' })
    }

    console.log('📦 Perfect Pay webhook (legacy URL, single tenant):', JSON.stringify(sanitizeForLog(body)))
    await processPerfectPayEvent(body, integration.userId, startTime, '/api/webhooks/perfect-pay')
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Erro Perfect Pay webhook:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Perfect Pay webhook ativo' })
}
