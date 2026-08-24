import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { isIngestionBlockedForUser } from '@/lib/account-status'
import { attributeFromThankYouPage } from '@/lib/attribution'
import { corsPublico } from '@/lib/cors-publico'

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsPublico(request) })
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(`track:conversion:${request.headers.get('x-forwarded-for') || 'anon'}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: corsPublico(request) })
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: corsPublico(request) })
  }

  const siteId = String(body?.site || '').trim()
  const leadId = String(body?.lead_id || '').trim()
  if (!siteId || !leadId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400, headers: corsPublico(request) })
  }
  const value = Number(body?.value) || 0
  const product = body?.product ? String(body.product).slice(0, 200) : null
  const source = (body?.source ? String(body.source) : 'tracker').slice(0, 40)
  const orderId = body?.order_id ? String(body.order_id).slice(0, 120) : null
  const platform = body?.platform ? String(body.platform).slice(0, 40).toLowerCase() : null
  const currency = (body?.currency ? String(body.currency) : 'BRL').slice(0, 8).toUpperCase()

  const user = await prisma.user.findUnique({ where: { id: siteId }, select: { id: true } })
  if (!user) {
    return NextResponse.json({ error: 'invalid_site' }, { status: 404, headers: corsPublico(request) })
  }

  // Modo somente leitura: plano vencido → não ingere novas conversões.
  if (await isIngestionBlockedForUser(user.id)) {
    return NextResponse.json({ skipped: true, reason: 'subscription_expired' }, { status: 200, headers: corsPublico(request) })
  }

  try {
    await prisma.trackedConversion.create({
      data: {
        userId: user.id,
        leadId,
        orderId,
        platform,
        currency,
        value,
        product,
        source,
        metadata: body.meta ? JSON.stringify(body.meta).slice(0, 4000) : null,
      },
    })

    // Atribuição determinística: a thank-you page devolveu o lead_id do
    // localStorage — vincula (ou reconcilia) a venda ao clique original.
    if (!leadId.startsWith('unknown_')) {
      await attributeFromThankYouPage(user.id, {
        leadId,
        orderId,
        platform,
        value,
        currency,
        product,
      }).catch((e) => console.error('[track/conversion] attribution error:', e?.message))
    }

    return NextResponse.json({ ok: true }, { headers: corsPublico(request) })
  } catch (err: any) {
    console.error('[track/conversion] erro:', err?.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: corsPublico(request) })
  }
}
