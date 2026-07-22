import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { isIngestionBlockedForUser } from '@/lib/account-status'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(`track:conversion:${request.headers.get('x-forwarded-for') || 'anon'}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS_HEADERS })
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: CORS_HEADERS })
  }

  const siteId = String(body?.site || '').trim()
  const leadId = String(body?.lead_id || '').trim()
  if (!siteId || !leadId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400, headers: CORS_HEADERS })
  }
  const value = Number(body?.value) || 0
  const product = body?.product ? String(body.product).slice(0, 200) : null
  const source = (body?.source ? String(body.source) : 'tracker').slice(0, 40)

  const user = await prisma.user.findUnique({ where: { id: siteId }, select: { id: true } })
  if (!user) {
    return NextResponse.json({ error: 'invalid_site' }, { status: 404, headers: CORS_HEADERS })
  }

  // Modo somente leitura: plano vencido → não ingere novas conversões.
  if (await isIngestionBlockedForUser(user.id)) {
    return NextResponse.json({ skipped: true, reason: 'subscription_expired' }, { status: 200, headers: CORS_HEADERS })
  }

  try {
    await prisma.trackedConversion.create({
      data: {
        userId: user.id,
        leadId,
        value,
        product,
        source,
        metadata: body.meta ? JSON.stringify(body.meta).slice(0, 4000) : null,
      },
    })
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (err: any) {
    console.error('[track/conversion] erro:', err?.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: CORS_HEADERS })
  }
}
